# Deployment

Two independently deployed apps:

| App | Location | Deployed to |
| --- | --- | --- |
| `apps/web` | Next.js 16 frontend | Vercel |
| `apps/api` | Express 5 + MongoDB backend | Your VPS |

They share nothing at runtime. The browser holds a bearer token and sends it to
the API on every request; there are no cookies crossing the boundary.

---

## Environments

Three, distinguished only by environment variables:

| | Web `NEXT_PUBLIC_API_URL` | API `APP_ENV` | API `CORS_ORIGINS` |
| --- | --- | --- | --- |
| local | `http://localhost:4000` | `development` | `http://localhost:3000` |
| staging | `https://api-staging.yourdomain.com` | `staging` | `https://crm-staging.vercel.app` |
| production | `https://api.yourdomain.com` | `production` | `https://crm.yourdomain.com` |

`GET /health` on the API reports which one answered:

```json
{ "status": "ok", "env": "production", "uptime": 1423, "timestamp": "..." }
```

Use a **different `JWT_SECRET` per environment**. A staging token must not be
accepted by production.

---

## Backend — Vercel

Two separate Vercel projects from the same repo, each with its own **Root
Directory**: `apps/web` for the frontend, `apps/api` for this one. Getting that
setting wrong is what makes Vercel compile the other app and fail with errors
that have nothing to do with what you are deploying.

Vercel deploys the Express server as-is. It looks for a `server` entrypoint by
name — `src/server.ts` here — captures the HTTP server from the `listen()` call,
and routes requests to it over an internal port. There is no `api/` directory,
no per-request handler, and no rewrite table: Express keeps owning its routing.

Two details in the code exist for that detection and must not be undone:

- `listen()` in `src/server.ts` runs **synchronously** at module startup. It is
  not awaited behind the database connection, because Vercel reads that call to
  find the server. `/health` therefore answers about a second before Mongo is
  up, which is what you want from a liveness probe anyway.
- The connection is instead awaited **per request**, by the middleware in
  `src/app.ts` registered after `/health` and before the routers. `connectDB`
  caches its promise, so this is free once connected.

`apps/api/vercel.json` skips the build step: Vercel bundles `src/server.ts`
itself, so running `tsc` there would only produce output nothing reads. Types are
still checked by `npm run typecheck` locally and by the Docker image build.

### Import settings

| Setting | Value |
| --- | --- |
| Root Directory | `apps/api` |
| Framework Preset | Other |
| Build Command | *(from `vercel.json`)* |

### Environment variables

Everything from `apps/api/.env.example`. `PORT` is optional — on Vercel it only
names the internal port. Three values must point at the deployed hosts rather
than localhost:

| Variable | Value |
| --- | --- |
| `CORS_ORIGINS` | the frontend's Vercel URL |
| `WEB_APP_URL` | the frontend's Vercel URL |
| `GOOGLE_REDIRECT_URI` | `https://<api-project>.vercel.app/api/integrations/google/callback` |

`GOOGLE_REDIRECT_URI` must also be added verbatim under **Authorised redirect
URIs** in the Google Cloud console, or the OAuth callback fails with
`redirect_uri_mismatch`.

MongoDB Atlas → **Network Access → Add IP Address → `0.0.0.0/0`**. Vercel has no
fixed egress IP; the connection is still authenticated by the credentials in
`MONGODB_URI`.

### What you give up

- **Cold starts.** The first request after idle pays Node boot plus the Mongo
  handshake — roughly a second and a half from the timings above.
- **Request timeouts.** Long report exports can exceed the plan's limit.
- **No background work.** Anything that must outlive a response needs a queue.

If any of those bite, the Railway path below runs the identical entry point with
none of them.

---

## Backend — Railway (alternative)

Railway builds `apps/api/Dockerfile` with the **repo root** as context, which is
what that Dockerfile expects — the workspace lockfile has to be in scope.
`railway.json` at the repo root already declares this, so there is nothing to
configure in the dashboard beyond environment variables.

1. railway.app → **New Project → Deploy from GitHub repo** → pick this repo.
   Leave the root directory alone; `railway.json` points at the Dockerfile.
2. **Variables** tab — add every key from `apps/api/.env.example` except `PORT`
   (Railway injects its own, and the app reads it):

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `APP_ENV` | `production` |
   | `MONGODB_URI` | your Atlas connection string |
   | `JWT_SECRET` | fresh value from `openssl rand -base64 32` |
   | `TOKEN_TTL_SECONDS` | `86400` |
   | `CORS_ORIGINS` | your Vercel URL — see below |

3. **Settings → Networking → Generate Domain**. You get
   `https://<something>.up.railway.app`. That is the value the frontend needs.

MongoDB Atlas will refuse the connection until Railway's egress is allowed:
**Atlas → Network Access → Add IP Address → `0.0.0.0/0`** (Railway has no static
egress IP on the starter plans; the connection is still authenticated by the
credentials in `MONGODB_URI`).

Health check: Railway polls `/health`, already declared in `railway.json`. A
deploy that goes "Active" but never healthy is almost always Mongo — check the
deploy logs for `[api] mongo connected`.

Render works the same way: **New → Web Service → Docker**, Dockerfile path
`apps/api/Dockerfile`, Docker build context `.` (repo root), same variables.

---

## Backend — VPS (alternative)

### 1. Prepare

```bash
git clone <your-repo> /srv/crm && cd /srv/crm
npm ci
cp apps/api/.env.example apps/api/.env
```

Fill in `apps/api/.env`. Generate the secret with:

```bash
openssl rand -base64 32
```

`CORS_ORIGINS` must list the **exact** Vercel origin — scheme + host, no
trailing slash. A mismatch here is the single most common cause of "it works in
Postman but not in the browser".

### 2. Build and run

```bash
npm run build:api
npm i -g pm2
cd apps/api
pm2 start ecosystem.config.cjs --env production   # or --env staging
pm2 save && pm2 startup
```

Docker alternative, built from the repo root:

```bash
docker build -f apps/api/Dockerfile -t crm-api .
docker run -d --name crm-api -p 4000:4000 --env-file apps/api/.env crm-api
```

### 3. TLS — not optional

The Vercel frontend is served over HTTPS, and a browser will refuse to let an
HTTPS page call an `http://` API. Put nginx or Caddy in front:

```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

Then `certbot --nginx -d api.yourdomain.com`.

Keep port 4000 closed on the firewall — only nginx should reach it:

```bash
ufw allow 'Nginx Full' && ufw deny 4000
```

### 4. Seed / create the first admin

```bash
cd apps/api
npm run create-admin     # interactive
npm run seed             # demo leads — never run against production
```

---

## Frontend — Vercel

### Import settings

| Setting | Value |
| --- | --- |
| Root Directory | `apps/web` |
| Framework Preset | Next.js |
| Build Command | *(leave default)* |
| Install Command | *(leave default)* |

The **Root Directory must be `apps/web`** — Vercel would otherwise try to build
the workspace root, which has no Next.js app.

`apps/web/package.json` declares `@tailwindcss/oxide-linux-x64-gnu` and
`lightningcss-linux-x64-gnu` under `optionalDependencies`. These are Tailwind's
Linux build binaries, and they exist only so `npm ci` on Vercel's linux/x64
builder records and installs them — a lockfile generated on macOS otherwise
omits them and the build dies with
`Cannot find module '../lightningcss.linux-x64-gnu.node'`. Do not remove them,
and bump their versions in step with `tailwindcss`.

### Environment variables

Add `NEXT_PUBLIC_API_URL` for each Vercel environment:

- **Production** → `https://api.yourdomain.com`
- **Preview** → `https://api-staging.yourdomain.com`
- **Development** → `http://localhost:4000`

`NEXT_PUBLIC_*` values are inlined into the browser bundle, so this must never
hold a secret. It only ever holds a URL — the frontend has no secrets at all.

Changing it requires a **redeploy**; it is baked in at build time, not read at
runtime.

### After the first deploy

Copy the real Vercel URL into the API's `CORS_ORIGINS`, then restart the API
(Railway redeploys on its own when a variable changes; on a VPS run
`pm2 restart crm-api`).

Preview deployments get a new URL per branch, so list them with a wildcard —
`CORS_ORIGINS` accepts `*` for subdomain labels:

```
CORS_ORIGINS=https://crm.yourdomain.com,https://*.vercel.app
```

The wildcard spans subdomain labels only; `https://*.vercel.app` matches
`https://crm-git-main-acme.vercel.app` but never `https://evil.com` or
`https://x.vercel.app.evil.com`. Note that it does trust *every* project on
`vercel.app`, not just yours — fine while the bearer token is the real
authorisation boundary, but pin the exact origin for production if you'd rather
not.

---

## Verifying a deployment

```bash
# 1. API is alive and is the environment you think it is
curl https://api.yourdomain.com/health

# 2. Auth works end to end
curl -X POST https://api.yourdomain.com/api/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@yourdomain.com","password":"..."}'

# 3. CORS is configured for the real frontend origin
curl -i -X OPTIONS https://api.yourdomain.com/api/leads \
  -H "Origin: https://crm.yourdomain.com" \
  -H "Access-Control-Request-Method: GET" | grep -i access-control-allow-origin
```

Step 3 returning no `Access-Control-Allow-Origin` header means `CORS_ORIGINS` is
wrong — the browser will fail every request while Postman keeps working, because
Postman doesn't enforce CORS.

The full Postman collection in [`postman/`](postman/) runs against any
environment: set `baseUrl` and run it.

---

## Rollback

```bash
# API
cd /srv/crm && git checkout <previous-tag>
npm ci && npm run build:api && pm2 restart crm-api
```

Frontend: use **Instant Rollback** on the Vercel deployment list.

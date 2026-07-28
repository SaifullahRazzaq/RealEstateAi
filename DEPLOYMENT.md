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

## Backend — VPS

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

Copy the real Vercel URL into the API's `CORS_ORIGINS` and restart:

```bash
pm2 restart crm-api
```

Preview deployments get a new URL per branch. If you want those to work, either
add a wildcard-free list of the URLs you care about, or point previews at a
staging API whose `CORS_ORIGINS` includes your `*.vercel.app` project domain.

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

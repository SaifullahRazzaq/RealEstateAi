# Real Estate CRM

Multi-tenant CRM for real estate teams — lead pipeline, follow-ups, meetings,
call logging and reporting.

Split into two independently deployable apps:

```
apps/
├── web/   Next.js 16 frontend  → Vercel
└── api/   Express 5 + MongoDB  → VPS
postman/   API collection (30 requests, 51 assertions)
```

The frontend holds no secrets and talks to nothing but the API. The API is
stateless: every request authenticates with a bearer token, so there are no
sessions or cookies crossing the boundary.

## Running locally

```bash
npm install          # installs both workspaces

cp apps/api/.env.example apps/api/.env      # fill in MONGODB_URI + JWT_SECRET
cp apps/web/.env.example apps/web/.env.local

npm run dev:api      # http://localhost:4000
npm run dev:web      # http://localhost:3000
```

First run needs an account:

```bash
cd apps/api
npm run create-admin
npm run seed          # optional demo leads
```

## Auth

`POST /api/auth/token` exchanges email + password for a JWT valid for exactly
**1 day**. The expiry is absolute — stamped at login, never extended by activity.

The browser keeps it in a `crm_token` cookie so `proxy.ts` can guard dashboard
routes server-side before rendering. Client code reads it to build the
`Authorization: Bearer <token>` header. When it expires, three things fire: the
API returns `401 TOKEN_EXPIRED`, `proxy.ts` redirects to `/auth/login`, and
`AuthProvider` logs the user out at the exact expiry instant.

The cookie is deliberately not httpOnly — client JS must read it. That carries
the same XSS exposure as localStorage would; the real authorisation boundary is
the API, which verifies the signature on every request.

## Errors

Every API failure has the same shape:

```json
{ "error": "Human readable message", "code": "MACHINE_CODE" }
```

`VALIDATION_ERROR` · `NO_TOKEN` · `TOKEN_INVALID` · `TOKEN_EXPIRED` ·
`INVALID_CREDENTIALS` · `FORBIDDEN` · `NOT_FOUND` · `CONFLICT` ·
`INTERNAL_ERROR`

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev:web` / `dev:api` | run one app in watch mode |
| `npm run build` | build both |
| `npm run typecheck` | typecheck both |
| `npm run lint` | lint the frontend |

## Testing the API

```bash
npx newman run postman/real-estate-crm.postman_collection.json \
  --env-var baseUrl=http://localhost:4000 \
  --env-var email=you@example.com \
  --env-var password=...
```

## Deploying

See [DEPLOYMENT.md](DEPLOYMENT.md) — Vercel setup, VPS with pm2 or Docker, nginx
TLS, and the CORS configuration that connects the two.

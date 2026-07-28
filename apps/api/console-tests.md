# Testing the API from the browser console

Every snippet below was run against the live API before being written down.

> **Open the console on `http://localhost:3000`.**
> The API only allows the origins listed in `CORS_ORIGINS`. If you open the
> console on any other page (google.com, `about:blank`, a file:// page), the
> browser blocks the request and you get a CORS error — the API is fine, the
> origin is wrong.

Demo credentials: **`demo@crm.test` / `Demo@1234`**

---

## 1. Login — the one you asked for

```js
const res = await fetch('http://localhost:4000/api/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@crm.test', password: 'Demo@1234' }),
});

const data = await res.json();
console.log(res.status, data);

// keep it around for the next snippets
window.token = data.token;
```

Expected:

```
200 {
  token: "eyJhbGciOiJIUzI1NiIs...",
  tokenType: "Bearer",
  expiresIn: 86400,               // exactly 1 day
  expiresAt: "2026-07-29T16:55:00.000Z",
  user: { id, name, email, role: "admin", companyId }
}
```

## 2. Use the token — any authenticated endpoint

```js
const me = await fetch('http://localhost:4000/api/auth/me', {
  headers: { Authorization: `Bearer ${window.token}` },
});
console.log(await me.json());
```

```
{ user: {...}, authMethod: "bearer", expiresAt: "...", secondsRemaining: 86400 }
```

## 3. Read data

```js
const leads = await fetch('http://localhost:4000/api/leads?tab=all&limit=5', {
  headers: { Authorization: `Bearer ${window.token}` },
}).then(r => r.json());

console.table(leads.leads.map(l => ({ name: l.name, phone: l.phone, status: l.status })));
console.log('total:', leads.pagination.total);
```

## 4. Write data

```js
const created = await fetch('http://localhost:4000/api/leads', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${window.token}`,
  },
  body: JSON.stringify({ name: 'Console Test', phone: '03001234567', dealValue: 500000 }),
}).then(r => r.json());

console.log(created.lead._id);
```

Delete it again so it doesn't linger in the demo data:

```js
await fetch(`http://localhost:4000/api/leads/${created.lead._id}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${window.token}` },
});
```

## 5. Log in for real — sets the cookie the dashboard reads

This is what the login page does. After running it, refresh and you are inside
the dashboard.

```js
const { token, expiresAt } = await fetch('http://localhost:4000/api/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@crm.test', password: 'Demo@1234' }),
}).then(r => r.json());

document.cookie = `crm_token=${token}; Path=/; Expires=${new Date(expiresAt).toUTCString()}; SameSite=Lax`;
location.href = '/dashboard';
```

## 6. Errors — what failure looks like

```js
const bad = await fetch('http://localhost:4000/api/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@crm.test', password: 'wrong' }),
});
console.log(bad.status, await bad.json());
```

```
401 { error: "Invalid email or password.", code: "INVALID_CREDENTIALS" }
```

No token at all:

```js
const nope = await fetch('http://localhost:4000/api/leads');
console.log(nope.status, await nope.json());
// 401 { error: "Authentication required...", code: "NO_TOKEN" }
```

---

## Axios version

`axios` is **not** a dependency of this project, so in the browser console load
it first:

```js
await import('https://cdn.jsdelivr.net/npm/axios@1/+esm').then(m => (window.axios = m.default));
```

Then:

```js
const api = axios.create({ baseURL: 'http://localhost:4000' });

// 1. login
const { data } = await api.post('/api/auth/token', {
  email: 'demo@crm.test',
  password: 'Demo@1234',
});
console.log(data.user.email, 'expiresIn', data.expiresIn);

// 2. attach the token to every later call
api.defaults.headers.common.Authorization = `Bearer ${data.token}`;

// 3. use it
const me = await api.get('/api/auth/me');
console.log(me.data);

const leads = await api.get('/api/leads', { params: { tab: 'all', limit: 3 } });
console.log('total:', leads.data.pagination.total);

// 4. axios throws on non-2xx, so errors live on err.response
try {
  await api.post('/api/auth/token', { email: 'demo@crm.test', password: 'wrong' });
} catch (err) {
  console.log(err.response.status, err.response.data);
  // 401 { error: "Invalid email or password.", code: "INVALID_CREDENTIALS" }
}
```

If you'd rather use axios inside the app itself, install it into the frontend
workspace — but note `src/lib/api.ts` already wraps fetch with the token header,
the `{ error, code }` handling and auto-logout on 401, so calling `apiFetch()` is
usually what you want:

```js
import { apiFetch } from '@/lib/api';
const { leads } = await apiFetch('/api/leads?tab=all');
```

---

## Node / terminal instead of the browser

CORS doesn't apply outside a browser, so this works from anywhere:

```bash
curl -s -X POST http://localhost:4000/api/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@crm.test","password":"Demo@1234"}' | jq

TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@crm.test","password":"Demo@1234"}' | jq -r .token)

curl -s http://localhost:4000/api/leads?tab=all -H "Authorization: Bearer $TOKEN" | jq '.pagination'
```

## Production

Swap `http://localhost:4000` for your VPS URL and make sure that origin is in
the API's `CORS_ORIGINS`. See [DEPLOYMENT.md](../../DEPLOYMENT.md).

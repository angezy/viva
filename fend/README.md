# Viva frontend

The browser only calls same-origin paths such as `/api/products`. Next.js
proxies those requests to the Express backend, so a deployed visitor never
tries to connect to `127.0.0.1` or `localhost` on their own device.

## Required server configuration

Copy `.env.example` to `.env.local` (or configure these variables in your
hosting panel) on the **frontend server**:

```env
BACKEND_URL=https://api.your-domain.com
JWT_SECRET=the-same-value-used-by-bend
```

`BACKEND_URL` is read only by Next.js on the server. It can be an internal
service address when both applications share a private network, for example
`http://bend:5000`; it must be reachable from the frontend server, not from a
visitor's browser. Do not prefix it with `NEXT_PUBLIC_`.

On the backend, configure its existing database variables (`DB_USER`,
`DB_PASSWORD`, `DB_SERVER`, and `DB_DATABASE`) plus the same `JWT_SECRET`.

## Run

```bash
npm install
npm run build
npm start
```

Set the environment variables before `npm run build` and restart the frontend
after changing them. Uploaded files are served by the backend and exposed to
the browser through the frontend's `/uploads/...` path.

# ShopNest — Server

Express.js (JavaScript) + MongoDB APIs for the ShopNest fashion store. No TypeScript on the server — plain, beginner-friendly JavaScript, the same pattern as FixMate.

**Live:** https://shopnest-server-fghr.vercel.app
**Client (storefront):** https://shopnest-client-fghr.vercel.app

## What it serves

| Group | What it does |
|---|---|
| `/api/health` | `{"status":"ok","db":"connected"}` — the quick check that server + database are up |
| `/api/products` | List / search / filter products, single product, admin CRUD |
| `/api/categories` | Sub-categories (men / women sections), admin CRUD |
| `/api/orders` | Create order (guest or logged in), track by id + phone, admin status flow |
| `/api/banners` | Hero banners, admin CRUD |
| `/api/reviews` | Product reviews, admin moderation |
| `/api/settings` | The single settings document (shop name, logo, bKash number, delivery charges) |
| `/api/admin/*` | Dashboard stats — JWT required, admin role only |

## Rules the server enforces

- Auth lives in the client (BetterAuth). The server only **verifies the JWT** (via BetterAuth JWKS) and then checks the `role` from the token.
- Admin routes return 403 for non-admins. There is no admin signup — the admin is created manually in the database.
- Orders keep a price snapshot of each item, so later price changes never rewrite an old order.

## Database collections (MongoDB, database `shopnest`)

`users`, `categories`, `products`, `orders`, `banners`, `reviews`, `settings` — 7 collections. `settings` holds a single document.

## Tech stack

- Express.js + plain JavaScript (`"type": "module"`, `export default app` for Vercel)
- MongoDB driver (native, no ODM)
- CORS — only the client origin is allowed

## Project structure

```
index.js    entry — Express app, routes, listen locally (port 5000)
db.js       MongoDB connection with a retry loop (see note below)
```

## Run locally

```bash
cd shopnest-server
npm install
npm run dev
```

Check: http://localhost:5000/ and http://localhost:5000/api/health

## Environment variables

Create `shopnest-server/.env` (values are yours — never commit this file):

| Variable | What it is |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `CLIENT_URL` | `http://localhost:3000` locally, the Vercel client URL in production |

Without `MONGODB_URI` the server still starts and `/api/health` answers `db: "not configured"` — that is normal, it just means no database is connected yet.

## Deployment

- Vercel, project `shopnest-server-fghr`. Deployment Protection is OFF — route-level JWT is the real guard.
- Function Region is **Mumbai (bom1)** — the Atlas cluster lives in Mumbai, and functions running from the default US region timed out on TLS handshakes to it.
- **Free-tier note (Atlas M0):** the cluster answers Vercel only sometimes. `db.js` retries the connection (6 attempts, a few seconds apart) and the auth code warms the database in the background, so a cold server instance may answer `Database not connected` on the first hit or two — refresh and it lands. If this flakiness ever outgrows the retry loop, the next step is upgrading the cluster off M0 (Flex / M10, paid).
- After changing env vars, redeploy — the Vercel CLI (`vercel env rm` / `vercel env add`) is the reliable route for saving them.

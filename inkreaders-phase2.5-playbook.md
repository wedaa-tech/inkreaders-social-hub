
# InkReaders – Phase 2.5 (OAuth + “Connect Bluesky”) Backend Debug & Validation Playbook

This doc captures the exact **cURL recipes**, **expected responses**, and **debug steps** we used to validate:
- Cookie-based Bluesky session (`ink_sid`) against the Go backend
- “For You” vs “Following (You)” feeds
- Posting & engagements (like/repost/reply)
- Helpful headers and logs to differentiate **app** vs **user** identity

> **Local assumptions**
> - Backend runs at `http://localhost:8080`
> - Frontend runs at `http://localhost:3000`
> - Cookies are **allowed** by CORS (backend `AllowCredentials: true` and front-end requests use `credentials: "include"`)
> - On localhost, the auth cookie is set with `Secure=false`

---

## 0) Environment sanity

**Backend `.env` (example)**
```env
BLUESKY_SERVICE=https://bsky.social
BLUESKY_HANDLE=inkreaders.com
BLUESKY_APP_PASSWORD=****
PORT=8080

DB_DSN=postgres://ink:ink@localhost:5432/inkreaders?sslmode=disable

PDS_DEFAULT=https://bsky.social
APP_ENC_KEY=base64-32-byte-secret==
COOKIE_DOMAIN=localhost
```

**Frontend `env.local` (example)**
```env
NEXT_PUBLIC_API_BASE=http://localhost:8080

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=base64-32-byte-secret==

# OAuth providers (if enabled)
GOOGLE_ID=...
GOOGLE_SECRET=...
GITHUB_ID=...
GITHUB_SECRET=...
```

> **Note:** On localhost we purposely set the session cookie as **Secure=false** so the browser will actually store it on `http://` origins.

---

## 1) Health & basic wiring

```bash
# Backend health
curl -i http://localhost:8080/healthz
# 200 OK
```

```bash
# Who-am-I debug (exists only in dev builds)
curl -i "http://localhost:8080/api/debug/who"
# 200 OK
# {"hasSession":false}  (until you log in)
```

---

## 2) Bluesky login (server-side session)

> Uses Bluesky **app password** (not account password). Returns an `ink_sid` cookie.

```bash
# Create a Bluesky session and store cookies
curl -i -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"identifier":"<your-handle-or-email>","appPassword":"<your-app-password>"}' \
  http://localhost:8080/api/auth/login

# Expect: 200 OK, Set-Cookie: ink_sid=<uuid>; Path=/; HttpOnly; SameSite=Lax; Secure?=false on localhost
```

Verify the cookie was set and resolvable:

```bash
# Without cookies
curl -i "http://localhost:8080/api/auth/me"
# 401 Unauthorized

# With cookies
curl -i -b cookies.txt "http://localhost:8080/api/auth/me"
# 200 OK
# {"did":"did:plc:...","handle":"your.handle","pds":"https://bsky.social"}
```

Also validate the `who` probe:

```bash
curl -i -b cookies.txt "http://localhost:8080/api/debug/who"
# 200 OK
# {"hasSession":true}
```

Logout clears the session:

```bash
curl -i -X POST -b cookies.txt http://localhost:8080/api/auth/logout
# 204 No Content

# Confirm logout:
curl -i -b cookies.txt "http://localhost:8080/api/auth/me"
# 401 Unauthorized
```

---

## 3) Timeline validation (For You vs Following (You))

The backend sets response header **`X-IR-Source`** to reveal which identity served the feed:

- `X-IR-Source: app` → served by InkReaders app account
- `X-IR-Source: user` → served by the user’s Bluesky session

### 3.a) For You (app identity)

```bash
curl -i "http://localhost:8080/api/bsky/timeline?limit=5&source=app"
# 200 OK
# X-IR-Source: app
# { "feed": [ ... ] }
```

### 3.b) Following (You) with no Bluesky session

```bash
curl -i "http://localhost:8080/api/bsky/timeline?limit=5&source=user"
# 401 Unauthorized
# (Frontend shows “Connect Bluesky to see your following feed” + empty state)
```

### 3.c) Following (You) with Bluesky session

```bash
# Log in first to get cookies (see §2), then:
curl -i -b cookies.txt "http://localhost:8080/api/bsky/timeline?limit=5&source=user"
# 200 OK
# X-IR-Source: user
# { "feed": [ ... your following ... ] }
```

> If you omit `source=...`, the server supports `source=auto`:
> - If a session exists → behaves like `user`
> - Otherwise → behaves like `app`

```bash
curl -i -b cookies.txt "http://localhost:8080/api/bsky/timeline?limit=5&source=auto"
# 200 OK, X-IR-Source: user
```

---

## 4) Posting & engagements

> The backend now prefers the **user session** when a Bluesky cookie is present; otherwise it falls back to the **app account**. The response contains the created record’s URI/CID.

### 4.a) Post

```bash
curl -i -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from InkReaders!"}' \
  http://localhost:8080/api/bsky/post
# 200 OK
# {"URI":"at://...","CID":"..."}
```

### 4.b) Like

```bash
curl -i -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"uri":"at://...","cid":"..."}' \
  http://localhost:8080/api/bsky/like
# 200 OK
```

### 4.c) Repost

```bash
curl -i -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"uri":"at://...","cid":"..."}' \
  http://localhost:8080/api/bsky/repost
# 200 OK
```

### 4.d) Reply

```bash
curl -i -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"parentUri":"at://...","parentCid":"...","text":"Nice post!"}' \
  http://localhost:8080/api/bsky/reply
# 200 OK
```

### 4.e) Post stats

```bash
curl -i "http://localhost:8080/api/bsky/post-stats?uri=at://..."
# 200 OK
# {"likes":N,"reposts":M,"replies":K}
```

---

## 5) Bookmarks (client-first)

The UI performs an **optimistic local toggle** and then optionally calls an API. If your route isn’t wired yet, a 404 is swallowed by the client (so the star still works locally).

```bash
# (Optional) If you wired it:
curl -i -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"postUri":"at://..."}' \
  http://localhost:8080/api/bookmarks/toggle
# 200 OK (or 404 if not implemented yet; UI tolerates missing route)
```

---

## 6) Headers & logs to check

- **Response header** `X-IR-Source` (added by the backend timeline handler):
  - `app` → For You (InkReaders identity)
  - `user` → Following (You) (browser cookie session)
- **Console logs in the browser** (from `FeedClient.tsx`):
  - `[timeline] start` with `{ feedSource }`
  - `[timeline] resp` (status)
  - `[timeline] servedBy` (reflects `X-IR-Source` when 200)
- **Network tab** should show requests hitting `http://localhost:8080/...` (not relative Next routes) for consistency.

---

## 7) Common pitfalls & quick fixes

1. **Cookie not set on localhost**
   - Ensure backend sets `Secure=false` on localhost; this is already handled by checking `COOKIE_DOMAIN` (empty ⇒ Secure=false).  
   - CORS must allow credentials; client fetches must use `credentials:"include"`.

2. **401 while expecting Following (You)**
   - You’re not logged in to Bluesky at the backend. Re-run §2 login, then retry §3.c.

3. **Following tab shows app feed**
   - Fixed: frontend no longer auto-falls-back to app on 401; it keeps the “Following (You)” tab, shows banner, and leaves feed empty until connected.

4. **NextAuth vs Bluesky session**
   - NextAuth (Google/GitHub) is *separate* from Bluesky server session.  
   - “Connect Bluesky” = POST `/api/auth/login` with Bluesky app password (or future OAuth-on-PDS if available).

---

## 8) Minimal regression checklist

- [ ] `GET /healthz` → 200
- [ ] `GET /api/debug/who` → `{"hasSession":false}` when logged out; `true` when logged in
- [ ] `POST /api/auth/login` with app password returns Set-Cookie `ink_sid`
- [ ] `GET /api/auth/me` → 200 with DID/handle when logged in; 401 when not
- [ ] `GET /api/bsky/timeline?source=app` → 200, `X-IR-Source: app`
- [ ] `GET /api/bsky/timeline?source=user` → 200 + `X-IR-Source: user` (when logged in) / 401 (when not)
- [ ] Like/Repost/Reply use user session when present, otherwise app account
- [ ] Posting works under both identities
- [ ] Frontend “Following (You)” stays selectable without connection and shows banner + empty feed on 401

---

**Happy shipping!** Keep this playbook beside your terminal; you can validate the full end-to-end path in under a minute.

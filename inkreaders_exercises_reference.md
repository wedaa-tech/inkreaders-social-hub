# 📘 Inkreaders Social Hub — Exercises Backend & ATProto Integration

This document captures the **current state of the backend API, ATProto wiring, and curl test commands** we’ve built so far for the *Exercises* feature.

---

## 1. Environment Setup

Set the following in `.env`:

```bash
BLUESKY_SERVICE=https://bsky.social
BLUESKY_HANDLE=your-app-handle.bsky.social
BLUESKY_APP_PASSWORD=your-app-password
APP_ENC_KEY=32-byte-secret-key
PDS_DEFAULT=https://bsky.social
DB_DSN=postgres://user:pass@localhost:5432/inkreaders
PORT=8080
```

Run the server:

```bash
go run ./cmd/server
```

---

## 2. Authentication

### Login (creates `ink_sid` cookie)

```bash
curl -X POST http://localhost:8080/api/auth/login   -H "Content-Type: application/json"   -d '{"identifier":"your-handle.bsky.social","appPassword":"your-app-password"}'   -c cookie.txt
```

The session cookie `ink_sid` will be stored in `cookie.txt`.

### Check current session

```bash
curl -X GET http://localhost:8080/api/auth/me   -b cookie.txt | jq
```

---

## 3. Exercise API Flow

### Step 1. Generate Exercises

```bash
curl -X POST http://localhost:8080/api/exercises/generate   -H "Content-Type: application/json"   -b cookie.txt   -d '{
    "title": "Current Affairs Quiz",
    "topic": "Space",
    "formats": ["mcq"],
    "count": 5,
    "difficulty": "easy",
    "language": "en",
    "source": {"type":"topic"}
  }' | jq
```

Response:

```json
{
  "exercise_set": {
    "id": "generated-uuid",
    "title": "Current Affairs Quiz",
    "format": "mcq",
    "questions": [ ... ]
  }
}
```

---

### Step 2. Save to DB

```bash
curl -X POST http://localhost:8080/api/exercises/save   -H "Content-Type: application/json"   -b cookie.txt   -d '{
    "exercise_set": {
      "id": "generated-uuid",
      "title": "Current Affairs Quiz",
      "format": "mcq",
      "questions": [
        {"q": "Who launched Chandrayaan-3?", "options":["NASA","ISRO","ESA"], "answer":"ISRO"}
      ],
      "meta": {
        "difficulty":"easy",
        "language":"en",
        "source":{"type":"topic","topic":"Space"}
      }
    },
    "visibility": "private"
  }' | jq
```

---

### Step 3. List My Exercises

```bash
curl -X GET http://localhost:8080/api/exercises/mine   -b cookie.txt | jq
```

---

### Step 4. Publish to ATProto

```bash
curl -X POST http://localhost:8080/api/exercises/{id}/publish   -H "Content-Type: application/json"   -b cookie.txt   -d '{"to_feed":true,"allow_remix":true}' | jq
```

Response example:

```json
{
  "at_uri": "at://did:plc:matwoj635dvtorkqxgzw7sti/com.inkreaders.exercise.post/3lxquuczcd424",
  "cid": "bafyreifknhdkdlxiglls23qocujyb7o57rk54uobyqekuiwegmnhhbm6we"
}
```

---

## 4. Verify on ATProto

### Get a published record

```bash
ACCESS_JWT="paste-agent-access-jwt"

curl -s "https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=did:plc:matwoj635dvtorkqxgzw7sti&collection=com.inkreaders.exercise.post&rkey=3lxquuczcd424"   -H "Authorization: Bearer $ACCESS_JWT" | jq
```

### List all published exercises

```bash
curl -s "https://bsky.social/xrpc/com.atproto.repo.listRecords?repo=did:plc:matwoj635dvtorkqxgzw7sti&collection=com.inkreaders.exercise.post&limit=5"   -H "Authorization: Bearer $ACCESS_JWT" | jq
```

---

## 5. Data Model (Postgres)

### exercise_sets

```sql
CREATE TABLE exercise_sets (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES accounts(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  format      TEXT NOT NULL,
  questions   JSONB NOT NULL,
  meta        JSONB,
  visibility  TEXT DEFAULT 'private',
  parent_set_id UUID,
  at_uri      TEXT,
  cid         TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_exercise_sets_user_id ON exercise_sets(user_id);
CREATE INDEX idx_exercise_sets_created_at ON exercise_sets(created_at);
```

### files

```sql
CREATE TABLE files (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES accounts(id) ON DELETE CASCADE,
  mime        TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  pages       INT,
  chars       INT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. Flow Recap

1. **Generate** → AI builds questions (OpenAI).
2. **Save** → persist into `exercise_sets`.
3. **Publish** → pushes record to ATProto (`com.inkreaders.exercise.post`).
4. **Discover** → others can view/like/remix via Bluesky ecosystem.

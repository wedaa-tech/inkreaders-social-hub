# Project Context: Inkreaders Backend

## Overview
- **Language/Framework**: Go (Golang)
- **Architecture**: REST API backend
- **Database**: PostgreSQL with `pgvector`
- **Auth**: JWT-based (github.com/golang-jwt/jwt/v5)
- **Frontend**: React (separate repo)
- **Hosting**: Local dev for now, planning Docker + cloud later

## Directory Structure
/cmd/server # Main entry point
/internal/http # Handlers, auth middleware
/internal/db # Database connection & queries
/internal/models # Data models
/internal/services # Business logic




## Key Packages
- `github.com/golang-jwt/jwt/v5` – JWT auth
- `github.com/jackc/pgx/v5` – PostgreSQL driver
- `github.com/pgvector/pgvector-go` – Vector embeddings

## Current Features
- User authentication (login, signup)
- Topic & responses API
  - `GET /api/topics/:id/responses`
  - `POST /api/topics/:id/responses`
  - `PATCH /api/responses/:id`

## Current Issues
- Session decode issue with Bearer token
- Need pagination for topic responses
- Notebook layout integration with left panel

## TODO (short-term)
- Add response versioning (`response_versions` table)
- Improve error handling in auth middleware
- Integrate search with pgvector

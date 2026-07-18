# Zinder AI Agent Operational Playbook

## 1. Development Environment
* **Backend**:
  - Language: Python 3.10+ (FastAPI)
  - Running local Redis: `redis-server` (must be running for durable auth sessions; memory fallback exists)
  - Dependencies: install via `pip install -r backend/requirements.txt`
  - Start services from `backend/`:
    - Profile: `uvicorn profile_service.main:app --reload --port 8081`
    - Matcher: `uvicorn matcher_service.main:app --reload --port 8082`
    - Chat: `uvicorn chat_service.main:app --reload --port 8083`
    - Gateway: `uvicorn app.main:app --reload --port 8080`
* **Frontend**:
  - Environment: React 19 + TypeScript + Vite + Tailwind CSS
  - Commands: `npm install` and `npm run dev` (running on `http://localhost:5173`)

## 2. Ports & Databases Map
* **Gateway**: Port `8080` (Proxies all external client traffic)
* **Profile Service**: Port `8081` -> DB: `backend/data/profile.db`
* **Matcher Service**: Port `8082` -> DB: `backend/data/matcher.db`
* **Chat Service**: Port `8083` -> DB: `backend/data/chat.db`

## 3. API Conventions
* **Response Standards**: Match Pydantic schemas. Use standard HTTP status codes (`HTTP_201_CREATED`, `HTTP_401_UNAUTHORIZED`, etc.).
* **Proxying**: The Gateway proxies requests downstream using `httpx.AsyncClient`. All internal routing addresses must resolve to `localhost` (e.g. `http://localhost:8081`).
* **Internal auth**: Every gateway → service call must send `X-Internal-Secret` (env `INTERNAL_SERVICE_SECRET`) plus `X-User-Id` when acting for a user. Services reject spoofed `X-User-Id` without the secret.
* **Contract source of truth**: `mvpimplementation.md` (includes Phase-2 deviations for the front-end).

## 4. How to Test Changes
* **Automated Tests**: `cd backend && python3 -m pytest tests/ -v`
* **Manual Verification**: Run all 4 services alongside Redis, authenticate, swipe to match, exercise chat REST/WS, project status transitions.

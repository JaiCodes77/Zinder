# Zinder AI Agent Operational Playbook

## 1. Development Environment
* **Backend**:
  - Language: Python 3.10+ (FastAPI)
  - Running local Redis: `redis-server` (must be running for auth sessions)
  - Dependencies: install via `pip install -r backend/requirements.txt`
  - Start Gateway: `uvicorn app.main:app --reload --port 8080`
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

## 4. How to Test Changes
* **Automated Tests**: Use `pytest` inside the microservice folders.
* **Manual Verification**: Run all 4 services alongside Redis, authenticate a test profile, swipe to match, and test WebSocket chats.

# Nova

Nova is a full-stack, privacy-first menstrual health tracker with:

- Backend: Spring Boot 3, Java 17, MySQL, JWT + refresh cookies, ONNX prediction endpoint
- Frontend: Next.js 16 (App Router), encrypted data handling on the client, dashboard + onboarding flow

## Repository Structure

- `backend`: Java API and prediction service
- `frontend`: Next.js web app
- `docker-compose.yml`: local backend + MySQL stack
- `scripts/smoke-test.mjs`: post-deploy API smoke test

## Environment Setup

1. Copy templates:
	- `cp .env.example .env` (root for Docker Compose)
	- `cp backend/.env.example backend/.env`
	- `cp frontend/.env.example frontend/.env.local`
2. Set strong secrets:
	- `JWT_SECRET` must be 32+ chars
3. For production:
	- Set `APP_CORS_ALLOWED_ORIGINS` to your frontend URL(s)
	- Set `AUTH_REFRESH_COOKIE_SECURE=true`
	- Set `AUTH_REFRESH_COOKIE_SAMESITE=None` when the frontend is on Vercel and the backend is on AWS
	- Set `NEXT_PUBLIC_API_BASE_URL` to your deployed backend URL

## Suggested Deployment Split

Frontend on Vercel:

- `NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain`

Backend on AWS:

- `APP_CORS_ALLOWED_ORIGINS=https://your-frontend-domain`
- `AUTH_REFRESH_COOKIE_SECURE=true`
- `AUTH_REFRESH_COOKIE_SAMESITE=None`
- `JWT_SECRET` set to a strong production secret
- Database connection variables point at your managed MySQL instance

The frontend already sends requests with credentials enabled, so once the cookie settings above are in place, refresh and logout will work across the two hosts.

## Local Development

### Option A: Docker (backend + DB)

From repo root:

```bash
docker compose up --build
```

Backend runs on `http://localhost:8081`.

### Option B: Run services separately

Backend:

```bash
cd backend
./mvnw spring-boot:run
```

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

Frontend runs on `http://localhost:3000`.

## Quality Gates

Backend tests:

```bash
cd backend
./mvnw test
```

Frontend production build:

```bash
cd frontend
npm ci
npm run build
```

## CI

GitHub Actions workflow at `.github/workflows/ci.yml` runs:

- Backend unit/integration tests
- Frontend production build

## Post-Deploy Smoke Test

Run after backend deployment:

```bash
node scripts/smoke-test.mjs
```

Supported environment variables:

- `SMOKE_BASE_URL` (default: `http://localhost:8081`)
- `SMOKE_EMAIL` (optional, otherwise auto-generated)
- `SMOKE_PASSWORD` (default: `StrongPass123`)

The smoke test validates health, register/login, cycle log save/list, and prediction endpoints.
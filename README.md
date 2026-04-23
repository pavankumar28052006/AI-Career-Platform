# AI Career Intelligence Platform

![CI](https://github.com/pavan/ai-career-platform/actions/workflows/ci.yml/badge.svg)

AI Career Intelligence Platform is a full-stack application that turns resumes into structured skill intelligence. It extracts skills, builds a knowledge graph, identifies skill gaps, and generates role-oriented career recommendations.

## Overview

The system combines a React frontend, a FastAPI backend, a Redis-backed worker queue, and Neo4j for graph relationships. Skill extraction uses deterministic NLP with AI fallback when needed, which keeps the workflow fast while preserving recall.

## Key Capabilities

- Resume upload with asynchronous background processing.
- Skill extraction and normalization from uploaded documents.
- Knowledge graph visualization for skills and relationships.
- Skill-gap analysis against target roles.
- AI-assisted career roadmap recommendations.
- JWT-based authentication and polling-based job status updates.

## Architecture

```text
[ React + Vite Frontend ] <---- REST API / polling ----> [ FastAPI Backend ]
           |                                                   |        |
    [ UI animation ]                                      [ Redis ]  [ Neo4j ]
                                                                |        |
                                                         [ arq worker ]  |
                                                                |        |
                                                       [ SpaCy / OpenAI ]
```

## Repository Structure

- `backend/` - FastAPI application, worker process, data models, services, and tests.
- `frontend/` - React application, UI components, state stores, and component tests.
- `docker-compose.yml` - Local orchestration for the full stack.
- `.github/workflows/` - CI workflow.

## Quick Start

The simplest way to run the project is with Docker Compose.

```bash
docker-compose up --build
```

After startup, the main endpoints are:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs
- Neo4j Browser: http://localhost:7474

Default Neo4j credentials in the compose setup are `neo4j` / `changeme`.

## Environment Setup

Copy the backend example environment file before running the app locally:

```bash
cp backend/.env.example backend/.env
```

For the frontend, copy the example file if you plan to run it outside Docker:

```bash
cp frontend/.env.example frontend/.env
```

### Backend variables

| Variable | Purpose | Example |
| :--- | :--- | :--- |
| `OPENAI_API_KEY` | OpenAI API key used for AI fallback | `sk-proj-...` |
| `NEO4J_URI` | Neo4j connection URI | `bolt://neo4j:7687` |
| `NEO4J_USER` | Neo4j username | `neo4j` |
| `NEO4J_PASSWORD` | Neo4j password | `changeme` |
| `REDIS_URL` | Redis connection string | `redis://redis:6379/0` |
| `SECRET_KEY` | JWT signing secret | `your-super-secret-key` |
| `LOG_LEVEL` | Application logging level | `INFO` |
| `APP_ENV` | Runtime environment | `development` |

### Frontend variables

| Variable | Purpose | Example |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:8000` |

## Local Development

### Backend

```bash
cd backend
pip install -r requirements.txt
pytest --cov=. --cov-report=term-missing
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

| Method | Path | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | No | Create a new account |
| `POST` | `/api/auth/login` | No | Issue a JWT access token |
| `POST` | `/api/resume/upload` | Yes | Upload a resume and start processing |
| `GET` | `/api/resume/status/{id}` | Yes | Check asynchronous job status |
| `GET` | `/api/graph/skills` | Yes | List skill nodes |
| `GET` | `/api/graph/paths/{role}` | Yes | Resolve career paths in the graph |
| `POST` | `/api/analysis/gap` | Yes | Compute skill gaps for a target role |
| `POST` | `/api/analysis/recommend` | Yes | Generate career recommendations |

## Testing

- Backend: `cd backend && pytest --cov=. --cov-report=term-missing`
- Frontend: `cd frontend && npm run test`

## Deployment Notes

- The repository includes a GitHub Actions workflow at `.github/workflows/ci.yml`.
- Set `APP_ENV=production` and review `CORS_ORIGINS` before deploying outside local Docker.
- Store secrets such as `OPENAI_API_KEY` in your deployment platform or GitHub repository secrets.

## Technology Stack

- Backend: Python 3.11, FastAPI, Pydantic, arq
- Frontend: React 19, Vite, TypeScript, Framer Motion
- Storage and queues: Neo4j, Redis
- NLP and AI: SpaCy, OpenAI
- Delivery: Docker, GitHub Actions

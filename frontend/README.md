# Frontend

This package contains the React frontend for the AI Career Intelligence Platform. It provides the user interface for resume upload, skill-graph exploration, skill-gap analysis, and career roadmap recommendations.

## Requirements

- Node.js 20 or later
- npm 10 or later

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The development server runs at http://localhost:5173 by default.

## Environment Variables

| Variable | Purpose | Default |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:8000` |

## Available Scripts

| Script | Description |
| :--- | :--- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and build production assets |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint across the frontend codebase |
| `npm run test` | Run Vitest once |

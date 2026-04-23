# 🎨 PropelPro AI | Frontend Presentation Layer

This module houses the client-side architecture for the **PropelPro AI** Career Intelligence Platform. Engineered for maximum performance, responsiveness, and fluid user experience, this frontend acts as the core interface where users upload resumes, visualize their skill graphs, and interact dynamically with AI-generated career roadmaps.

## ⚡ Technology Stack

Constructed using industry-best practices for modern web applications:
- **Core Framework:** React 19 & TypeScript
- **Build Engine:** Vite (For lightning-fast HMR and optimized production bundles)
- **Styling Architecture:** Modern Vanilla CSS augmented with standard structural utility patterns.
- **Animations:** Framer Motion capabilities for premium, hardware-accelerated micro-animations.
- **State Management:** Highly decoupled Context API / Zustand stores ensuring minimal re-renders.

## 🛠️ Engineering Setup

Ensure your local development environment meets the enterprise requirements:
- **Node.js:** v20.x or higher
- **Package Manager:** npm v10.x or higher

### Initialization Sequence

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Configuration:**
   Establish local environment variables to connect to the microservice API.
   ```bash
   cp .env.example .env
   ```
   > **Note:** By default, `VITE_API_BASE_URL` is configured to target `http://localhost:8000`. Adjust this if your FastAPI downstream is hosted remotely.

3. **Ignite Development Server:**
   ```bash
   npm run dev
   ```
   *The application will boot up and be accessible locally at [http://localhost:5173](http://localhost:5173).*

## 📜 Available Command Scripts

The following commands are wired into the underlying build system for rapid development, testing, and deployment:

| Command | Execution Purpose |
| :--- | :--- |
| `npm run dev` | Instantiates the Vite development server with Hot Module Replacement. |
| `npm run build` | Compiles a highly optimized, minified production build into the `dist/` folder. |
| `npm run preview` | Emulates a production environment locally to preview the built assets. |
| `npm run lint` | Executes strict ESLint rules across the TypeScript codebase to ensure compliance. |
| `npm run test` | Triggers the Vitest test runner to ensure UI component integrity and logic validation. |

## 📐 Architecture & Component Design

The frontend is structured to maximize modularity and code reusability. 
- **Components (`/src/components`):** Reusable UI elements decoupled from heavy business logic.
- **Data Hooks & Services (`/src/api` & `/src/store`):** Segregated state and side-effect layers tailored to effortlessly sync with the asynchronous AI response endpoints without freezing the main UI thread.

# SLAM Docs - Project Context & Instructions

## Project Overview
This repository contains the official documentation for **SLaM (Smart Learning and Mathematics)**, an AI-powered, adaptive learning system for mathematics (grades 5–13). 

The project follows a 3-tier architecture:
- **Frontend (Student App):** Flutter (Mobile/Web) using Riverpod for state management and Material 3 design.
- **Backend (API):** Cloudflare Workers (TypeScript/Hono) for AI orchestration and data validation.
- **Teacher Platform:** React (Vite/TypeScript) for analytics and class management.
- **AI Models:** Claude (Sonnet/Haiku) and Gemini (Pro/Flash) for question generation and feedback.

## Directory Structure
- `docs/`: Markdown files containing the documentation.
    - `index.md`: Homepage and general overview.
    - `architecture.md`: Detailed system architecture and data flow.
    - `app.md`: Technical details of the Flutter student app.
    - `backend.md`: API and backend logic details.
    - `teacher.md`: Teacher platform documentation.
    - `technical/`: Deep dives into specific systems (e.g., animations, haptics).
- `mkdocs.yml`: Configuration for the MkDocs documentation generator.

## Key Technologies
- **Documentation Generator:** [MkDocs](https://www.mkdocs.org/)
- **Theme:** `shadcn` (MkDocs theme)
- **Diagrams:** Mermaid.js (embedded in Markdown)
- **Deployment:** GitHub Pages (docs.learn-smart.app)

## Development Workflow

### Building and Running Locally
To preview the documentation locally:
1. Ensure you have Python and MkDocs installed.
2. Install dependencies:
   ```bash
   pip install mkdocs-material # or the specific shadcn theme requirements
   ```
3. Run the development server:
   ```bash
   mkdocs serve
   ```
4. Open `http://127.0.0.1:8000` in your browser.

### Documentation Conventions
- **Language:** German (Primary for user-facing content) and English (Technical details/internal docs).
- **Formatting:** Use standard Markdown.
- **Diagrams:** Use Mermaid.js syntax for flowcharts and sequence diagrams.
- **Technical Accuracy:** Ensure that changes in the actual app repositories (`slam-app`, `slam-api`) are reflected here.

## Project Repositories
- **App Code:** [Seminarkurs-Lernapp-Mathematik/slam-app](https://github.com/Seminarkurs-Lernapp-Mathematik/slam-app)
- **Docs (This Repo):** [Seminarkurs-Lernapp-Mathematik/slam-docs](https://github.com/Seminarkurs-Lernapp-Mathematik/slam-docs)

## AI Assistance Instructions
When helping with this project:
- Refer to `docs/architecture.md` for system-wide patterns.
- Refer to `docs/app.md` for Flutter/Riverpod specific conventions.
- Maintain the professional yet educational tone used in the existing documentation.
- Always use Mermaid.js for architectural visualizations.

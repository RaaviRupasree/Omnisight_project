# OmniSight: Multimodal UI Self-Healing & Autonomous RPA Agent

OmniSight is an intelligent end-to-end UI testing and self-healing agent pipeline. Traditional automated tests rely on brittle DOM selectors and cannot detect visual anomalies (e.g., text overlap, clipping outside mobile viewports, low contrast). OmniSight bridges this gap by combining **headless browser automation (Playwright)**, **Vision-Language Models (VLM)**, and **automated Git PR generation** to detect visual bugs and automatically heal them.

---

## 🌟 Key Features

1. **Multimodal Visual Auditing**: Captures high-fidelity screenshots across responsive device viewports (Mobile 390x844, Desktop 1280x800).
2. **Spatial DOM Extraction**: Coordinates bounding boxes and CSS computed styles with screenshot imagery for precise VLM spatial reasoning.
3. **Autonomous Self-Healing Loop**: Generates CSS patches, injects them into the browser context, re-audits the repaired layout, and retries if necessary.
4. **Automated Git PR Management**: Creates local Git branches, generates patch commits, and exposes merge/decline actions via API.
5. **Interactive React/Vite Dashboard**: Real-time agent console, before/after screenshot comparisons, visual diff inspection, and one-click PR review.
6. **Mock Target Application**: Included e-commerce target app (`/static/mock_site`) featuring selectable bug triggers (clipping, overlap, contrast).

---

## 📁 Repository Structure

```
project of new/
├── backend/
│   ├── app.py              # FastAPI server & CI/CD Orchestrator
│   ├── navigator.py        # Playwright headless browser automation
│   ├── vlm_agent.py        # Multimodal Vision-Language Model interface
│   ├── git_manager.py      # Git branch, commit, and diff manager
│   ├── requirements.txt    # Python backend dependencies
│   └── static/
│       ├── mock_site/      # Target e-commerce test application
│       └── db.json         # Flat-file database for persistent scans & PRs
├── dashboard/
│   ├── src/                # React dashboard source code
│   ├── package.json        # Frontend dependencies
│   └── vite.config.js      # Vite build configuration
├── docs/
│   ├── omnisight_week1_week2_documentation.md  # Phase 1 & 2 documentation
│   └── omnisight_week3_week4_documentation.md  # Phase 3 & 4 documentation
└── README.md
```

---

## 🚀 Quickstart Guide

### 1. Backend Setup (FastAPI & Playwright)

```bash
cd backend

# Create & activate virtual environment (optional)
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browser binaries
playwright install chromium

# Start the FastAPI backend
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload --loop asyncio
```

The backend will be available at:
- **API Server**: `http://localhost:8000`
- **Swagger Documentation**: `http://localhost:8000/docs`
- **Mock Target App**: `http://localhost:8000/static/mock_site/index.html`

### 2. Frontend Setup (React / Vite Dashboard)

```bash
cd dashboard

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

The dashboard will be available at:
- **Dashboard UI**: `http://localhost:5173`

---

## 🛠️ How It Works

1. Open `http://localhost:5173`.
2. Select a target bug (e.g., *Button Clipping*, *Text Overlap*, or *Low Contrast*) and a viewport (Mobile/Desktop).
3. Click **"Run Visual Audit & Heal"**.
4. Watch the live Agent Console execute:
   - **Step 1:** Playwright captures before-state screenshots & extracts DOM tree coordinates.
   - **Step 2:** VLM analyzes the visual layout and determines anomaly coordinates and root causes.
   - **Step 3:** The Self-Healing loop generates and injects targeted CSS patches into the browser.
   - **Step 4:** A secondary audit confirms the fix.
   - **Step 5:** A Git branch and Pull Request are generated with before/after visual proof.
5. Review and merge the Pull Request directly in the dashboard!

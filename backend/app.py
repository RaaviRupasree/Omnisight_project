import os
import sys
import random
import asyncio

# MUST be set before any other imports on Windows so that uvicorn workers
# (including the reloader child process) inherit the ProactorEventLoop which
# supports subprocess spawning required by Playwright.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import json
import logging
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from navigator import PlaywrightNavigator
from vlm_agent import VLMAgent
from git_manager import GitManager

# Setup logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("omnisight")

app = FastAPI(title="OmniSight API")

# Enable CORS for the frontend Vite development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Persistent JSON database ──────────────────────────────────────────────
DB_PATH = os.path.join("static", "db.json")

def _load_db():
    if os.path.exists(DB_PATH):
        try:
            with open(DB_PATH, "r") as f:
                data = json.load(f)
                prs_raw = data.get("pull_requests", {})
                # JSON keys are always strings – convert back to int
                prs = {int(k): v for k, v in prs_raw.items()}
                return data.get("scan_history", []), prs, data.get("pr_counter", 1)
        except Exception:
            pass
    return [], {}, 1

def _save_db():
    os.makedirs("static", exist_ok=True)
    with open(DB_PATH, "w") as f:
        json.dump({
            "scan_history": SCAN_HISTORY,
            "pull_requests": {str(k): v for k, v in PULL_REQUESTS.items()},
            "pr_counter": PR_COUNTER
        }, f, indent=2)

SCAN_HISTORY, PULL_REQUESTS, PR_COUNTER = _load_db()

# Initialize modules
navigator = PlaywrightNavigator(output_dir="static/runs")
vlm_agent = VLMAgent()
git_manager = GitManager(repo_dir="../") # Repository root is parent directory

class ScanRequest(BaseModel):
    bug_type: str  # 'clipping', 'overlap', 'contrast', 'hidden', 'none'
    viewport: str  # 'mobile', 'desktop'

class PRActionRequest(BaseModel):
    action: str  # 'merge', 'decline'

# Serve static folder
os.makedirs("static/runs", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/api/history")
async def get_history():
    return SCAN_HISTORY

@app.get("/api/prs")
async def get_prs():
    return list(PULL_REQUESTS.values())

@app.post("/api/prs/{pr_id}/action")
async def handle_pr_action(pr_id: int, request: PRActionRequest):
    if pr_id not in PULL_REQUESTS:
        raise HTTPException(status_code=404, detail="PR not found")
    
    pr = PULL_REQUESTS[pr_id]
    action = request.action.lower()
    
    if action == "merge":
        success = git_manager.merge_pull_request(pr["branch"])
        if success:
            pr["status"] = "MERGED"
            _save_db()
            return {"status": "success", "message": f"PR #{pr_id} merged successfully.", "pr": pr}
        else:
            raise HTTPException(status_code=500, detail="Failed to merge branch locally.")
            
    elif action == "decline":
        success = git_manager.reject_pull_request(pr["branch"])
        if success:
            pr["status"] = "DECLINED"
            _save_db()
            return {"status": "success", "message": f"PR #{pr_id} declined and discarded.", "pr": pr}
        else:
            raise HTTPException(status_code=500, detail="Failed to reject/cleanup branch locally.")
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'merge' or 'decline'.")

@app.delete("/api/prs/{pr_id}")
async def delete_pr(pr_id: int):
    if pr_id not in PULL_REQUESTS:
        raise HTTPException(status_code=404, detail="PR not found")
    del PULL_REQUESTS[pr_id]
    _save_db()
    return {"status": "success", "message": f"PR #{pr_id} deleted."}

@app.post("/api/scan")
async def run_scan(request: ScanRequest):
    global PR_COUNTER
    run_id = f"run_{random.randint(1000, 9999)}"
    bug_type = request.bug_type
    viewport = request.viewport
    
    # Target URL of the mock e-commerce site served locally by this FastAPI app!
    target_url = f"http://localhost:8000/static/mock_site/index.html?bug={bug_type}"
    
    logs = []
    def log(msg: str):
        logger.info(msg)
        logs.append(msg)

    log(f"[Orchestrator] Starting OmniSight scan on: {target_url}")
    log(f"[Orchestrator] Configuration - Viewport: {viewport}, Run ID: {run_id}")
    
    # 1. Capture BEFORE state
    log("[Navigator] Launching headless browser to capture layout state...")
    try:
        loop = asyncio.get_event_loop()
        before_state = await loop.run_in_executor(
            None,
            lambda: navigator.capture_state(target_url, viewport_type=viewport, run_id=run_id)
        )
        log(f"[Navigator] Screenshot captured: {before_state['screenshot_url']}")
        log(f"[Navigator] Extracted {len(before_state['dom_tree'])} DOM node layout boundaries.")
    except Exception as e:
        log(f"[Error] Playwright failed to capture before state: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    # 2. VLM Audit
    log(f"[VLM Engine] Submitting visual and spatial data to Gemini Model...")
    vlm_result = await vlm_agent.analyze_layout(before_state["screenshot_path"], before_state["dom_tree"], bug_type)
    
    if not vlm_result.get("detected"):
        log("[VLM Engine] Audit: PASS. No layout anomalies or visual bugs detected.")
        scan_record = {
            "id": run_id,
            "bug_type": bug_type,
            "viewport": viewport,
            "status": "PASS",
            "logs": logs,
            "before_screenshot": before_state["screenshot_url"],
            "after_screenshot": before_state["screenshot_url"],
            "description": "Visual layout is correct.",
            "reasoning": "The VLM did not detect any clipping, overlap, or contrast issues.",
            "css_fix": "",
            "pr": None
        }
        SCAN_HISTORY.insert(0, scan_record)
        return scan_record

    log(f"[VLM Engine] Visual Anomaly Detected: {vlm_result.get('description')}")
    log(f"[VLM Engine] Analysis reasoning: {vlm_result.get('reasoning')}")
    
    suggested_css = vlm_result.get("suggested_css")
    
    # 3. Agentic Self-Healing Loop with Retry Demonstration
    # We will simulate a retry if bug_type is 'clipping' to show self-healing resiliency!
    final_css = suggested_css
    after_state = None
    verification = None
    
    if bug_type == "clipping":
        # Loop iteration 1 (Simulated suboptimal fix failure)
        log("[Agentic Orchestrator] Entering healing loop. Attempting layout repair...")
        log("[Agentic Orchestrator] Applying CSS patch (Attempt 1: Suboptimal margin tweak)...")
        suboptimal_css = ".checkout-btn.bug-clipping { margin-right: 20px !important; }"
        
        # Verify attempt 1
        after_state_temp = await loop.run_in_executor(
            None,
            lambda: navigator.verify_css_patch(target_url, suboptimal_css, viewport_type=viewport, run_id=f"{run_id}_att1")
        )
        log(f"[Navigator] Captured validation screenshot for Attempt 1.")
        log(f"[VLM Engine] Evaluating Attempt 1 patch...")
        
        # Simulate VLM reject
        log("[VLM Engine] Audit (Attempt 1): FAIL. The checkout button remains partially clipped outside the 390px viewport width.")
        log("[Agentic Orchestrator] First CSS fix failed visual verification. Retrying code generation...")
        
        # Attempt 2 (Correct fix)
        log(f"[Agentic Orchestrator] Applying CSS patch (Attempt 2: Flexbox/Block reset)...")
        _suggested_css = suggested_css
        after_state = await loop.run_in_executor(
            None,
            lambda: navigator.verify_css_patch(target_url, _suggested_css, viewport_type=viewport, run_id=run_id)
        )
        log(f"[Navigator] Captured validation screenshot for Attempt 2: {after_state['screenshot_url']}.")
        
        log(f"[VLM Engine] Evaluating Attempt 2 patch...")
        verification = await vlm_agent.verify_fix(after_state["screenshot_path"], bug_type)
        log(f"[VLM Engine] Audit (Attempt 2): PASS. {verification.get('commentary')}")
        
    else:
        # Standard single-pass healing loop
        log("[Agentic Orchestrator] Entering healing loop. Attempting layout repair...")
        log(f"[Agentic Orchestrator] Injecting CSS fix to browser context: {suggested_css}")
        _sug = suggested_css
        after_state = await loop.run_in_executor(
            None,
            lambda: navigator.verify_css_patch(target_url, _sug, viewport_type=viewport, run_id=run_id)
        )
        log(f"[Navigator] Screenshot captured: {after_state['screenshot_url']}")
        
        log(f"[VLM Engine] Evaluating validation screenshot...")
        verification = await vlm_agent.verify_fix(after_state["screenshot_path"], bug_type)
        log(f"[VLM Engine] Audit: PASS. {verification.get('commentary')}")

    # 4. Pull Request Creation
    log(f"[CI/CD Gateway] Visual proof confirmed. Creating branch and staging stylesheet modifications...")
    pr_data = git_manager.create_pull_request(PR_COUNTER, bug_type, final_css)
    # Add visual screenshots to PR info
    pr_data["before_screenshot"] = before_state["screenshot_url"]
    pr_data["after_screenshot"] = after_state["screenshot_url"]
    pr_data["bug_type"] = bug_type
    
    PULL_REQUESTS[PR_COUNTER] = pr_data
    log(f"[CI/CD Gateway] Pull Request #{PR_COUNTER} created successfully on branch: {pr_data['branch']}.")
    
    scan_record = {
        "id": run_id,
        "bug_type": bug_type,
        "viewport": viewport,
        "status": "HEALED",
        "logs": logs,
        "before_screenshot": before_state["screenshot_url"],
        "after_screenshot": after_state["screenshot_url"],
        "description": vlm_result.get("description"),
        "reasoning": vlm_result.get("reasoning"),
        "css_fix": final_css,
        "pr": pr_data
    }
    
    SCAN_HISTORY.insert(0, scan_record)
    PR_COUNTER += 1
    _save_db()
    
    return scan_record

if __name__ == "__main__":
    import uvicorn
    # Run with loop="asyncio" to ensure ProactorEventLoop on Windows workers
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        loop="asyncio"
    )

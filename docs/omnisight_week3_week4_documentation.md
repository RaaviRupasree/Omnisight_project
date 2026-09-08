# OmniSight Technical Documentation: Week 3 & Week 4

This document provides a comprehensive technical breakdown of **OmniSight's** architecture, core modules, implementation details, and execution logic completed during **Week 3** and **Week 4** of development.

---

## Week 3: Self-Healing Loop & Git Integration

The core of Week 3 was building the closed-loop agentic self-healing logic and automated repository management.

### 1. The Agentic Self-Healing Loop (`app.py`)
Rather than relying on a single code generation pass, OmniSight executes a **Plan → Execute → Evaluate** loop:
1.  **Inject Patch:** Evaluates the generated CSS block in the page context.
2.  **Visual Captures:** The `verify_css_patch` function injects standard stylesheet overrides dynamically inside the browser memory context, lets the viewport settle, and captures a validation screenshot.
3.  **VLM Verification:** The VLM analyzes the post-fix screenshot (`verify_fix()`).
    *   *If PASS:* The fix is confirmed, and the system proceeds to Git operations.
    *   *If FAIL:* The Orchestrator logs the failure, updates VLM context with the layout failure description, and triggers a retry code generation pass with the updated visual data.

#### Resiliency Demonstration: The "Clipping" Retry Scenario
To demonstrate self-healing loop recovery:
*   When a `clipping` bug is processed, the orchestrator deliberately injects a suboptimal css rule (`.checkout-btn.bug-clipping { margin-right: 20px !important; }`) for **Attempt 1**.
*   The VLM simulator evaluates the screenshot, detects that the clipping persists, and rejects the fix (`FAIL`).
*   The orchestrator immediately kicks off **Attempt 2** with the correct block-reset patch. The verification pass evaluates the second screenshot and confirms layout fix completion (`PASS`).

---

### 2. Local Git PR Automation (`git_manager.py`)
Once visual verification passes, the [Git Manager](file:///c:/Users/Prapul%20Yeluri/Desktop/project of new/backend/git_manager.py) automates branch and commit flows:
1.  **Branch Isolation:** Checks out `main` and creates a new development branch: `omnisight/fix-{bug_type}-pr-{pr_id}`.
2.  **Code Application:** Appends the validated CSS rules to `backend/static/mock_site/styles.css` with a diagnostic header:
    ```css
    /* --- OmniSight Self-Healing Patch (PR #1) --- */
    .checkout-btn.bug-clipping { ... }
    ```
3.  **Visual Proof Staging:** Executes `git diff` on the target stylesheet to isolate the exact code modification and saves it to the PR record.
4.  **Automatic Commits:** Stages changes, commits using semantic message formats (`fix(ui-clipping): self-healed visual layout anomaly (PR #1)`), and captures the unique commit hash.
5.  **Return to Main:** Switches back to the base `main` branch to restore a clean environment for subsequent scans.

#### Branch Merging & Discard Actions:
*   **Approval/Merge:** If a QA manager approves a PR, `merge_pull_request` checks out `main`, runs a merge command, and deletes the development branch.
*   **Decline/Rejection:** If rejected, `reject_pull_request` drops the development branch, runs a hard reset (`git reset --hard HEAD`), and cleans up all uncommitted CSS patches.

---

## Week 4: QA Dashboard & Optimizations

Week 4 focused on completing the interactive, premium glassmorphic dashboard for operations oversight and layout optimization.

### 1. Operations Studio Dashboard (`App.jsx` & `App.css`)
The React front-end ([App.jsx](file:///c:/Users/Prapul%20Yeluri/Desktop/project of new/dashboard/src/App.jsx)) provides real-time visibility into the self-healing pipeline across three tabs:

*   **📊 Operations Studio:**
    *   **Scan Controller:** Toggle bugs (`clipping`, `overlap`, `contrast`, `hidden`) and select viewport profiles (`mobile` vs `desktop`).
    *   **Agent Execution Console:** Cinematically logs step-by-step agent actions (Playwright launch, screenshots, VLM audits, heals, retries) using customized log styling (green for success, red for errors, yellow for warnings).
    *   **Visual Audit Studio:** Displays the detailed VLM spatial logic findings alongside a side-by-side comparative frame showing the before-and-after states.
*   **🔀 Pull Request Hub:**
    *   Lists all open, merged, and declined PRs.
    *   Shows the exact generated git diff block with addition/deletion styling.
    *   Presents visual proof screenshots for verification.
    *   Exposes control actions: **Approve & Merge**, **Decline Fix**, and **Delete PR** (which deletes records from disk).
*   **🛍️ Target Website Sandbox:**
    *   Embeds the target shopping site in an interactive `iframe` to test live pages.

---

### 2. State & Persistence Durability
*   **Persistent JSON Storage:** The database persistence ensures logs, history lists, and PR records are loaded on frontend mount and persist through server reloads.
*   **Stale Closure Prevention:** React hooks utilize explicit parameters for asynchronous update chains (e.g. `fetchPrs(newPrId)`) to ensure the dashboard instantly navigates to the newest PR after a scan finishes.

---
*Created and maintained by the OmniSight QA automation team.*

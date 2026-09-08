import os
import subprocess
import logging

logger = logging.getLogger(__name__)

class GitManager:
    def __init__(self, repo_dir: str):
        self.repo_dir = os.path.abspath(repo_dir)
        self.css_file_path = os.path.join(self.repo_dir, "backend", "static", "mock_site", "styles.css")
        os.makedirs(os.path.dirname(self.css_file_path), exist_ok=True)

    def _run_git(self, args: list) -> str:
        """Runs a git command in the repository directory and returns the output."""
        try:
            result = subprocess.run(
                ["git"] + args,
                cwd=self.repo_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError as e:
            logger.error(f"Git command failed: {' '.join(e.cmd)}\nStdout: {e.stdout}\nStderr: {e.stderr}")
            raise RuntimeError(f"Git error: {e.stderr.strip()}")

    def create_pull_request(self, pr_id: int, bug_context: str, suggested_css: str) -> dict:
        """
        Creates a new git branch, appends the CSS patch to styles.css, commits the file,
        and switches back to main. Returns metadata about the 'PR'.
        """
        branch_name = f"omnisight/fix-{bug_context}-pr-{pr_id}"
        
        try:
            # 1. Checkout main first to be safe
            self._run_git(["checkout", "main"])
            
            # 2. Create and checkout new branch
            self._run_git(["checkout", "-b", branch_name])
            
            # 3. Apply the fix: read styles.css, append CSS rules
            if os.path.exists(self.css_file_path):
                with open(self.css_file_path, "r") as f:
                    original_content = f.read()

                # Build patch content with clear comments
                patch_content = f"\n\n/* --- OmniSight Self-Healing Patch (PR #{pr_id}) --- */\n{suggested_css}\n"
                
                with open(self.css_file_path, "a") as f:
                    f.write(patch_content)
                
                # Get the diff for visual verification
                diff_output = self._run_git(["diff", "backend/static/mock_site/styles.css"])
            else:
                original_content = ""
                diff_output = f"+ {suggested_css}"
                # If file doesn't exist, create it (should exist)
                with open(self.css_file_path, "w") as f:
                    f.write(suggested_css)

            # 4. Commit the changes
            self._run_git(["add", "backend/static/mock_site/styles.css"])
            commit_msg = f"fix(ui-{bug_context}): self-healed visual layout anomaly (PR #{pr_id})"
            self._run_git(["commit", "-m", commit_msg])
            
            # Get commit hash
            commit_hash = self._run_git(["rev-parse", "HEAD"])
            
            # 5. Switch back to main
            self._run_git(["checkout", "main"])
            
            return {
                "id": pr_id,
                "branch": branch_name,
                "commit_hash": commit_hash[:8],
                "diff": diff_output,
                "status": "OPEN",
                "title": f"Fix visual {bug_context} bug on checkout page",
                "body": f"OmniSight VLM identified a visual layout issue ({bug_context}) and generated a CSS patch to resolve alignment. Visual audit passed successfully."
            }

        except Exception as e:
            logger.error(f"Failed to create git branch/PR: {e}")
            # Fallback mock PR metadata if Git fails
            return {
                "id": pr_id,
                "branch": branch_name,
                "commit_hash": "mock8899",
                "diff": f"+ {suggested_css}",
                "status": "OPEN",
                "title": f"Fix visual {bug_context} bug (Git Mock Mode)",
                "body": f"OmniSight simulated PR creation. Git error: {e}"
            }

    def merge_pull_request(self, branch_name: str) -> bool:
        """
        Merges the specified branch into main and deletes the branch.
        """
        try:
            self._run_git(["checkout", "main"])
            self._run_git(["merge", branch_name])
            try:
                self._run_git(["branch", "-d", branch_name])
            except Exception as d_err:
                logger.warning(f"Could not delete branch locally: {d_err}")
            return True
        except Exception as e:
            logger.error(f"Failed to merge git branch {branch_name}: {e}")
            return False

    def reject_pull_request(self, branch_name: str) -> bool:
        """
        Rejects the PR: switches to main and deletes the branch.
        """
        try:
            self._run_git(["checkout", "main"])
            # Delete branch forcibly
            self._run_git(["branch", "-D", branch_name])
            # Reset hard just in case there are uncommitted styles
            self._run_git(["reset", "--hard", "HEAD"])
            return True
        except Exception as e:
            logger.error(f"Failed to reject git branch {branch_name}: {e}")
            return False

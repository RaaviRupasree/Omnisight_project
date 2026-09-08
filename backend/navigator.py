import os
import sys
import asyncio
import threading
from playwright.async_api import async_playwright


def _run_in_proactor_thread(coro):
    """
    Runs an async coroutine in a brand-new thread that owns a fresh
    ProactorEventLoop (Windows) or default loop (other platforms).
    This sidesteps the issue where uvicorn's reloader child process
    uses a SelectorEventLoop that cannot spawn subprocesses.
    """
    result = {}

    def thread_target():
        if sys.platform == "win32":
            loop = asyncio.ProactorEventLoop()
        else:
            loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result["value"] = loop.run_until_complete(coro)
        except Exception as e:
            result["error"] = e
        finally:
            loop.close()

    t = threading.Thread(target=thread_target, daemon=True)
    t.start()
    t.join(timeout=120)  # 2-minute max per scan

    if "error" in result:
        raise result["error"]
    if "value" not in result:
        raise TimeoutError("Playwright operation timed out after 120 seconds.")
    return result["value"]


class PlaywrightNavigator:
    def __init__(self, output_dir: str = "static/runs"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    def capture_state(self, url: str, viewport_type: str = "mobile", run_id: str = "temp") -> dict:
        """Sync wrapper — runs the async capture in a ProactorEventLoop thread."""
        return _run_in_proactor_thread(self._capture_state_async(url, viewport_type, run_id))

    async def _capture_state_async(self, url: str, viewport_type: str = "mobile", run_id: str = "temp") -> dict:
        """
        Navigates to URL, sets viewport, takes a screenshot, and extracts DOM layout metadata.
        """
        async with async_playwright() as p:
            if viewport_type == "mobile":
                width, height = 390, 844
                user_agent = "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
            else:
                width, height = 1280, 800
                user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": width, "height": height},
                user_agent=user_agent
            )
            page = await context.new_page()

            await page.goto(url, wait_until="networkidle")
            await page.wait_for_timeout(1000)

            screenshot_name = f"{run_id}_before.png"
            screenshot_path = os.path.join(self.output_dir, screenshot_name)
            await page.screenshot(path=screenshot_path, full_page=True)

            dom_tree = await self._extract_dom_tree(page)
            await browser.close()

            return {
                "screenshot_url": f"/static/runs/{screenshot_name}",
                "screenshot_path": screenshot_path,
                "dom_tree": dom_tree,
                "viewport": {"width": width, "height": height}
            }

    def verify_css_patch(self, url: str, css_rules: str, viewport_type: str = "mobile", run_id: str = "temp") -> dict:
        """Sync wrapper — runs the async verify in a ProactorEventLoop thread."""
        return _run_in_proactor_thread(self._verify_css_patch_async(url, css_rules, viewport_type, run_id))

    async def _verify_css_patch_async(self, url: str, css_rules: str, viewport_type: str = "mobile", run_id: str = "temp") -> dict:
        """
        Applies temporary CSS rules directly in-browser and captures a verification screenshot.
        """
        async with async_playwright() as p:
            if viewport_type == "mobile":
                width, height = 390, 844
                user_agent = "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
            else:
                width, height = 1280, 800
                user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": width, "height": height},
                user_agent=user_agent
            )
            page = await context.new_page()
            await page.goto(url, wait_until="networkidle")
            await page.wait_for_timeout(1000)

            await page.evaluate(f"""
                const style = document.createElement('style');
                style.id = 'omnisight-patch';
                style.textContent = `{css_rules}`;
                document.head.appendChild(style);
            """)

            await page.wait_for_timeout(500)

            screenshot_name = f"{run_id}_after.png"
            screenshot_path = os.path.join(self.output_dir, screenshot_name)
            await page.screenshot(path=screenshot_path, full_page=True)

            dom_tree = await self._extract_dom_tree(page)
            await browser.close()

            return {
                "screenshot_url": f"/static/runs/{screenshot_name}",
                "screenshot_path": screenshot_path,
                "dom_tree": dom_tree
            }

    async def _extract_dom_tree(self, page) -> list:
        """
        Runs JS in page context to extract clean structural and spatial coordinates of elements.
        """
        dom_script = """
        () => {
            const getVisibleText = (el) => {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    return el.value;
                }
                return el.innerText || el.textContent || '';
            };

            const tags = ['input', 'button', 'label', 'h1', 'h2', 'h3', 'h4', 'p', 'span', 'form', 'section', 'header', 'footer', 'div'];
            const allElements = document.querySelectorAll(tags.join(','));
            const results = [];

            allElements.forEach(el => {
                const rect = el.getBoundingClientRect();

                if (rect.width <= 0 || rect.height <= 0) return;

                if (el.tagName === 'DIV' &&
                    !el.classList.contains('checkout-action-wrapper') &&
                    !el.classList.contains('cart-item') &&
                    !el.classList.contains('form-group') &&
                    !el.classList.contains('form-row')) {
                    return;
                }

                const style = window.getComputedStyle(el);

                const text = getVisibleText(el).trim();

                results.push({
                    id: el.id || null,
                    tagName: el.tagName.toLowerCase(),
                    classList: Array.from(el.classList),
                    text: text.substring(0, 60),
                    box: {
                        x: Math.round(rect.left),
                        y: Math.round(rect.top),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                    },
                    computedStyle: {
                        position: style.position,
                        display: style.display,
                        color: style.color,
                        backgroundColor: style.backgroundColor
                    }
                });
            });

            return results;
        }
        """
        try:
            return await page.evaluate(dom_script)
        except Exception as e:
            print(f"Error extracting DOM tree: {e}")
            return []

"""Export dashboards as PDF or PNG using Playwright headless browser."""

from __future__ import annotations

from loguru import logger


async def export_dashboard(dashboard_id: str, fmt: str = "pdf") -> tuple[bytes, str]:
    """Render a dashboard in headless Chromium and export as PDF/PNG.

    Returns (file_bytes, content_type).
    """
    from playwright.async_api import async_playwright

    url = f"http://localhost:5173/dashboard/{dashboard_id}?export=true"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})

        logger.info(f"Exporting dashboard {dashboard_id} as {fmt}")
        await page.goto(url, wait_until="networkidle")

        # Wait for charts to render
        try:
            await page.wait_for_selector(".recharts-wrapper", timeout=10_000)
        except Exception:
            logger.warning("Charts may not have loaded — proceeding with export anyway")

        if fmt == "pdf":
            file_bytes = await page.pdf(
                landscape=True,
                format="A4",
                print_background=True,
            )
            content_type = "application/pdf"
        else:
            file_bytes = await page.screenshot(full_page=True, type="png")
            content_type = "image/png"

        await browser.close()

    return file_bytes, content_type

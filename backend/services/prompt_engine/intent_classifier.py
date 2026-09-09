"""Classify user prompts into intent categories.

Fast-path: keyword matching with context awareness. Fallback: Claude API call.
"""

from __future__ import annotations

import re

from loguru import logger

# Intent types returned by the classifier
INTENTS = (
    "create_chart",
    "create_table",
    "create_kpi",
    "create_filter",
    "modify_widget",
    "ask_question",
)

# Words that signal a breakdown/grouping (i.e. chart, not single KPI)
_GROUPING_SIGNALS = re.compile(
    r"\b(by|per|across|versus|vs|for each|grouped|breakdown|broken down|compare|between)\b",
    re.IGNORECASE,
)

# Keyword → intent mapping (checked in order)
_KEYWORD_RULES: list[tuple[list[str], str]] = [
    (["change", "modify", "update", "make it", "adjust", "edit"], "modify_widget"),
    (["filter", "filter by", "segment", "narrow down"], "create_filter"),
    (
        [
            "chart", "graph", "plot", "visualize", "trend", "bar chart",
            "line chart", "pie chart", "scatter", "histogram", "area chart",
            "donut", "heatmap",
        ],
        "create_chart",
    ),
    (["table", "list all", "show all", "show data", "display all", "all rows"], "create_table"),
    # Chart-indicating phrasing (common BI language)
    (
        [
            "compare", "breakdown", "broken down", "distribution",
            "top", "bottom", "over time", "by month", "by year",
            "by region", "by category", "by product", "versus", "vs",
        ],
        "create_chart",
    ),
    # General "show/display" → chart (after more specific table rules above)
    (["show me", "show the", "display", "give me"], "create_chart"),
    # KPI keywords — only if NO grouping signal present (handled below)
    (
        ["total", "count", "average", "how many", "sum", "max", "min", "median", "percentage"],
        "create_kpi",
    ),
]


def classify(prompt: str) -> str:
    """Classify a prompt into an intent via keyword matching.

    Context-aware: if a prompt contains aggregation words AND a grouping signal
    (e.g. 'total sales by region'), it's classified as create_chart, not create_kpi.
    """
    lower = prompt.lower()
    has_grouping = bool(_GROUPING_SIGNALS.search(lower))

    for keywords, intent in _KEYWORD_RULES:
        for kw in keywords:
            if re.search(rf"\b{re.escape(kw)}\b", lower):
                # Context override: aggregation + grouping → chart, not KPI
                if intent == "create_kpi" and has_grouping:
                    logger.debug(
                        f"Intent override: '{kw}' + grouping signal → create_chart"
                    )
                    return "create_chart"
                logger.debug(f"Intent classified (keyword '{kw}'): {intent}")
                return intent

    # Default: treat as a chart request (most BI prompts want visualizations)
    logger.debug("Intent classified (default): create_chart")
    return "create_chart"


async def classify_with_fallback(prompt: str, claude_client) -> str:
    """Try keyword matching first, fall back to Claude for ambiguous prompts."""
    intent = classify(prompt)

    # The keyword classifier now defaults to create_chart instead of ask_question.
    # Only use Claude fallback if still classified as ask_question (very rare).
    if intent != "ask_question":
        return intent

    # Fallback: ask Claude to classify
    try:
        from backend.config import settings
        response = await claude_client.messages.create(
            model=settings.LLM_MODEL,
            max_tokens=50,
            system="Classify the user's BI dashboard prompt into exactly one category. "
            "Most prompts want data visualizations (create_chart). "
            "Reply with ONLY the category name, nothing else.\n"
            "Categories: create_chart, create_table, create_kpi, create_filter, "
            "modify_widget, ask_question",
            messages=[{"role": "user", "content": prompt}],
        )
        result = response.content[0].text.strip().lower().replace(" ", "_")
        if result in INTENTS:
            logger.debug(f"Intent classified (Claude fallback): {result}")
            return result
    except Exception as e:
        logger.warning(f"Claude intent classification failed: {e}")

    # Default to create_chart — most BI prompts want a visualization
    return "create_chart"

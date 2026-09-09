"""LLM client adapter — routes through OpenRouter (OpenAI-compatible API)
while exposing the same interface the codebase expects from the Anthropic SDK.

Usage:
    client = get_llm_client()
    response = await client.messages.create(
        model="anthropic/claude-sonnet-4-20250514",
        max_tokens=1024,
        system="You are ...",
        messages=[{"role": "user", "content": "..."}],
    )
    text = response.content[0].text
"""

from __future__ import annotations

from dataclasses import dataclass, field

import httpx
from loguru import logger

from backend.config import settings

_OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions"


# ── Response wrappers (match Anthropic SDK shape) ────────────

@dataclass
class ContentBlock:
    text: str
    type: str = "text"


@dataclass
class MessageResponse:
    content: list[ContentBlock] = field(default_factory=list)
    model: str = ""
    stop_reason: str | None = None


# ── Async "messages" namespace ───────────────────────────────

class _Messages:
    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._default_model = model

    async def create(
        self,
        *,
        model: str | None = None,
        max_tokens: int = 1024,
        system: str | None = None,
        messages: list[dict] | None = None,
    ) -> MessageResponse:
        model = model or self._default_model

        # Build OpenAI-format messages
        oai_messages: list[dict] = []
        if system:
            oai_messages.append({"role": "system", "content": system})
        if messages:
            oai_messages.extend(messages)

        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": oai_messages,
        }

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(_OPENROUTER_BASE, json=payload, headers=headers)

        if resp.status_code != 200:
            body = resp.text
            logger.error(f"OpenRouter error {resp.status_code}: {body}")
            raise RuntimeError(f"OpenRouter API error {resp.status_code}: {body}")

        data = resp.json()
        choices = data.get("choices", [])
        if not choices:
            raise RuntimeError(f"OpenRouter returned no choices: {data}")

        text = choices[0].get("message", {}).get("content", "")
        return MessageResponse(
            content=[ContentBlock(text=text)],
            model=data.get("model", model),
            stop_reason=choices[0].get("finish_reason"),
        )


# ── Client (drop-in replacement for anthropic.AsyncAnthropic) ─

class OpenRouterClient:
    def __init__(self, api_key: str, model: str) -> None:
        self.messages = _Messages(api_key, model)


# ── Factory ──────────────────────────────────────────────────

_client: OpenRouterClient | None = None


def get_llm_client() -> OpenRouterClient:
    global _client
    if _client is None:
        _client = OpenRouterClient(
            api_key=settings.OPENROUTER_API_KEY,
            model=settings.LLM_MODEL,
        )
    return _client

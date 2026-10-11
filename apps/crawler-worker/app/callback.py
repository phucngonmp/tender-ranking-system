import logging
from typing import Any, Optional

import httpx

logger = logging.getLogger("callback")


async def send_callback(callback_url: str, payload: dict[str, Any], internal_token: Optional[str]) -> None:
    headers = {"x-internal-token": internal_token} if internal_token else {}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(callback_url, json=payload, headers=headers)
            response.raise_for_status()
    except Exception as exc:
        logger.error(f"Failed to deliver callback to {callback_url}: {exc}")

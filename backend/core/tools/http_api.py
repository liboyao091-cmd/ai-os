"""Invoke external HTTP APIs as tools."""
import requests
from typing import Any, Dict


class HttpApiInvoker:
    def __init__(self, invoke_config: Dict[str, Any]):
        self.url = invoke_config["url"]
        self.method = invoke_config.get("method", "POST").upper()
        self.headers = invoke_config.get("headers", {})
        self.timeout = invoke_config.get("timeout", 30)

    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        resp = requests.request(
            method=self.method,
            url=self.url,
            json=input_data if self.method in ("POST", "PUT", "PATCH") else None,
            params=input_data if self.method == "GET" else None,
            headers=self.headers,
            timeout=self.timeout,
        )
        resp.raise_for_status()
        try:
            return resp.json()
        except Exception:
            return {"text": resp.text}

"""Lark (Feishu) open platform API invoker."""
import os
import requests
from typing import Any, Dict


LARK_BASE_URL = "https://open.feishu.cn"


class LarkApiInvoker:
    def __init__(self, invoke_config: Dict[str, Any]):
        self.api_path = invoke_config["api_path"]
        self.method = invoke_config.get("method", "POST").upper()
        self.timeout = invoke_config.get("timeout", 30)
        self._app_id = os.getenv("LARK_APP_ID", "")
        self._app_secret = os.getenv("LARK_APP_SECRET", "")

    def _get_tenant_token(self) -> str:
        resp = requests.post(
            f"{LARK_BASE_URL}/open-apis/auth/v3/tenant_access_token/internal",
            json={"app_id": self._app_id, "app_secret": self._app_secret},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()["tenant_access_token"]

    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        token = self._get_tenant_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        url = f"{LARK_BASE_URL}{self.api_path}"
        resp = requests.request(
            method=self.method,
            url=url,
            json=input_data if self.method in ("POST", "PUT", "PATCH") else None,
            params=input_data if self.method == "GET" else None,
            headers=headers,
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()

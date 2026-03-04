"""MCP (Model Context Protocol) tool client."""
import requests
from typing import Any, Dict


class MCPInvoker:
    def __init__(self, invoke_config: Dict[str, Any]):
        self.server_url = invoke_config["server_url"]
        self.tool_name = invoke_config["tool_name"]
        self.timeout = invoke_config.get("timeout", 30)

    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        payload = {
            "tool": self.tool_name,
            "input": input_data,
        }
        resp = requests.post(
            f"{self.server_url}/invoke",
            json=payload,
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()

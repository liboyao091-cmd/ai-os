"""Unified tool invocation dispatcher."""
from typing import Any, Dict

from backend.core.tools.python_func import PythonFuncInvoker
from backend.core.tools.http_api import HttpApiInvoker
from backend.core.tools.mcp_client import MCPInvoker
from backend.core.tools.lark_api import LarkApiInvoker


class ToolInvoker:
    """
    Wraps a Tool ORM/dict object and dispatches .invoke() to the right
    backend depending on tool.invoke_type.
    """

    def __init__(self, tool):
        self.tool = tool
        self.description = getattr(tool, "description", "") or ""
        self.input_schema = getattr(tool, "input_schema", {"type": "object", "properties": {}})
        invoke_config = (
            tool.invoke_config if hasattr(tool, "invoke_config") else tool["invoke_config"]
        )
        invoke_type = (
            tool.invoke_type if hasattr(tool, "invoke_type") else tool["invoke_type"]
        )
        match invoke_type:
            case "python_func":
                self._invoker = PythonFuncInvoker(invoke_config)
            case "http_api":
                self._invoker = HttpApiInvoker(invoke_config)
            case "mcp":
                self._invoker = MCPInvoker(invoke_config)
            case "lark_api":
                self._invoker = LarkApiInvoker(invoke_config)
            case _:
                raise ValueError(f"Unknown invoke_type: {invoke_type}")

    def invoke(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        return self._invoker.run(input_data)

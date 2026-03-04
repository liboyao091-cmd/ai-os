"""Execute user-defined Python functions in a sandboxed environment."""
import json
import subprocess
import sys
import tempfile
import textwrap
import os
from typing import Any, Dict


class PythonFuncInvoker:
    """
    Runs user-supplied Python via a subprocess to prevent code injection
    into the main process. Function signature must be:
        def run(input: dict) -> dict
    """

    def __init__(self, invoke_config: Dict[str, Any]):
        self.source_code = invoke_config.get("source_code", "def run(input):\n    return {}")
        self.requirements: list = invoke_config.get("requirements", [])
        self.timeout = invoke_config.get("timeout", 30)

    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        wrapper = textwrap.dedent(
            f"""
import json, sys

{self.source_code}

input_data = json.loads(sys.argv[1])
result = run(input_data)
print(json.dumps(result, ensure_ascii=False, default=str))
"""
        )

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".py", delete=False, encoding="utf-8"
        ) as f:
            f.write(wrapper)
            tmp_path = f.name

        try:
            proc = subprocess.run(
                [sys.executable, tmp_path, json.dumps(input_data, ensure_ascii=False)],
                capture_output=True,
                text=True,
                timeout=self.timeout,
            )
            if proc.returncode != 0:
                raise RuntimeError(f"Python func error: {proc.stderr.strip()}")
            return json.loads(proc.stdout.strip())
        finally:
            os.unlink(tmp_path)

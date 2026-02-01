"""
Inter-skill communication runtime helpers.

Builds the 5 auto-generated interop tools and handles forward RPC dispatch
for interop/getData, interop/callFunction, and interop/listExposed.

Extracted from server.py to keep file sizes manageable.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
  from dev.types.skill_types import SkillTool


# ---------------------------------------------------------------------------
# Auto-generated interop tools (always present on every skill)
# ---------------------------------------------------------------------------


def build_interop_tools(server: Any) -> dict[str, SkillTool]:
  """Build the 5 AI-callable tools for cross-skill discovery and invocation."""
  from dev.types.skill_types import SkillTool, ToolDefinition, ToolResult

  tools: dict[str, SkillTool] = {}

  # 1. list-skills
  async def _list_skills(args: dict[str, Any]) -> ToolResult:
    result = await server.list_skills()
    return ToolResult(content=json.dumps(result, indent=2))

  tools["list-skills"] = SkillTool(
    definition=ToolDefinition(
      name="list-skills",
      description="Discover all registered skills and their online status",
      parameters={"type": "object", "properties": {}},
    ),
    execute=_list_skills,
  )

  # 2. list-skill-data
  async def _list_skill_data(args: dict[str, Any]) -> ToolResult:
    skill_id = args.get("skill_id")
    result = await server.list_exposed_data(skill_id)
    return ToolResult(content=json.dumps(result, indent=2))

  tools["list-skill-data"] = SkillTool(
    definition=ToolDefinition(
      name="list-skill-data",
      description="List exposed data endpoints from other skills (optionally filter by skill)",
      parameters={
        "type": "object",
        "properties": {
          "skill_id": {
            "type": "string",
            "description": "Optional skill ID to filter by",
          },
        },
      },
    ),
    execute=_list_skill_data,
  )

  # 3. list-skill-functions
  async def _list_skill_functions(args: dict[str, Any]) -> ToolResult:
    skill_id = args.get("skill_id")
    result = await server.list_exposed_functions(skill_id)
    return ToolResult(content=json.dumps(result, indent=2))

  tools["list-skill-functions"] = SkillTool(
    definition=ToolDefinition(
      name="list-skill-functions",
      description="List exposed functions from other skills (optionally filter by skill)",
      parameters={
        "type": "object",
        "properties": {
          "skill_id": {
            "type": "string",
            "description": "Optional skill ID to filter by",
          },
        },
      },
    ),
    execute=_list_skill_functions,
  )

  # 4. request-skill-data
  async def _request_skill_data(args: dict[str, Any]) -> ToolResult:
    skill_id = args.get("skill_id", "")
    data_name = args.get("data_name", "")
    params = args.get("params")
    if not skill_id or not data_name:
      return ToolResult(content="skill_id and data_name are required", is_error=True)
    try:
      result = await server.request_skill_data(skill_id, data_name, params)
      return ToolResult(content=json.dumps(result, indent=2))
    except Exception as exc:
      return ToolResult(content=str(exc), is_error=True)

  tools["request-skill-data"] = SkillTool(
    definition=ToolDefinition(
      name="request-skill-data",
      description="Request data from another skill's exposed data endpoint",
      parameters={
        "type": "object",
        "properties": {
          "skill_id": {"type": "string", "description": "Target skill ID"},
          "data_name": {"type": "string", "description": "Data endpoint name"},
          "params": {"type": "object", "description": "Optional parameters for the data request"},
        },
        "required": ["skill_id", "data_name"],
      },
    ),
    execute=_request_skill_data,
  )

  # 5. call-skill-function
  async def _call_skill_function(args: dict[str, Any]) -> ToolResult:
    skill_id = args.get("skill_id", "")
    function_name = args.get("function_name", "")
    arguments = args.get("arguments")
    if not skill_id or not function_name:
      return ToolResult(content="skill_id and function_name are required", is_error=True)
    try:
      result = await server.call_skill_function(skill_id, function_name, arguments)
      return ToolResult(content=json.dumps(result, indent=2))
    except Exception as exc:
      return ToolResult(content=str(exc), is_error=True)

  tools["call-skill-function"] = SkillTool(
    definition=ToolDefinition(
      name="call-skill-function",
      description="Call a function exposed by another skill",
      parameters={
        "type": "object",
        "properties": {
          "skill_id": {"type": "string", "description": "Target skill ID"},
          "function_name": {"type": "string", "description": "Function name to call"},
          "arguments": {"type": "object", "description": "Arguments to pass to the function"},
        },
        "required": ["skill_id", "function_name"],
      },
    ),
    execute=_call_skill_function,
  )

  return tools


# ---------------------------------------------------------------------------
# Forward RPC handlers (host → skill)
# ---------------------------------------------------------------------------


async def handle_get_data(server: Any, params: dict[str, Any]) -> dict[str, Any]:
  """Handle interop/getData forward RPC from the host."""
  caller_skill_id = params.get("callerSkillId", "")
  data_name = params.get("dataName", "")
  request_params = params.get("params", {})

  # Try the optional hook first
  hooks = server._hooks
  if hooks and hooks.on_interop_data:
    hook_result = await hooks.on_interop_data(
      server._create_context(), caller_skill_id, data_name, request_params
    )
    if hook_result is not None:
      return {"data": hook_result}

  # Fall through to registered handler
  endpoint = server._exposed_data.get(data_name)
  if not endpoint:
    raise ValueError(f"Unknown data endpoint: {data_name}")

  result = await endpoint.handler(server._create_context(), request_params)
  return {"data": result}


async def handle_call_function(server: Any, params: dict[str, Any]) -> dict[str, Any]:
  """Handle interop/callFunction forward RPC from the host."""
  caller_skill_id = params.get("callerSkillId", "")
  function_name = params.get("functionName", "")
  arguments = params.get("arguments", {})

  # Try the optional hook first
  hooks = server._hooks
  if hooks and hooks.on_interop_call:
    hook_result = await hooks.on_interop_call(
      server._create_context(), caller_skill_id, function_name, arguments
    )
    if hook_result is not None:
      return {"data": hook_result}

  # Fall through to registered handler
  func = server._exposed_functions.get(function_name)
  if not func:
    raise ValueError(f"Unknown function: {function_name}")

  result = await func.handler(server._create_context(), arguments)
  return {"data": result}


def handle_list_exposed(server: Any) -> dict[str, Any]:
  """Handle interop/listExposed forward RPC — returns skill's exposed endpoints for host caching."""
  return {
    "data": [
      {
        "name": d.name,
        "description": d.description,
        "visibility": d.visibility,
        "schema": d.schema_,
      }
      for d in server._exposed_data.values()
    ],
    "functions": [
      {
        "name": f.name,
        "description": f.description,
        "visibility": f.visibility,
        "parameters": f.parameters,
        "returns": f.returns,
      }
      for f in server._exposed_functions.values()
    ],
  }

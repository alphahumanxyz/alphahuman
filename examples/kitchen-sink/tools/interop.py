"""
Interop tools — demonstrate consuming data and functions from other skills.
"""

from __future__ import annotations

import json

from dev.types.skill_types import SkillContext, ToolResult


async def execute_check_skill_status(args: dict) -> ToolResult:
  """Check a skill's status via its exposed data endpoint.

  Demonstrates: ctx.skills.request_data
  """
  ctx: SkillContext = args.pop("__context__")
  skill_id = args.get("skill_id", "")

  if not skill_id:
    return ToolResult(content="skill_id is required", is_error=True)

  try:
    result = await ctx.skills.request_data(skill_id, "connection-status")
    return ToolResult(content=json.dumps(result, indent=2))
  except Exception as e:
    return ToolResult(content=f"Failed to get status from '{skill_id}': {e}", is_error=True)


async def execute_discover_skills(args: dict) -> ToolResult:
  """Discover all registered skills and their available data/functions.

  Demonstrates: ctx.skills.list_skills, ctx.skills.list_data, ctx.skills.list_functions
  """
  ctx: SkillContext = args.pop("__context__")

  try:
    skills = await ctx.skills.list_skills()
    data_endpoints = await ctx.skills.list_data()
    functions = await ctx.skills.list_functions()

    summary = {
      "skills": skills,
      "available_data_endpoints": data_endpoints,
      "available_functions": functions,
    }
    return ToolResult(content=json.dumps(summary, indent=2))
  except Exception as e:
    return ToolResult(content=f"Discovery failed: {e}", is_error=True)

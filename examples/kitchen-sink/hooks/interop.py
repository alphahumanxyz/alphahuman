"""
Interop hooks — optional interceptors for incoming cross-skill requests.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
  from dev.types.skill_types import SkillContext


async def on_interop_data(
  ctx: SkillContext, caller_skill_id: str, data_name: str, params: dict[str, Any]
) -> dict[str, Any] | None:
  """Intercept incoming data requests from other skills or the frontend.

  Return a dict to short-circuit the registered handler, or None to
  fall through to the default handler.

  Demonstrates: per-request auditing/gating
  """
  ctx.log(f"kitchen-sink: interop data request from '{caller_skill_id}' for '{data_name}'")

  # Example: return None to let the registered handler run
  return None


async def on_interop_call(
  ctx: SkillContext, caller_skill_id: str, function_name: str, arguments: dict[str, Any]
) -> dict[str, Any] | None:
  """Intercept incoming function calls from other skills or the frontend.

  Return a dict to short-circuit the registered handler, or None to
  fall through to the default handler.

  Demonstrates: per-request auditing/gating
  """
  ctx.log(f"kitchen-sink: interop call from '{caller_skill_id}' for '{function_name}'")

  # Example: return None to let the registered handler run
  return None

"""
Interop schema — declares data endpoints and functions exposed to other skills and the frontend.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from dev.types.interop_types import (
  ExposedDataDefinition,
  ExposedFunctionDefinition,
  InteropSchema,
)

if TYPE_CHECKING:
  from dev.types.skill_types import SkillContext


async def _get_notes_summary(ctx: SkillContext, params: dict[str, Any]) -> dict[str, Any]:
  """Return a summary of stored notes. Exposed to other skills and frontend."""
  state = ctx.get_state() or {}
  notes = state.get("notes_index", [])
  return {
    "count": len(notes),
    "notes": notes,
  }


async def _get_status(ctx: SkillContext, params: dict[str, Any]) -> dict[str, Any]:
  """Return the skill's current status. Exposed to other skills and frontend."""
  state = ctx.get_state() or {}
  config = state.get("config")
  return {
    "configured": config is not None,
    "username": config.get("username") if config else None,
    "tick_count": state.get("tick_count", 0),
  }


async def _add_note(ctx: SkillContext, args: dict[str, Any]) -> dict[str, Any]:
  """Add a note. Callable by other skills."""
  import json
  from datetime import UTC, datetime

  title = args.get("title", "Untitled")
  body = args.get("body", "")

  state = ctx.get_state() or {}
  notes: list[dict[str, Any]] = state.get("notes_index", [])

  note_id = f"note_{len(notes) + 1}"
  note = {
    "id": note_id,
    "title": title,
    "body": body,
    "created_at": datetime.now(UTC).isoformat(),
  }

  await ctx.write_data(f"{note_id}.json", json.dumps(note, indent=2))
  notes.append({"id": note_id, "title": title})
  ctx.set_state({"notes_index": notes})

  return {"note_id": note_id, "title": title}


interop_schema = InteropSchema(
  exposed_data=[
    ExposedDataDefinition(
      name="notes-summary",
      description="Summary of all stored notes (count and index)",
      visibility=["skills", "frontend"],
      schema={
        "type": "object",
        "properties": {
          "count": {"type": "integer"},
          "notes": {"type": "array", "items": {"type": "object"}},
        },
      },
      handler=_get_notes_summary,
    ),
    ExposedDataDefinition(
      name="connection-status",
      description="Current kitchen-sink skill status",
      visibility=["skills", "frontend"],
      schema={
        "type": "object",
        "properties": {
          "configured": {"type": "boolean"},
          "username": {"type": "string"},
          "tick_count": {"type": "integer"},
        },
      },
      handler=_get_status,
    ),
  ],
  exposed_functions=[
    ExposedFunctionDefinition(
      name="add-note",
      description="Add a note to the kitchen-sink skill's storage",
      visibility=["skills"],
      parameters={
        "type": "object",
        "properties": {
          "title": {"type": "string", "description": "Note title"},
          "body": {"type": "string", "description": "Note content"},
        },
        "required": ["title"],
      },
      returns={
        "type": "object",
        "properties": {
          "note_id": {"type": "string"},
          "title": {"type": "string"},
        },
      },
      handler=_add_note,
    ),
  ],
)

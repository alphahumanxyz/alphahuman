"""
AlphaHuman Interop Types — Pydantic v2 Edition

Type definitions for the inter-skill communication system. Skills declare
exposed data endpoints and callable functions, and use the SkillsManager
protocol to discover and interact with other skills.

Usage:
    from dev.types.interop_types import (
        ExposedDataDefinition, ExposedFunctionDefinition, InteropSchema,
        SkillInfo, ExposedDataInfo, ExposedFunctionInfo,
    )
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable  # noqa: TC003 — needed at runtime by Pydantic
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Visibility type
# ---------------------------------------------------------------------------

Visibility = list[Literal["skills", "frontend"]]

# ---------------------------------------------------------------------------
# Exposed Data Definition (what a skill exposes)
# ---------------------------------------------------------------------------


class ExposedDataDefinition(BaseModel):
  """Declares a named data endpoint that other skills or the frontend can request."""

  model_config = ConfigDict(arbitrary_types_allowed=True)

  name: str = Field(description="Endpoint name (kebab-case, unique per skill)")
  description: str = Field(description="Human-readable description of the data")
  visibility: Visibility = Field(
    default_factory=list,
    description='Access control: [] = private, ["skills"] = other skills, ["frontend"] = frontend, ["skills", "frontend"] = both',
  )
  schema_: dict[str, Any] = Field(
    default_factory=dict,
    alias="schema",
    description="JSON Schema describing the return shape",
  )
  handler: Callable[..., Awaitable[dict[str, Any]]] = Field(
    description="Async callable (ctx, params) -> dict"
  )


# ---------------------------------------------------------------------------
# Exposed Function Definition (what a skill exposes)
# ---------------------------------------------------------------------------


class ExposedFunctionDefinition(BaseModel):
  """Declares a callable function that other skills or the frontend can invoke."""

  model_config = ConfigDict(arbitrary_types_allowed=True)

  name: str = Field(description="Function name (kebab-case, unique per skill)")
  description: str = Field(description="Human-readable description of the function")
  visibility: Visibility = Field(
    default_factory=list,
    description='Access control: [] = private, ["skills"] = other skills, ["frontend"] = frontend, ["skills", "frontend"] = both',
  )
  parameters: dict[str, Any] = Field(
    default_factory=lambda: {"type": "object", "properties": {}},
    description="JSON Schema for function parameters",
  )
  returns: dict[str, Any] = Field(
    default_factory=dict,
    description="JSON Schema describing the return shape",
  )
  handler: Callable[..., Awaitable[dict[str, Any]]] = Field(
    description="Async callable (ctx, args) -> dict"
  )


# ---------------------------------------------------------------------------
# Interop Schema (container on SkillDefinition)
# ---------------------------------------------------------------------------


class InteropSchema(BaseModel):
  """Collection of exposed data endpoints and callable functions for a skill."""

  model_config = ConfigDict(frozen=True)

  exposed_data: list[ExposedDataDefinition] = Field(default_factory=list)
  exposed_functions: list[ExposedFunctionDefinition] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Discovery payloads (serializable — no handlers)
# ---------------------------------------------------------------------------


class SkillInfo(BaseModel):
  """Discovery payload for a skill (frozen, no handlers)."""

  model_config = ConfigDict(frozen=True)

  id: str = Field(description="Skill identifier")
  name: str = Field(description="Skill display name")
  description: str = Field(description="Brief description")
  version: str = Field(default="1.0.0")
  online: bool = Field(default=False, description="Whether the skill is currently running")


class ExposedDataInfo(BaseModel):
  """Serializable metadata for an exposed data endpoint (no handler)."""

  model_config = ConfigDict(frozen=True)

  skill_id: str = Field(description="Owning skill ID")
  name: str = Field(description="Endpoint name")
  description: str = Field(description="Human-readable description")
  schema_: dict[str, Any] = Field(default_factory=dict, alias="schema")


class ExposedFunctionInfo(BaseModel):
  """Serializable metadata for an exposed function (no handler)."""

  model_config = ConfigDict(frozen=True)

  skill_id: str = Field(description="Owning skill ID")
  name: str = Field(description="Function name")
  description: str = Field(description="Human-readable description")
  parameters: dict[str, Any] = Field(default_factory=lambda: {"type": "object", "properties": {}})
  returns: dict[str, Any] = Field(default_factory=dict)

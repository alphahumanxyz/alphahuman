"""
Desktop skill entry point.

Runs the skill server using the standard runtime.
"""

from dev.runtime.server import run_skill_server

from .skill import skill

if __name__ == "__main__":
  run_skill_server(skill)

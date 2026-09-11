#!/usr/bin/env python3
"""Install anti-ai-slop-ui into Cursor, Claude Code, Codex, and .agents/skills."""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path

SKILL_DIR_NAME = "anti-ai-slop-ui"

TARGETS = {
    "cursor": {
        "user": Path.home() / ".cursor" / "skills" / SKILL_DIR_NAME,
        "project": Path(".cursor") / "skills" / SKILL_DIR_NAME,
    },
    "claude": {
        "user": Path.home() / ".claude" / "skills" / SKILL_DIR_NAME,
        "project": Path(".claude") / "skills" / SKILL_DIR_NAME,
    },
    "codex": {
        "user": Path.home() / ".codex" / "skills" / SKILL_DIR_NAME,
        "project": Path(".codex") / "skills" / SKILL_DIR_NAME,
    },
    "agents": {
        "user": Path.home() / ".agents" / "skills" / SKILL_DIR_NAME,
        "project": Path(".agents") / "skills" / SKILL_DIR_NAME,
    },
}


def repo_root() -> Path:
    root = Path(__file__).resolve().parent.parent
    if not (root / "SKILL.md").is_file():
        print("Error: run from anti-ai-slop-ui repo (SKILL.md not found).", file=sys.stderr)
        sys.exit(2)
    return root


def resolve_existing(path: Path) -> Path | None:
    if not path.exists() and not path.is_symlink():
        return None
    return path.resolve()


def install_one(source: Path, dest: Path, *, copy: bool, dry_run: bool) -> str:
    if dest.exists() or dest.is_symlink():
        if not dry_run:
            if dest.is_symlink() or dest.is_file():
                dest.unlink()
            else:
                shutil.rmtree(dest)

    dest.parent.mkdir(parents=True, exist_ok=True)

    if dry_run:
        action = "copy" if copy else "symlink"
        return f"would {action}: {dest} -> {source}"

    if copy:
        shutil.copytree(source, dest, symlinks=True)
        return f"copied: {dest}"
    os.symlink(source, dest)
    return f"linked: {dest} -> {source}"


def status_line(label: str, path: Path) -> str:
    if not path.exists() and not path.is_symlink():
        return f"  {label}: not installed ({path})"
    kind = "symlink" if path.is_symlink() else "copy"
    resolved = resolve_existing(path)
    return f"  {label}: {kind} -> {resolved}"


def cmd_status(scope: str) -> None:
    print(f"anti-ai-slop-ui install status ({scope}):")
    for name, paths in TARGETS.items():
        print(status_line(name, paths[scope]))


def cmd_install(
    *,
    targets: list[str],
    scope: str,
    copy: bool,
    dry_run: bool,
) -> None:
    source = repo_root()
    print(f"Source: {source}")
    for name in targets:
        if name not in TARGETS:
            print(f"Warning: unknown target '{name}', skipping.", file=sys.stderr)
            continue
        dest = TARGETS[name][scope]
        msg = install_one(source, dest, copy=copy, dry_run=dry_run)
        print(msg)


def main() -> int:
    parser = argparse.ArgumentParser(description=f"Install {SKILL_DIR_NAME} skill.")
    parser.add_argument(
        "--targets",
        default="cursor,claude,codex,agents",
        help="Comma-separated: cursor,claude,codex,agents",
    )
    parser.add_argument(
        "--project",
        action="store_true",
        help="Install to project .cursor/.claude/.codex/.agents instead of home",
    )
    parser.add_argument(
        "--copy",
        action="store_true",
        help="Copy files instead of symlinking (default: symlink)",
    )
    parser.add_argument("--status", action="store_true", help="Show install status")
    parser.add_argument("--dry-run", action="store_true", help="Print actions only")
    args = parser.parse_args()

    scope = "project" if args.project else "user"

    if args.status:
        cmd_status(scope)
        return 0

    targets = [t.strip() for t in args.targets.split(",") if t.strip()]
    cmd_install(targets=targets, scope=scope, copy=args.copy, dry_run=args.dry_run)
    print("\nDone. Invoke in agents by mentioning anti-ai-slop-ui in your UI task.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

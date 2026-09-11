#!/usr/bin/env python3
"""Heuristic AI-slop detector for frontend UI source files. Stdlib only."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

SCAN_EXTENSIONS = {".html", ".htm", ".jsx", ".tsx", ".vue", ".svelte", ".css", ".scss"}

EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0001F600-\U0001F64F"
    "\u26A1\u2728\U0001F680\U0001F512\U0001F916\U0001F30D"
    "]"
)

RULES: list[tuple[str, re.Pattern[str], float, str]] = [
    (
        "purple_blue_gradient",
        re.compile(
            r"from-(?:purple|indigo|violet)-|to-(?:blue|indigo|purple)-|"
            r"bg-gradient-to-(?:r|br|bl|tr)|bg-clip-text|text-transparent",
            re.I,
        ),
        1.5,
        "Purple/blue gradient identity — use product-specific palette",
    ),
    (
        "glow_blur",
        re.compile(r"blur-(?:2xl|3xl)|shadow-(?:purple|blue)-|glow-blob", re.I),
        1.0,
        "Decorative glow/blur — remove unless it serves the product",
    ),
    (
        "over_rounded",
        re.compile(r"rounded-(?:2xl|3xl)", re.I),
        1.0,
        "Over-rounded containers — define radius by component role",
    ),
    (
        "shadcn_cards",
        re.compile(r"CardHeader|CardContent|<Card[\s>]", re.I),
        1.0,
        "Default shadcn card rhythm — customize or reduce card repetition",
    ),
    (
        "three_col_features",
        re.compile(r"grid-cols-3", re.I),
        0.5,
        "Three-column grid — often hero+3-cards pattern; prefer workflow layout",
    ),
    (
        "motion_overload",
        re.compile(r"transition-all|whileHover|animate-pulse|hover:scale-", re.I),
        1.0,
        "Decorative motion — keep motion functional only",
    ),
    (
        "default_typography",
        re.compile(r"\bInter\b|\bGeist\b|family=Inter|family=Geist", re.I),
        1.0,
        "Default Inter/Geist — choose type for product context",
    ),
    (
        "glassmorphism",
        re.compile(r"backdrop-blur|glassmorphism", re.I),
        0.5,
        "Glassmorphism — justify or remove",
    ),
]

RECOMMENDATIONS = [
    "Replace purple/blue gradient identity with product-specific palette.",
    "Reduce radius and define radius rules by component role.",
    "Replace emoji icons with a coherent icon set.",
    "Break feature-card layout into workflow or product proof.",
    "Add design tokens before further implementation.",
]


@dataclass
class Finding:
    rule: str
    line: int
    snippet: str
    message: str


@dataclass
class FileReport:
    path: Path
    findings: list[Finding] = field(default_factory=list)
    emoji_count: int = 0


def collect_files(target: Path) -> list[Path]:
    if target.is_file():
        return [target] if target.suffix.lower() in SCAN_EXTENSIONS else []
    files: list[Path] = []
    for path in target.rglob("*"):
        if path.suffix.lower() in SCAN_EXTENSIONS and path.is_file():
            if "node_modules" in path.parts or ".git" in path.parts:
                continue
            files.append(path)
    return sorted(files)


def scan_file(path: Path) -> FileReport:
    report = FileReport(path=path)
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        report.findings.append(Finding("read_error", 0, "", str(exc)))
        return report

    for line_no, line in enumerate(text.splitlines(), start=1):
        for rule_id, pattern, _weight, message in RULES:
            if pattern.search(line):
                report.findings.append(
                    Finding(rule_id, line_no, line.strip()[:120], message)
                )
        emojis = EMOJI_RE.findall(line)
        if emojis:
            report.emoji_count += len(emojis)
            report.findings.append(
                Finding(
                    "emoji_icons",
                    line_no,
                    line.strip()[:120],
                    "Emoji as UI element — use a coherent icon set",
                )
            )

    return report


def score_reports(reports: list[FileReport]) -> float:
    if not reports:
        return 0.0

    rule_hits: dict[str, int] = {}
    emoji_total = 0
    for report in reports:
        emoji_total += report.emoji_count
        for finding in report.findings:
            if finding.rule == "read_error":
                continue
            rule_hits[finding.rule] = rule_hits.get(finding.rule, 0) + 1

    total = 0.0
    for rule_id, _pattern, weight, _msg in RULES:
        if rule_hits.get(rule_id, 0) > 0:
            total += weight

    if emoji_total > 0:
        total += min(1.0, 0.25 * emoji_total)

    if rule_hits.get("shadcn_cards", 0) >= 3:
        total += 0.5
    if rule_hits.get("three_col_features", 0) >= 2 and rule_hits.get("purple_blue_gradient", 0) > 0:
        total += 1.0

    return min(10.0, round(total, 1))


def format_report(reports: list[FileReport], score: float) -> str:
    lines = [f"AI Slop Risk: {score}/10", ""]

    if not reports:
        lines.append("No scannable UI files found.")
        return "\n".join(lines)

    counts: dict[str, int] = {}
    for report in reports:
        for finding in report.findings:
            counts[finding.rule] = counts.get(finding.rule, 0) + 1

    if counts:
        lines.append("Detected:")
        label_map = {r[0]: r[3] for r in RULES}
        label_map["emoji_icons"] = "Emoji icons in UI"
        for rule_id, count in sorted(counts.items(), key=lambda x: -x[1]):
            label = label_map.get(rule_id, rule_id)
            lines.append(f"- {count}× {label}")

    sample = [f for r in reports for f in r.findings if f.rule != "read_error"][:12]
    if sample:
        lines.extend(["", "Samples:"])
        for finding in sample:
            lines.append(f"  {finding.line}: {finding.snippet}")

    lines.extend(["", "Recommended:"])
    for i, rec in enumerate(RECOMMENDATIONS[:5], start=1):
        lines.append(f"{i}. {rec}")

    lines.extend(
        [
            "",
            "Note: Heuristic only. False positives happen. Does not replace anti-ai-slop-ui design process.",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Flag common AI/vibe-coded UI tells in frontend files."
    )
    parser.add_argument("path", type=Path, help="File or directory to scan")
    parser.add_argument(
        "--fail-above",
        type=float,
        default=None,
        help="Exit code 1 if score exceeds this threshold",
    )
    args = parser.parse_args()

    if not args.path.exists():
        print(f"Error: path not found: {args.path}", file=sys.stderr)
        return 2

    files = collect_files(args.path)
    reports = [scan_file(f) for f in files]
    score = score_reports(reports)
    print(format_report(reports, score))

    if args.fail_above is not None and score > args.fail_above:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

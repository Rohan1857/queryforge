---
name: anti-ai-slop-ui
description: >-
  Prevents generic AI-generated UI by enforcing product-specific design direction,
  design tokens, layout strategy, and anti-slop review. Use when generating or
  reviewing landing pages, SaaS UI, dashboards, onboarding flows, app screens,
  desktop/mobile UI, frontend components, Figma/mockups, UI redesigns, or
  shadcn/Tailwind refactors. Do not use for pure backend, database, DevOps,
  data processing, CLI-only scripts, or text-only tasks unless visible UI is
  involved.
license: MIT
compatibility: Cursor, Claude Code, Codex. Python 3.10+ for optional scripts.
metadata:
  author: rwcod
  version: "1.0.0"
  repository: https://github.com/rwcod/anti-ai-slop-ui
---

# anti-ai-slop-ui

Prevent AI agents from producing generic, instantly recognizable, vibe-coded UI.

Do not default to the average AI SaaS interface. Produce product-specific design by defining visual direction, design tokens, layout strategy, motion rules, and an anti-slop quality gate **before** writing UI code.

## Core principle

Do not start with components. Start with design intent.

## When to use

- landing pages, SaaS UI, dashboards, onboarding flows
- app screens (desktop/mobile)
- frontend components, Figma/mockups
- UI redesigns and UI quality reviews
- shadcn/Tailwind UI refactors

## When not to use

- pure backend, database-only, DevOps-only work
- data processing, CLI-only scripts, text-only writing
- unless the task includes visible UI

## Mandatory process

Follow this order. Do not skip steps.

### 1. Classify the UI task

Identify one primary type:

- landing page / product marketing page
- app dashboard / admin / control panel
- onboarding flow
- mobile or desktop app screen
- component library work
- redesign or review
- Figma/mockup generation
- implementation or refactor

Use the matching checklist when reviewing:

- `checklists/landing_page_checklist.md`
- `checklists/dashboard_checklist.md`
- `checklists/ui_review_checklist.md`

### 2. Infer product context

Determine:

- product type, target user, primary user action
- platform, information density, trust requirement
- emotional tone, brand maturity, business goal
- accessibility expectations

If information is missing, state a brief assumption. Do not block unless the gap is essential.

Use `templates/design_brief_template.md` for generation tasks.

### 3. Choose a concrete visual direction

Pick one direction with constraints. Do not use vague labels like "modern", "clean", or "sleek" without specifics.

Read `references/visual_directions.md` and choose one, for example:

- Native macOS Utility
- Developer Tool / CLI Companion
- Enterprise Control Plane
- Security Operations Console
- Research Archive
- Premium Wellness Companion
- Crypto Intelligence Terminal
- Consumer Creator Tool
- Financial Dashboard
- Minimal Editorial Product
- Playful Consumer App

See `references/visual_directions.md` for full constraints per direction.

### 4. Define design tokens before UI code

Before implementation, define:

- palette, typography, spacing scale
- radius rules, shadow/elevation rules
- icon style, motion rules
- layout rhythm, component density

Use `templates/design_tokens_template.json`.

Read `references/typography_guidance.md` and `references/motion_rules.md`.

### 5. Select a layout strategy

Do not default to:

```text
centered hero -> subtitle -> two CTAs -> three cards -> bento -> FAQ -> CTA
```

Choose a product-specific layout from `references/layout_patterns.md`, for example:

- asymmetric product hero
- command center
- editorial split
- workflow timeline
- native settings window
- evidence ledger
- dense dashboard
- one big object
- problem / evidence / outcome
- product storyboard

### 6. Avoid common AI/vibe-coded defaults

These are dangerous defaults that require product-specific justification. Do not use them unless the user asks or there is a strong product reason.

Read `references/anti_slop_patterns.md` for tells and alternatives.

Discourage by default:

- default shadcn/Tailwind visual language
- purple/indigo AI palette, purple-to-blue gradients, gradient hero text
- centered hero + three cards + CTA
- emoji icons as UI elements
- dark neon glow without purpose
- glassmorphism everywhere
- aurora/blob/blur decoration without purpose
- rounded corners on everything
- Inter/Geist as unexamined defaults
- hover animation on every card
- scroll reveal everywhere
- generic SaaS section rhythm
- bento grid as default decoration
- empty whitespace used to fake premium design
- visually identical cards with equal weight

### 7. Generate or review UI

**Generation:** customize components deeply, avoid raw demo components, make hierarchy obvious, use coherent icons, define empty/loading/error states, keep motion functional, preserve accessibility basics, test responsive behavior.

**Review:** identify generic tells, explain why, rank fixes by impact, propose revised direction.

Use `checklists/accessibility_basics.md` for all UI work.

Study `examples/` for contrast cases:

- `examples/bad_to_good_landing.md`
- `examples/bad_to_good_dashboard.md`
- `examples/native_macos_utility_example.md`

### 8. Run AI Slop Score and Distinctiveness Score

Score before final delivery:

- `rubrics/ai_slop_score.md`
- `rubrics/distinctiveness_score.md`
- `rubrics/implementation_readiness_score.md` (for generation briefs)

Quality-gate questions:

- Does this look like a default shadcn demo?
- Is the main accent purple/indigo without a product reason?
- Is there a gradient hero headline?
- Is the page basically hero + three cards + CTA?
- Are emojis used as icons?
- Are all cards/buttons/modals heavily rounded?
- Is there glow, aurora, blob, blur, or glass decoration without purpose?
- Is Inter/Geist used only because it was the default?
- Are hover/scroll animations excessive?
- Would a frontend/design subreddit say "this screams AI"?

### 9. Revise if the UI looks generic

- AI Slop Score 0-4: proceed with minor notes
- AI Slop Score 5-6: revise highest-impact areas
- AI Slop Score 7+: do not ship; redesign visual direction and layout
- Distinctiveness Score below 7: propose at least three specific improvements

### 10. Output implementation-ready notes/code

Use the correct output template:

- generation: `templates/ui_generation_output.md`
- review: `templates/ui_review_output.md`

## Required output formats

### UI generation

1. Design direction
2. Token decisions
3. Layout strategy
4. Implementation/code
5. Anti-slop check (scores + risks)
6. Remaining trade-offs

### UI review

1. Direct diagnosis
2. Generic tells found
3. Why they happen
4. Priority fixes
5. Revised design direction
6. AI Slop Score
7. Distinctiveness Score
8. Concrete implementation steps

## Resource map

| Role | File |
|------|------|
| Visual tells + alternatives | `references/anti_slop_patterns.md` |
| Direction library | `references/visual_directions.md` |
| Non-default layouts | `references/layout_patterns.md` |
| Font/type decisions | `references/typography_guidance.md` |
| Functional motion | `references/motion_rules.md` |
| Pre-generation brief | `templates/design_brief_template.md` |
| Token structure | `templates/design_tokens_template.json` |
| Generation output shape | `templates/ui_generation_output.md` |
| Review output shape | `templates/ui_review_output.md` |
| Slop scoring | `rubrics/ai_slop_score.md` |
| Distinctiveness scoring | `rubrics/distinctiveness_score.md` |
| Readiness scoring | `rubrics/implementation_readiness_score.md` |
| General review checklist | `checklists/ui_review_checklist.md` |
| Landing page checklist | `checklists/landing_page_checklist.md` |
| Dashboard checklist | `checklists/dashboard_checklist.md` |
| Accessibility basics | `checklists/accessibility_basics.md` |
| Landing contrast example | `examples/bad_to_good_landing.md` |
| Dashboard contrast example | `examples/bad_to_good_dashboard.md` |
| Native macOS utility example | `examples/native_macos_utility_example.md` |
| Reusable task prompts | `examples/prompt_examples.md` |
| Install to agents | `scripts/install_skill.py` |
| UI slop heuristic lint | `scripts/ui_lint.py` |

## Utility scripts

Run these when helpful. They do not replace the design process above.

### `scripts/install_skill.py`

For users who cloned the repo. Symlinks (default) or copies this skill into agent skill directories.

```bash
python scripts/install_skill.py
python scripts/install_skill.py --status
```

Public install alternative: `npx skills add rwcod/anti-ai-slop-ui`

### `scripts/ui_lint.py`

After implementing or reviewing UI code, scan for measurable slop tells:

```bash
python scripts/ui_lint.py ./src
python scripts/ui_lint.py path/to/Component.tsx
```

Use output as input to AI Slop Score — not as the final verdict. False positives are expected.

## Strong default instruction

Before implementing UI, create a short design direction and design token plan.

Use a distinct, product-specific visual language. Prioritize hierarchy, restraint, asymmetry where useful, platform-native conventions where relevant, and functional motion only.

First define the visual system. Then implement the UI.

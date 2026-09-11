# anti-ai-slop-ui

[![skills.sh](https://skills.sh/b/rwcod/anti-ai-slop-ui)](https://skills.sh/rwcod/anti-ai-slop-ui)

Agent skill that stops AI coding agents from shipping generic, instantly recognizable, vibe-coded UI.

Instead of defaulting to purple gradients and hero-plus-three-cards, the agent must define **product-specific visual direction**, **design tokens**, **layout strategy**, and pass an **anti-slop quality gate** before writing UI code.

Works with [Cursor](https://cursor.com), [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Codex](https://openai.com/codex), and any agent that supports the [Agent Skills](https://agentskills.io/) format.

## Install

```bash
npx skills add rwcod/anti-ai-slop-ui -g -y
```

Global install (`-g`) puts the skill in your user skill directories for all detected agents.

**Target specific agents:**

```bash
npx skills add rwcod/anti-ai-slop-ui -g -a cursor -a claude-code -a codex -y
```

**From source (development):**

```bash
git clone https://github.com/rwcod/anti-ai-slop-ui.git
cd anti-ai-slop-ui
python3 scripts/install_skill.py
```

## Usage

Mention the skill in any UI task:

```text
Use the anti-ai-slop-ui skill before implementing this UI.
First define product-specific visual direction, design tokens, and layout strategy.
Then implement. Finish with AI Slop Score and Distinctiveness Score.
```

More copy-paste prompts: [examples/prompt_examples.md](examples/prompt_examples.md)

| Tool | How to invoke |
|------|----------------|
| **Cursor** | Mention in prompt; auto-triggers from skill `description` |
| **Claude Code** | `/anti-ai-slop-ui` or mention in task |
| **Codex** | Mention in prompt |

## What it does

1. Classify the UI task (landing, dashboard, app screen, review…)
2. Infer product context
3. Choose a concrete visual direction (not “modern and clean”)
4. Define design tokens before code
5. Select a non-default layout strategy
6. Block dangerous AI defaults (purple gradients, emoji icons, shadcn-demo rhythm…)
7. Generate or review UI
8. Score with AI Slop / Distinctiveness rubrics
9. Revise if still generic
10. Output implementation-ready notes or code

Full process: [SKILL.md](SKILL.md)

## Use when

- Landing pages, SaaS UI, dashboards, onboarding flows
- App screens, frontend components, Figma/mockups
- UI redesigns, UI quality reviews, shadcn/Tailwind refactors

## Skip when

- Pure backend, database, DevOps, data processing
- CLI-only scripts, text-only tasks (unless visible UI is involved)

## Optional: UI lint script

Heuristic scan for measurable slop tells after implementation:

```bash
python3 scripts/ui_lint.py ./src
python3 scripts/ui_lint.py ./components/Hero.tsx --fail-above 5
```

Flags purple/blue gradients, over-rounded containers, emoji icons, Inter/Geist defaults, shadcn card rhythm, decorative motion. **Heuristic only** — does not replace the skill's design process.

## Structure

```text
anti-ai-slop-ui/
├── SKILL.md              # entrypoint
├── references/           # patterns, directions, layout, typography, motion
├── templates/            # brief, tokens, output shapes
├── rubrics/              # AI Slop, Distinctiveness, Readiness scores
├── checklists/           # landing, dashboard, review, a11y
├── examples/             # bad→good examples + prompt templates
└── scripts/
    ├── install_skill.py  # symlink/copy to agent skill dirs
    └── ui_lint.py        # optional heuristic lint
```

## License

MIT — see [LICENSE](LICENSE).

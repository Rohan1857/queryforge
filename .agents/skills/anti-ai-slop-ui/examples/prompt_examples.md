# Prompt Examples

## Prompt: Generate landing page with the skill

```text
Use the anti-ai-slop-ui skill before implementing UI.

Build a landing page for [PRODUCT].

First produce:
1. design direction,
2. token plan,
3. layout strategy,
4. anti-slop constraints.

Then implement.

Hard constraints:
- no purple/blue gradients unless explicitly justified,
- no generic centered hero + three feature cards + CTA,
- no emoji icons,
- no default shadcn/Tailwind look,
- no excessive glow/glass/aurora/blob decoration,
- no Inter/Geist unless justified,
- motion must be functional only.

The final answer must include:
- implementation summary,
- AI Slop Score,
- Distinctiveness Score,
- what was changed to avoid generic AI UI.
```

## Prompt: Review existing UI

```text
Use the anti-ai-slop-ui skill to review this UI.

Analyze whether it looks like generic AI/vibe-coded UI.

Return:
1. direct diagnosis,
2. detected AI-slop tells,
3. why they happen,
4. priority fixes,
5. revised design direction,
6. AI Slop Score,
7. Distinctiveness Score,
8. implementation-ready changes.

Be blunt and specific. Do not give vague advice like “make it more modern”.
```

## Prompt: Refactor shadcn-looking UI

```text
Use the anti-ai-slop-ui skill.

This UI currently looks like a default shadcn/Tailwind project. Refactor it so it has a product-specific visual identity.

Before code, define:
- visual direction,
- design tokens,
- layout strategy,
- component customization rules.

Then change the UI to reduce:
- default card rhythm,
- purple/indigo accents,
- over-rounded containers,
- generic feature-card layout,
- decorative glow,
- generic typography.

Do not remove usability. Improve hierarchy and product specificity.
```

## Prompt: Generate + lint after implementation

```text
Use the anti-ai-slop-ui skill before implementing UI.

Build [UI DESCRIPTION] for [PRODUCT].

Follow the full skill process: design direction, tokens, layout strategy, then code.

After implementation, run:
python3 scripts/ui_lint.py [CHANGED_UI_PATH]

If AI Slop Risk is above 5, revise the highest-impact issues before final delivery.

Return AI Slop Score, Distinctiveness Score, and lint summary.
```

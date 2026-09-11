# AI Slop Score Rubric

AI Slop Score measures how much a UI looks like generic AI-generated/vibe-coded output.

Scale:

- 0 = no visible AI-slop signs
- 10 = instantly recognizable AI-generated template

Use this score during UI review and before final delivery.

## Categories

Score each category 0-2 points.

### 1. Palette defaultness

0 = palette is product-specific and intentional
1 = somewhat generic but not dominant
2 = obvious AI purple/indigo, purple-blue gradients, black/purple neon, or default Tailwind colors

### 2. Layout defaultness

0 = layout fits product and breaks template rhythm
1 = some common SaaS structure but with meaningful adaptation
2 = centered hero + subtitle + CTAs + three cards + CTA / obvious template layout

### 3. Component defaultness

0 = components are customized and product-specific
1 = some default component library feel remains
2 = obvious shadcn/Tailwind starter look

### 4. Typography genericness

0 = typography is intentional and appropriate
1 = common font but used with clear hierarchy
2 = Inter/Geist/system default with no typographic decisions

### 5. Decorative noise

0 = decoration is purposeful or minimal
1 = some unnecessary effects
2 = glow, aurora, blur blobs, glassmorphism, hover/scroll animation overload

## Total score

0-2: Strong. Does not read as AI-generated.

3-4: Acceptable, but could be more distinctive.

5-6: Risky. Several recognizable vibe-coded tells.

7-8: Weak. Likely to be called AI slop by designers/devs.

9-10: Severe. Must be redesigned before shipping.

## Required action

- If score is 0-4: proceed with minor notes.
- If score is 5-6: revise highest-impact areas.
- If score is 7+: do not ship; redesign visual direction and layout.

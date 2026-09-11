# Anti-Slop Patterns Reference

This document lists the most common visual patterns that make AI-generated UI feel generic, recognizable, and low-trust.

The goal is not to ban every pattern forever. The goal is to stop using them as unconscious defaults.

## 1. Default shadcn / Tailwind look

### Tell

- slate/gray cards everywhere,
- default border-heavy panels,
- standard Card/Header/Content rhythm,
- generic button variants,
- identical padding scale,
- copy-pasted component demo feel,
- no brand-specific customization.

### Why it feels generic

AI tools often generate the same React + Tailwind + shadcn structure. Even if technically clean, the result feels like a starter template.

### When acceptable

- internal admin tools,
- prototypes,
- developer utilities where speed matters more than brand,
- when the UI is intentionally system-like.

### Better alternatives

- alter component density,
- customize radius and borders,
- reduce card repetition,
- use fewer panels with stronger hierarchy,
- introduce product-specific interaction states,
- create one or two custom signature components.

## 2. AI purple / Tailwind indigo

### Tell

- violet/indigo primary color,
- black + purple neon theme,
- purple glow accents,
- purple-to-blue gradients,
- violet CTA buttons.

### Why it feels generic

Purple became the default “AI product” color. It now signals template thinking unless there is a brand reason.

### When acceptable

- if the brand already owns purple,
- creative/generative tools where the palette is intentionally expressive,
- when paired with a distinctive non-default system.

### Better alternatives

- graphite + muted blue,
- bone/off-white + ink,
- forest/olive for calm technical products,
- amber/copper for editorial warmth,
- muted cyan for developer tooling,
- monochrome with one restrained accent,
- platform-native colors.

## 3. Gradient hero text

### Tell

- huge centered headline,
- gradient text,
- “Transform your X with AI”,
- subtitle below,
- two CTA buttons,
- empty whitespace.

### Why it feels generic

It is the default AI SaaS landing structure. It often hides weak product positioning behind visual noise.

### When acceptable

- launch microsites,
- hype-driven consumer products,
- if the brand language is intentionally loud.

### Better alternatives

- lead with product screenshot,
- lead with workflow proof,
- use editorial headline treatment,
- use left-aligned asymmetric composition,
- use a dense product command-center hero,
- show real UI state instead of abstract gradient promise.

## 4. Hero + three feature cards + CTA

### Tell

- centered hero,
- three equal cards,
- each card has icon, title, description,
- repeated generic feature copy,
- CTA below.

### Why it feels generic

It is the average SaaS page. It gives every feature equal visual weight and removes product specificity.

### When acceptable

- extremely simple brochure sites,
- MVP placeholders,
- B2B pages with known buyer expectations.

### Better alternatives

- one primary workflow diagram,
- before/after transformation,
- problem/evidence/outcome structure,
- timeline of user action,
- one oversized product screenshot plus supporting details,
- case-study style structure.

## 5. Emoji icons

### Tell

- 🚀 for launch,
- ⚡ for speed,
- 🔒 for security,
- 🤖 for AI,
- ✨ for magic,
- emoji bullets in professional cards.

### Why it feels generic

Emoji icons often signal that the creator did not choose an icon system. They also reduce trust in serious products.

### When acceptable

- informal personal pages,
- playful consumer apps,
- memes,
- social/community products with intentionally casual voice.

### Better alternatives

- SF Symbols for macOS/iOS,
- Lucide for general SaaS,
- Phosphor for softer products,
- custom SVG icons,
- typographic labels instead of icons,
- product screenshots instead of symbolic icons.

## 6. Rounded corners on everything

### Tell

- rounded-2xl / rounded-3xl on every card,
- pill buttons everywhere,
- soft bubbly panels,
- no contrast between container types.

### Why it feels generic

Over-rounding makes products feel like a friendly template instead of a designed system.

### When acceptable

- wellness,
- playful consumer apps,
- kid/family products,
- soft lifestyle brands.

### Better alternatives

- define radius by component role,
- smaller radius for dense tools,
- sharper radius for technical products,
- larger radius only for hero objects or modals,
- platform-native radius rules.

## 7. Dark mode with neon glow

### Tell

- black background,
- purple/cyan glow,
- blurred blobs,
- glowing cards,
- neon border gradients.

### Why it feels generic

AI agents often add glow as decoration when they lack a stronger design concept.

### When acceptable

- gaming,
- cyber/security interfaces,
- nightlife/music products,
- intentionally futuristic visual systems.

### Better alternatives

- dark graphite without glow,
- high-quality contrast and hierarchy,
- restrained accent lines,
- data-first density,
- subtle window/elevation model.

## 8. Generic typography

### Tell

- Inter by default,
- Geist by default,
- system font with no stated reason,
- same size/weight rhythm as every SaaS template,
- no contrast between display, body, labels, and data.

### Why it feels generic

Typography is a major identity layer. If the font choice is default, the product feels default.

### When acceptable

- native platform apps,
- internal tools,
- accessibility-first dashboards,
- when performance is critical.

### Better alternatives

- choose type based on product tone,
- pair display and text faces carefully,
- use mono only for data/code,
- use system fonts intentionally for native apps,
- create distinctive scale and weight rules even with common fonts.

## 9. Decorative motion overload

### Tell

- every card moves on hover,
- scroll reveals everywhere,
- parallax without reason,
- animated gradient backgrounds,
- bouncing icons.

### Why it feels generic

Motion becomes a cheap way to make static UI feel “premium”. It often hurts usability.

### When acceptable

- demos,
- storytelling pages,
- creator products,
- lightweight playful interfaces.

### Better alternatives

- motion only for state changes,
- subtle record/listen transitions,
- loading/processing feedback,
- progressive disclosure,
- command palette transitions,
- accessibility-respecting reduced motion.

## 10. Empty whitespace as fake premium

### Tell

- huge vertical gaps,
- low information density,
- vague copy,
- oversized cards,
- no real product proof.

### Why it feels generic

Whitespace without hierarchy is not design. It is often used to hide lack of substance.

### Better alternatives

- increase useful density,
- show product states,
- add proof, examples, logs, screenshots,
- use whitespace to separate meaning, not decorate emptiness.

# UI Review Checklist

Use this checklist when reviewing generated UI, screenshots, Figma mockups, or frontend code.

## Visual default checks

- [ ] Does it look like a default shadcn/Tailwind demo?
- [ ] Are cards, borders, and buttons mostly unmodified library defaults?
- [ ] Does the UI rely on slate/gray cards without identity?
- [ ] Are all sections equally weighted?

## Color checks

- [ ] Is purple/indigo the main accent without a brand reason?
- [ ] Is there a purple-to-blue gradient?
- [ ] Is there black/purple neon styling?
- [ ] Are semantic colors used clearly?

## Layout checks

- [ ] Is it centered hero + subtitle + two CTAs?
- [ ] Is it followed by three equal feature cards?
- [ ] Does the layout reveal the product workflow?
- [ ] Is there at least one product-specific structural decision?

## Typography checks

- [ ] Is Inter/Geist/system font used without justification?
- [ ] Is the type scale just Tailwind default rhythm?
- [ ] Are labels, body, data, and headings visually distinct?
- [ ] Does typography match product tone?

## Icon checks

- [ ] Are emojis used as feature icons?
- [ ] Is there a coherent icon set?
- [ ] Are icons necessary, or are they decorative filler?

## Motion checks

- [ ] Are hover animations applied to every card?
- [ ] Are scroll reveals excessive?
- [ ] Does motion communicate state/progress?
- [ ] Is reduced motion considered?

## Product specificity checks

- [ ] Could this UI belong to any random AI SaaS?
- [ ] Is there a real product screenshot/state/workflow?
- [ ] Are claims backed by UI, examples, data, or proof?
- [ ] Does the design fit the product's trust requirements?

## Final decision

- AI Slop Score:
- Distinctiveness Score:
- Implementation Readiness Score:

Decision:

- [ ] Ship
- [ ] Revise minor issues
- [ ] Redesign before shipping

# Implementation Readiness Score Rubric

Implementation Readiness Score measures whether the UI plan is concrete enough for a coding agent to implement without drifting into generic defaults.

Scale:

- 0 = too vague to implement well
- 10 = implementation-ready with clear constraints

## Categories

Score each category 0-2 points.

### 1. Clear product context

0 = unclear product/user/action
1 = partially clear
2 = product, user, and primary action are clear

### 2. Concrete visual direction

0 = vague terms like “modern” or “clean” only
1 = visual direction exists but lacks constraints
2 = clear direction with mood, examples, and avoid-list

### 3. Design tokens

0 = no tokens
1 = partial token decisions
2 = palette, type, spacing, radius, elevation, icons, and motion defined

### 4. Layout strategy

0 = no layout strategy
1 = common layout with minor notes
2 = specific layout pattern chosen and justified

### 5. Quality gate

0 = no review criteria
1 = generic review criteria
2 = anti-slop checks and scoring included

## Total score

0-4: Not ready. Agent will likely produce generic UI.

5-6: Barely ready. Needs stronger constraints.

7-8: Good. Agent can implement with limited drift.

9-10: Excellent. Strong implementation brief.

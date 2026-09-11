# Typography Guidance

Typography is one of the fastest ways to escape generic AI UI.

## Principle

Do not choose fonts by default. Choose fonts based on product context, platform, tone, density, and trust requirement.

## Common weak defaults

- Inter because every SaaS uses it,
- Geist because many Next.js projects use it,
- Arial/system font with no stated reason,
- one font size rhythm for all products,
- no distinction between display, body, labels, data, and code.

## When system fonts are good

System fonts are not bad. They are strong when the product should feel native.

Use system fonts intentionally for:

- macOS apps,
- iOS apps,
- internal tools,
- accessibility-first products,
- high-performance dashboards.

For example, a native macOS dictation utility should likely use Apple system typography because it is a macOS utility. That is not generic if the entire design direction is native macOS.

## Font direction by product type

### Native utility

- Apple/system font,
- compact labels,
- clear hierarchy,
- no huge marketing headlines.

### Developer tool

- UI sans + mono pairing,
- mono for commands/logs/paths,
- dense but readable.

### Enterprise dashboard

- neutral UI sans,
- tabular numbers,
- strong label/data hierarchy.

### Research/archive product

- editorial sans or serif pairing,
- readable long-form content,
- mono for sources/IDs/hashes.

### Premium wellness

- warmer sans or soft serif pairing,
- generous line-height,
- calm spacing.

### Crypto intelligence

- compact UI sans,
- mono for addresses/tickers/hashes,
- strong status labels.

## Typography checklist

Before finalizing UI, answer:

- Why this font?
- Does it match the product tone?
- Is there clear hierarchy?
- Are labels visually different from body text?
- Are data values easy to scan?
- Is mono used only where useful?
- Is the type scale distinctive or just default Tailwind?

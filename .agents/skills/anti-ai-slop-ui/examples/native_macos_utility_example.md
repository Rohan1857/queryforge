# Example: Native macOS Utility

Fictional product walkthrough — shows how to apply the skill to a local-first desktop utility (not a SaaS landing page).

## Product

**LocalScribe** — a privacy-first, local-first dictation app for macOS.

The user presses a shortcut, speaks, and the app transcribes or transforms text at the cursor. On-device speech recognition is the default; cloud providers are optional.

## Recommended visual direction

Native macOS Utility.

## Why

LocalScribe should feel like a serious, fast, trustworthy system utility. It should not feel like a generic AI SaaS landing page. The trust promise is local-first privacy and low-friction productivity.

## Design goals

- native macOS feel,
- calm and precise,
- low cognitive load,
- fast recording state feedback,
- clear local/cloud mode distinction,
- no AI hype visuals,
- no purple gradients,
- no emoji icons.

## Token plan

### Palette

- Background: macOS off-white / graphite depending on theme,
- Surface: translucent native panel surface,
- Border: subtle separator gray,
- Primary text: near-black or near-white,
- Secondary text: muted gray,
- Accent: muted blue-gray or system blue,
- Privacy/local status: muted green,
- Warning/cloud status: muted amber.

### Typography

- Apple system font,
- compact labels,
- clear status text,
- mono only for model names, paths, or logs if needed.

### Radius

- follow macOS panel conventions,
- smaller radius for controls,
- medium radius for floating overlay,
- avoid rounded-3xl SaaS cards.

### Elevation

- subtle window-like shadow,
- no neon glow,
- no dramatic card shadows.

### Icons

- SF Symbols preferred,
- consistent line icons acceptable,
- no emoji icons.

### Motion

- recording/listening pulse,
- compact overlay transition,
- state change between idle/listening/transcribing/pasting,
- no scroll reveal or decorative animation.

## Layout ideas

### 1. Menu bar popover

Compact panel:

- current mode,
- selected microphone,
- selected model,
- local/cloud status,
- last transcription preview,
- quick settings.

### 2. Recording overlay

Minimal floating overlay:

- waveform or listening indicator,
- language/model indicator,
- cancel/finish hint,
- privacy badge if local.

### 3. Preferences window

Native settings layout:

- General,
- Shortcuts,
- Models,
- Providers,
- Privacy,
- Advanced.

### 4. Command/edit mode overlay

When text is selected:

- selected text preview,
- spoken command preview,
- transformation result,
- accept/replace/cancel.

## Landing page strategy

Avoid generic SaaS hero.

Use:

- asymmetric hero,
- one strong macOS app screenshot,
- local-first proof strip,
- workflow storyboard:
  1. select text or place cursor,
  2. press shortcut,
  3. speak,
  4. LocalScribe pastes or transforms,
  5. local by default.

## Forbidden patterns for this product

- purple-to-blue gradient headline,
- “Transform your workflow with AI”,
- emoji icons,
- three equal feature cards as main section,
- neon dark mode,
- glassmorphism overload,
- fake bento grid without product logic,
- heavy marketing tone,
- generic AI assistant mascot.

## Good hero copy direction

Prefer concrete utility language:

- “Dictation that stays on your Mac.”
- “Press, speak, paste. Locally by default.”
- “Fast macOS dictation with on-device models and optional cloud providers.”

Avoid:

- “Transform your productivity with AI.”
- “The future of writing is here.”
- “Unlock magical AI workflows.”

## Anti-slop target

AI Slop Score target: 0-3/10.

Distinctiveness Score target: 7-9/10.

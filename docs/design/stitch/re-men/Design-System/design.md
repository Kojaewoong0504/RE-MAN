# Design System Strategy: The Architectural Concierge

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Architectural Concierge."** 

We are moving away from the "app-as-a-tool" aesthetic and toward "app-as-an-atelier." The goal is to provide a sense of silent, high-end service. This is achieved through an editorial layout—utilizing generous white space, intentional asymmetry, and a focus on tonal depth rather than structural lines. By avoiding standard "boxed" layouts, we create a digital environment that feels curated and authoritative, instilling confidence in men who find grooming a complex task.

The layout should feel like a premium lifestyle magazine: high-contrast typography, overlapping imagery, and a sense of "breathable" luxury that prioritizes clarity over density.

---

## 2. Colors & Surface Philosophy
This design system utilizes a sophisticated palette of deep navies and slates to establish trust, punctuated by a muted emerald for moments of decisive action.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders for sectioning or containment. Traditional borders create visual noise and look "templated." Instead, boundaries must be defined solely through:
- **Background Color Shifts:** Use a `surface-container-low` section sitting on a `surface` background.
- **Tonal Transitions:** Use subtle shifts in lightness to define where one area ends and another begins.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine paper.
- **Surface (Base):** Your primary canvas (`#f8f9fa`).
- **Surface Container Lowest:** For background cards that need to recede.
- **Surface Container Highest:** For high-priority content blocks that need to "pop" without using shadows.
*Example:* A `surface-container-lowest` card placed inside a `surface-container-low` section creates a soft, natural depth that feels integrated, not pasted.

### The "Glass & Gradient" Rule
To add "soul" to the professional palette:
- **Glassmorphism:** For floating navigation or action bars, use semi-transparent surface colors (`#ffffff` at 70% opacity) with a `backdrop-filter: blur(20px)`.
- **Signature Gradients:** For primary CTAs, do not use flat colors. Use a subtle linear gradient from `primary` (`#051125`) to `primary-container` (`#1b263b`). This mimics the sheen of high-quality textiles.

---

## 3. Typography
We use a dual-font approach to balance editorial authority with functional clarity.

- **Display & Headlines (Manrope):** This is our "Editorial" voice. Manrope’s geometric yet warm proportions convey modern professionalism. Use `display-lg` and `headline-md` with tighter letter-spacing (-2%) to create a "locked-in," premium look for headers.
- **Title, Body, & Labels (Inter):** This is our "Utility" voice. Inter is used for instructions, grooming tips, and product details. It provides high legibility and a sense of efficient help.

**Visual Hierarchy Tip:** Use `display-sm` in `primary` against a `surface` background to command attention, then transition to `body-md` in `on-surface-variant` for descriptive text to create a clear, sophisticated reading path.

---

## 4. Elevation & Depth
Depth in this system is achieved through **Tonal Layering**, not structural decoration.

- **The Layering Principle:** Use the Surface Scale. Place `surface-container-highest` elements (like a featured grooming tip) on a `surface` background to create a "lifted" effect.
- **Ambient Shadows:** Shadows are a last resort. When used, they must be "Ambient":
    - **Blur:** 24px - 40px.
    - **Opacity:** 4% - 6%.
    - **Color:** Use a tinted version of `on-surface` (dark navy) rather than pure black to keep the light feeling natural.
- **The "Ghost Border" Fallback:** If a border is required for accessibility (e.g., in high-contrast modes), use the `outline-variant` token at **15% opacity**. Never use 100% opaque lines.

---

## 5. Components

### Buttons
- **Primary:** Gradient from `primary` to `primary-container`. `rounded-md` (0.75rem). High-contrast `on-primary` text.
- **Secondary:** `surface-container-highest` background with `on-secondary-container` text. No border.
- **Tertiary/Ghost:** Text-only in `secondary` color, using a subtle `surface-variant` hover state.

### Cards & Lists
- **The "No-Divider" Rule:** Forbid the use of divider lines. Separate list items using `1.5rem` (xl) vertical white space or by alternating background tones between `surface` and `surface-container-low`.
- **Interactive Cards:** Use `rounded-lg` (1rem). Ensure high-quality imagery is masked with the same corner radius.

### Input Fields
- **Style:** Background should be `surface-container-highest`. 
- **States:** On focus, do not use a heavy border. Use a 2px `primary` underline or a subtle scale-up of the container to signal activity.
- **Error:** Use the `error` (`#ba1a1a`) token only for the supporting text and a 2px bottom border.

### Grooming Progress Chips
- Use `tertiary-container` for completed steps. The muted emerald (`#002d1c`) signifies success without being jarringly bright, maintaining the "sophisticated" tone.

---

## 6. Do’s and Don’ts

### Do:
- **Embrace Asymmetry:** Align a headline to the left and a supporting image slightly offset to the right to create an editorial feel.
- **Use "Breathing Room":** If you think a section has enough padding, add 8px more. White space is a luxury.
- **Layer Textures:** Use subtle background shifts to guide the eye from "Analysis" to "Recommendation."

### Don’t:
- **Don’t use 1px Dividers:** It breaks the "Architectural" flow and makes the app feel like a generic dashboard.
- **Don’t use Jet Black:** Always use `primary` (#051125) or `on-surface` for text. Pure black is too harsh for this sophisticated palette.
- **Don’t Over-Round:** Stick to the `md` (0.75rem) and `lg` (1rem) tokens. "Pill" shapes should be reserved only for Chips/Tags, never for primary containers.
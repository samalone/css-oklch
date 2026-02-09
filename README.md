# CSS OKLCH Color Preview

A VSCode/Cursor extension that adds inline color swatches and a native OKLCH color picker for `oklch()` colors in CSS, SCSS, and Less files.

## Features

**Inline color swatches** — `oklch()` values in your stylesheets get color decorations automatically, just like hex and rgb colors.

**OKLCH color picker** — A dedicated picker that works directly in OKLCH space, so adjusting lightness, chroma, and hue behaves as expected with no perceptual lightness pulsing.

- 2D Hue x Chroma color plane with sRGB gamut boundary visualization
- L, C, H, and Alpha sliders with numeric inputs
- Eyedropper for picking colors from your screen
- One-click copy for `oklch()` and hex values
- Apply to replace an existing `oklch()` value, or insert a new one
- Out-of-gamut warning with clamped preview
- Keyboard navigation between sliders and action buttons
- Theme-aware UI that matches your VSCode color theme

## Usage

The extension activates automatically for CSS, SCSS, and Less files.

**Color swatches** appear inline next to any `oklch()` value.

**Open the color picker** with:
- `Alt+Cmd+O` (Mac) / `Ctrl+Alt+O` (Windows/Linux)
- Command Palette: "OKLCH: Open Color Picker"

If your cursor is inside an `oklch()` value, the picker opens with that color pre-loaded and the Apply button enabled. Moving your cursor to a different `oklch()` value updates the picker automatically.

## Supported Syntax

- `oklch(0.7 0.15 180)`
- `oklch(70% 0.15 180deg)`
- `oklch(0.7 0.15 180 / 0.5)`
- `oklch(0.7 0.15 180 / 50%)`
- Angle units: `deg`, `grad`, `rad`, `turn`
- `none` keyword for any component
- Percentage values for lightness, chroma, and alpha

## License

MIT

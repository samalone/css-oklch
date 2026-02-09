# CSS OKLCH Color Preview

A VSCode/Cursor extension that adds inline color swatches, a native OKLCH color picker, and color format conversion for CSS, SCSS, and Less files.

## Features

**Inline color swatches** — `oklch()` values in your stylesheets get color decorations automatically, just like hex and rgb colors.

**OKLCH color picker** — A dedicated picker that works directly in OKLCH space, so adjusting lightness, chroma, and hue behaves as expected with no perceptual lightness pulsing.

- 2D Hue x Chroma color plane with sRGB gamut boundary visualization
- L, C, H, and Alpha sliders with numeric inputs
- Eyedropper for picking colors from your screen
- One-click copy for `oklch()` and hex values
- Apply to replace an existing color value, or insert a new one
- Out-of-gamut warning with clamped preview
- Keyboard navigation between sliders and action buttons
- Theme-aware UI that matches your VSCode color theme

**CSS color detection** — The picker recognizes colors in other CSS formats and can convert them to `oklch()`:

- Hex: `#rgb`, `#rrggbb`, `#rgba`, `#rrggbbaa`
- `rgb()` / `rgba()`
- `hsl()` / `hsla()`
- `oklab()`
- All 148 CSS named colors (e.g. `rebeccapurple`, `tomato`)

When your cursor is on any of these color formats, the picker opens with that color pre-loaded and Apply replaces the original value with `oklch()`.

**Contrast checker** — Compare two colors with live accessibility feedback:

- APCA (Accessible Perceptual Contrast Algorithm) contrast with usage guidance
- WCAG 2.x contrast ratio with AA/AAA pass/fail badges
- Side-by-side text preview showing both color-on-color combinations
- **Independent mode**: choose the derived color freely with L/C/H/A sliders
- **Relative mode**: define the derived color as a formula based on the base color
  - Lightness shift, chroma scale, and hue shift transforms
  - Presets: Accessible text, Subtle background, Border, Complementary
  - "Accessible text" preset auto-computes lightness for a target APCA Lc via binary search
  - Live CSS `oklch(from var(--base) ...)` expression preview with copy button
- Color-coded contrast values (green/orange/red)
- Apply/Insert derived color, or insert the relative CSS expression

**Batch conversion commands** — Convert multiple colors at once:

- **Convert Selection to oklch** — Converts all CSS colors in the selected text to `oklch()` in your preferred format.
- **Convert Document to oklch** — Converts all CSS colors in the entire document to `oklch()` in your preferred format.

These commands convert other color formats (hex, rgb, hsl, etc.) to `oklch()`, and also reformat any existing `oklch()` values to match your format settings.

**Output format settings** — Control how `oklch()` values are formatted:

| Setting | Options | Default | Example |
|---------|---------|---------|---------|
| Lightness format | `number`, `percentage` | `number` | `0.7` vs `70%` |
| Chroma format | `number`, `percentage` | `number` | `0.15` vs `37.5%` |
| Hue format | `number`, `deg` | `number` | `180` vs `180deg` |
| Alpha format | `number`, `percentage` | `number` | `0.8` vs `80%` |

Format settings are applied everywhere: the picker preview, Apply/Insert, Copy, and batch conversion commands. Slider inputs in the picker also display values in your preferred format.

## Usage

The extension activates automatically for CSS, SCSS, and Less files.

**Color swatches** appear inline next to any `oklch()` value.

**Open the color picker** with:
- `Alt+Cmd+O` (Mac) / `Ctrl+Alt+O` (Windows/Linux)
- Command Palette: "OKLCH: Open Color Picker"

If your cursor is on any CSS color value, the picker opens with that color pre-loaded and the Apply button enabled. Moving your cursor to a different color value updates the picker automatically.

**Open the contrast checker** with:
- `Alt+Cmd+Shift+O` (Mac) / `Ctrl+Alt+Shift+O` (Windows/Linux)
- Command Palette: "OKLCH: Open Contrast Checker"

If your cursor is on a CSS color value, it becomes the base color. Toggle between Independent and Relative modes to either pick a derived color directly or define it as a formula from the base.

**Convert colors** with:
- Command Palette: "OKLCH: Convert Selection to oklch"
- Command Palette: "OKLCH: Convert Document to oklch"

**Configure output format** in Settings under "CSS OKLCH", or search for "oklch" in Settings.

## Supported OKLCH Syntax

- `oklch(0.7 0.15 180)`
- `oklch(70% 0.15 180deg)`
- `oklch(0.7 0.15 180 / 0.5)`
- `oklch(0.7 0.15 180 / 50%)`
- Angle units: `deg`, `grad`, `rad`, `turn`
- `none` keyword for any component
- Percentage values for lightness, chroma, and alpha

## License

MIT

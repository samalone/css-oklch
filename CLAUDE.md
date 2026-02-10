# CSS OKLCH Color Preview

VSCode/Cursor extension that provides OKLCH color swatches, a custom OKLCH color picker, and CSS color format conversion for CSS, SCSS, and Less files.

## Build

```bash
npm run compile        # Type-check + bundle
npm run watch          # Watch mode (type-check + esbuild)
npm run package        # Production build
npm test               # Run unit and integration tests
```

Press F5 in VSCode/Cursor to launch the Extension Development Host for testing.

## Workflow

Before committing changes, always run the tests and type-check:

```bash
npm test && npm run compile
```

## Architecture

- `src/extension.ts` — Entry point. Registers the `DocumentColorProvider`, the color picker command, the contrast checker command, the adaptive formula command, and the batch conversion commands (`cssOklch.convertSelection`, `cssOklch.convertDocument`).
- `src/colorProvider.ts` — `DocumentColorProvider` implementation. Scans documents for `oklch()` values and provides inline color swatches.
- `src/oklchParser.ts` — Regex-based parser for CSS `oklch()` syntax. Handles percentages, angle units (deg/grad/rad/turn), `none` keyword, and alpha. Skips relative color syntax (`oklch(from ...)`).
- `src/cssColorParser.ts` — Detects non-oklch CSS color formats (hex, rgb/rgba, hsl/hsla, oklab, named colors) and converts them to OKLCH. Provides `findCssColorAtOffset()` for cursor-based detection and `findAllCssColors()` for batch scanning. Contains a full map of all 148 CSS named colors.
- `src/colorConversion.ts` — OKLCH/OKLab/sRGB conversion math based on Bjorn Ottosson's reference implementation. Also includes `hslToSrgb()` and `oklabToOklch()` for CSS color format conversion.
- `src/formatOklch.ts` — Shared OKLCH formatting module. Reads user settings (`cssOklch.lightnessFormat`, etc.) and formats L/C/H/alpha components accordingly. Used by both the picker panel and the batch conversion commands.
- `src/contrastMath.ts` — Pure functions for APCA and WCAG 2.x contrast computation. APCA uses simple pow(x, 2.4) gamma (not piecewise sRGB), soft-clamping, and polarity-aware exponents. WCAG uses standard piecewise sRGB linearization.
- `src/panelBase.ts` — Shared panel lifecycle module. Exports `OklchColor` interface, `createPanel()` (encapsulates singleton pattern, editor tracking, cursor context notifications, nonce generation, and message handling), and editor action helpers (`applyColorAtCursor`, `insertColorAtCursor`, `insertExpressionAtCursor`). Used by all three panel files.
- `src/webviewScripts.ts` — Shared inline JavaScript string constants for webview interpolation. These are not runnable Node modules — they are JS code strings interpolated into `<script>` tags. Exports `WEBVIEW_COLOR_CORE` (oklchToSrgb, linToSrgb, clamp01, toHex), `WEBVIEW_GAMUT_CHECK` (isInGamut), `WEBVIEW_SRGB_TO_OKLCH` (srgbToLinear, srgbToOklch), `WEBVIEW_CONTRAST_MATH` (computeAPCA, apcaDescription, computeWCAG), and `webviewFormatScript()` (format settings + formatOklchValue).
- `src/webviewStyles.ts` — Shared CSS string constants for webview interpolation. Exports `CSS_BASE` (reset, body, h3, .section), `cssSliders()` (parameterized grid layout for slider rows), `CSS_COPY_BUTTON` (.copy-btn, .copied-msg), `CSS_TRANSFORM_CONTROLS` (.transform-row, .preset-btn, .target-lc-row, .css-expr-*), and `CSS_ACTION_BUTTONS` (.buttons, button.action).
- `src/contrastPanel.ts` — Webview-based contrast checker panel. Compares a base color and derived color with live APCA/WCAG contrast feedback. Supports independent mode (direct sliders) and relative mode (formula-based derived color with presets). Generates CSS `oklch(from var(--base) ...)` expressions. Uses shared modules from panelBase, webviewScripts, and webviewStyles.
- `src/formulaPanel.ts` — Webview-based adaptive color formula panel. Helps design relative color formulas that maintain contrast guarantees across a range of base color values where one OKLCH component varies. Sweeps the variable component, computes min/max APCA/WCAG contrast via sampling + golden section refinement, and displays a contrast chart with threshold lines and min/max markers. Uses shared modules from panelBase, webviewScripts, and webviewStyles.
- `src/pickerPanel.ts` — Webview-based color picker panel. Uses shared modules from panelBase, webviewScripts, and webviewStyles. Features:
  - 2D Hue x Chroma canvas with sRGB gamut boundaries
  - L/C/H/Alpha sliders with format-aware numeric inputs
  - Eyedropper (uses the EyeDropper API when available)
  - Copy buttons for oklch() and hex values
  - Apply (replace existing CSS color with oklch()) and Insert New actions
  - Preview text formatted according to user settings

## Commands

- `cssOklch.openColorPicker` — Open the OKLCH color picker. If the cursor is on any CSS color (oklch, hex, rgb, hsl, oklab, or named), it opens with that color pre-loaded.
- `cssOklch.openContrastPanel` — Open the OKLCH contrast checker. If the cursor is on a CSS color, it opens with that as the base color.
- `cssOklch.openFormulaPanel` — Open the Adaptive Formula panel. If the cursor is on a CSS color, initializes the fixed components from it.
- `cssOklch.convertSelection` — Convert all CSS colors in the current selection to `oklch()`. Converts other formats and reformats existing `oklch()` values to match user settings.
- `cssOklch.convertDocument` — Convert all CSS colors in the entire document to `oklch()`. Converts other formats and reformats existing `oklch()` values to match user settings.

## Settings

Four settings under `cssOklch` control output format:

- `cssOklch.lightnessFormat` — `"number"` (default) or `"percentage"`
- `cssOklch.chromaFormat` — `"number"` (default) or `"percentage"`
- `cssOklch.hueFormat` — `"number"` (default) or `"deg"`
- `cssOklch.alphaFormat` — `"number"` (default) or `"percentage"`

These settings affect the picker preview, Apply/Insert/Copy output, slider displays, and batch conversion commands.

## Key Details

- Webview JS math (color conversion, contrast computation, format settings) is shared via string constants in `webviewScripts.ts`, interpolated into each panel's `<script>` tag. These run in the webview's isolated browser context, not the extension host.
- Webview CSS is shared via string constants in `webviewStyles.ts`, interpolated into each panel's `<style>` tag. Panel-specific styles remain inline in the respective panel files.
- All three panels use `createPanel()` from `panelBase.ts` which encapsulates the singleton pattern, editor/cursor tracking (`lastEditor`, `lastCursorOffset`), and cursor context notifications. This handles the focus-stealing issue when the user clicks webview buttons.
- Format settings are passed into the webview as JS variables and mirrored in a `formatOklchValue()` function so the preview matches what Apply/Insert produces.
- `findCssColorAtOffset()` checks oklch first, then functional colors (rgb/hsl/oklab), then hex, then named colors, returning the narrowest match at the cursor position.
- `findAllCssColors()` scans the full document for all CSS colors including existing `oklch()` values, used by the batch conversion commands. Results are sorted by offset for end-to-start replacement. Including oklch values allows the batch commands to reformat them to the user's preferred format settings.
- CSP is enforced on the webview using a nonce. Inline `style=""` attributes in HTML are blocked by the nonce-only `style-src` policy. Dynamic styles must be set via JavaScript DOM properties (e.g. `el.style.backgroundColor = ...`), not via `innerHTML` with style attributes.
- Bundled with esbuild; `vscode` is external.

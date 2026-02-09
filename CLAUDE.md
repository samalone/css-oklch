# CSS OKLCH Color Preview

VSCode/Cursor extension that provides OKLCH color swatches and a custom OKLCH color picker for CSS, SCSS, and Less files.

## Build

```bash
npm run compile        # Type-check + bundle
npm run watch          # Watch mode (type-check + esbuild)
npm run package        # Production build
```

Press F5 in VSCode/Cursor to launch the Extension Development Host for testing.

## Architecture

- `src/extension.ts` — Entry point. Registers the `DocumentColorProvider` and the `cssOklch.openColorPicker` command.
- `src/colorProvider.ts` — `DocumentColorProvider` implementation. Scans documents for `oklch()` values and provides inline color swatches.
- `src/oklchParser.ts` — Regex-based parser for CSS `oklch()` syntax. Handles percentages, angle units (deg/grad/rad/turn), `none` keyword, and alpha. Skips relative color syntax (`oklch(from ...)`).
- `src/colorConversion.ts` — OKLCH/OKLab/sRGB conversion math based on Bjorn Ottosson's reference implementation.
- `src/pickerPanel.ts` — Webview-based color picker panel with:
  - 2D Hue x Chroma canvas with sRGB gamut boundaries
  - L/C/H/Alpha sliders
  - Eyedropper (uses the EyeDropper API when available)
  - Copy buttons for oklch() and hex values
  - Apply (replace existing oklch()) and Insert New actions

## Key Details

- The webview contains an inline copy of the OKLCH-to-sRGB conversion math (and sRGB-to-OKLCH for the eyedropper) so the picker can update in real-time without round-tripping to the extension host.
- The picker tracks `lastEditor` and `lastCursorOffset` via `onDidChangeActiveTextEditor` and `onDidChangeTextEditorSelection` to handle the focus-stealing issue when the user clicks webview buttons.
- CSP is enforced on the webview using a nonce.
- Bundled with esbuild; `vscode` is external.

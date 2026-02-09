import * as vscode from "vscode";
import * as crypto from "crypto";
import { findCssColorAtOffset } from "./cssColorParser";
import { formatOklch, getFormatOptions } from "./formatOklch";

interface OklchColor {
  L: number;
  C: number;
  H: number;
  alpha: number;
}

let currentPanel: vscode.WebviewPanel | undefined;
let lastEditor: vscode.TextEditor | undefined;
let lastCursorOffset: number | undefined;

export function openContrastPanel(
  context: vscode.ExtensionContext,
  initialBaseColor?: OklchColor
): void {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    lastEditor = editor;
    lastCursorOffset = editor.document.offsetAt(editor.selection.active);
  }

  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.Beside);
    if (initialBaseColor) {
      currentPanel.webview.postMessage({
        command: "setBaseColor",
        ...initialBaseColor,
      });
    }
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "oklchContrastChecker",
    "OKLCH Contrast Checker",
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: true, retainContextWhenHidden: true }
  );

  currentPanel = panel;

  function notifyCursorContext(): void {
    if (!currentPanel || !lastEditor) {
      return;
    }
    const text = lastEditor.document.getText();
    const offset = lastCursorOffset ?? 0;
    const match = findCssColorAtOffset(text, offset);
    if (match) {
      currentPanel.webview.postMessage({
        command: "cursorContext",
        hasCssColor: true,
        L: match.L,
        C: match.C,
        H: match.H,
        alpha: match.alpha,
      });
    } else {
      currentPanel.webview.postMessage({
        command: "cursorContext",
        hasCssColor: false,
      });
    }
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((e) => {
      if (e) {
        lastEditor = e;
        lastCursorOffset = e.document.offsetAt(e.selection.active);
        notifyCursorContext();
      }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((e) => {
      lastEditor = e.textEditor;
      lastCursorOffset = e.textEditor.document.offsetAt(e.selections[0].active);
      notifyCursorContext();
    })
  );

  panel.onDidDispose(() => {
    currentPanel = undefined;
  });

  const nonce = crypto.randomBytes(16).toString("base64");
  panel.webview.html = getContrastWebviewHtml(nonce, initialBaseColor);

  panel.webview.onDidReceiveMessage(
    (message) => {
      if (!lastEditor) {
        vscode.window.showWarningMessage("No active text editor.");
        return;
      }
      const editor = lastEditor;

      switch (message.command) {
        case "apply": {
          const { L, C, H, alpha } = message;
          const oklchStr = formatOklch(L, C, H, alpha);
          const doc = editor.document;
          const text = doc.getText();
          const offset = lastCursorOffset ?? doc.offsetAt(editor.selection.active);
          const colorMatch = findCssColorAtOffset(text, offset);
          if (colorMatch) {
            const range = new vscode.Range(
              doc.positionAt(colorMatch.startOffset),
              doc.positionAt(colorMatch.endOffset)
            );
            editor.edit((editBuilder) => {
              editBuilder.replace(range, oklchStr);
            });
          } else {
            vscode.window.showWarningMessage(
              "No CSS color value found at cursor position. Use 'Insert' instead."
            );
          }
          break;
        }
        case "insert": {
          const { L, C, H, alpha } = message;
          const oklchStr = formatOklch(L, C, H, alpha);
          editor.edit((editBuilder) => {
            editBuilder.insert(editor.selection.active, oklchStr);
          });
          break;
        }
        case "insertRelative": {
          const { expression } = message;
          editor.edit((editBuilder) => {
            editBuilder.insert(editor.selection.active, expression);
          });
          break;
        }
      }
    },
    undefined,
    context.subscriptions
  );
}

function getContrastWebviewHtml(
  nonce: string,
  initialBaseColor?: OklchColor
): string {
  const baseL = initialBaseColor?.L ?? 0.95;
  const baseC = initialBaseColor?.C ?? 0.01;
  const baseH = initialBaseColor?.H ?? 240;
  const baseA = initialBaseColor?.alpha ?? 1;
  const fmtOpts = getFormatOptions();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <style nonce="${nonce}">
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      padding: 12px;
    }
    h3 {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.7;
      margin-bottom: 8px;
    }
    .section {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--vscode-panel-border, #444);
    }
    .section:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    /* Color info row */
    .color-info {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 8px;
    }
    .swatch-wrap {
      width: 40px;
      height: 40px;
      border-radius: 4px;
      flex-shrink: 0;
      position: relative;
      overflow: hidden;
      background-image:
        linear-gradient(45deg, #808080 25%, transparent 25%),
        linear-gradient(-45deg, #808080 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #808080 75%),
        linear-gradient(-45deg, transparent 75%, #808080 75%);
      background-size: 10px 10px;
      background-position: 0 0, 0 5px, 5px -5px, -5px 0;
    }
    .swatch-inner {
      position: absolute;
      inset: 0;
    }
    .color-values {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .copy-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      padding: 1px 4px;
      border-radius: 3px;
      cursor: pointer;
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .copy-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    }
    .copy-btn svg { opacity: 0.5; flex-shrink: 0; }
    .copy-btn:hover svg { opacity: 1; }
    .copied-msg {
      font-size: 11px;
      opacity: 0;
      transition: opacity 0.15s;
      margin-left: 2px;
    }
    .copied-msg.visible { opacity: 1; }

    /* Sliders */
    .slider-group { margin-bottom: 4px; }
    .slider-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 2px;
    }
    .slider-label {
      width: 18px;
      font-size: 11px;
      flex-shrink: 0;
      font-weight: 600;
      opacity: 0.7;
    }
    .slider-row input[type="range"] {
      flex: 1;
      min-width: 0;
    }
    .slider-row input[type="range"]:focus {
      outline: 2px solid var(--vscode-input-background);
      outline-offset: 2px;
    }
    .slider-row input[type="number"] {
      width: 62px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 2px;
      padding: 1px 3px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
    }
    .slider-unit {
      font-size: 11px;
      opacity: 0.6;
      min-width: 20px;
    }

    /* Contrast results */
    .contrast-results {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .contrast-metric {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .contrast-label {
      font-size: 11px;
      font-weight: 600;
      opacity: 0.7;
      min-width: 48px;
    }
    .contrast-value {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 14px;
      font-weight: 700;
    }
    .contrast-value.good { color: #4caf50; }
    .contrast-value.ok { color: #ff9800; }
    .contrast-value.poor { color: #f44336; }
    .contrast-desc {
      font-size: 11px;
      opacity: 0.7;
    }
    .badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
      margin-left: 4px;
    }
    .badge-pass {
      background: #2e7d32;
      color: #fff;
    }
    .badge-fail {
      background: #c62828;
      color: #fff;
    }

    /* Text preview */
    .preview-row {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
    .preview-box {
      flex: 1;
      padding: 10px;
      border-radius: 4px;
      text-align: center;
      font-size: 16px;
      font-weight: 500;
      border: 1px solid var(--vscode-panel-border, #444);
    }
    .preview-label {
      font-size: 10px;
      opacity: 0.5;
      display: block;
      margin-top: 4px;
    }
    .alpha-note {
      font-size: 11px;
      opacity: 0.6;
      font-style: italic;
      margin-top: 4px;
      display: none;
    }

    /* Mode toggle */
    .mode-toggle {
      display: flex;
      gap: 0;
      margin-bottom: 10px;
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 3px;
      overflow: hidden;
    }
    .mode-btn {
      flex: 1;
      padding: 4px 8px;
      border: none;
      background: transparent;
      color: var(--vscode-editor-foreground);
      cursor: pointer;
      font-size: 12px;
      transition: background 0.1s;
    }
    .mode-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    }
    .mode-btn.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    /* Relative mode controls */
    .relative-controls { display: none; }
    .relative-controls.visible { display: block; }
    .independent-controls { display: none; }
    .independent-controls.visible { display: block; }

    .transform-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }
    .transform-row input[type="checkbox"] {
      flex-shrink: 0;
    }
    .transform-row label {
      font-size: 12px;
      min-width: 60px;
      flex-shrink: 0;
    }
    .transform-row select {
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 2px;
      padding: 1px 3px;
      font-size: 11px;
    }
    .transform-row input[type="range"] {
      flex: 1;
      min-width: 0;
    }
    .transform-row input[type="number"] {
      width: 56px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 2px;
      padding: 1px 3px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
    }

    /* Presets */
    .presets {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 10px;
    }
    .preset-btn {
      padding: 3px 8px;
      font-size: 11px;
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 3px;
      background: transparent;
      color: var(--vscode-editor-foreground);
      cursor: pointer;
    }
    .preset-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    }
    .preset-btn.active {
      border-color: var(--vscode-button-background);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    /* CSS expression */
    .css-expression {
      margin-top: 8px;
      display: none;
    }
    .css-expression.visible {
      display: block;
    }
    .css-expr-label {
      font-size: 11px;
      opacity: 0.7;
      margin-bottom: 4px;
    }
    .css-expr-code {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 3px;
      padding: 6px 8px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      word-break: break-all;
    }
    .css-expr-text {
      flex: 1;
    }

    /* Target Lc selector for accessible text preset */
    .target-lc-row {
      display: none;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }
    .target-lc-row.visible {
      display: flex;
    }
    .target-lc-row label {
      font-size: 11px;
      opacity: 0.7;
    }
    .target-lc-row select {
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 2px;
      padding: 1px 3px;
      font-size: 11px;
    }

    /* Action buttons */
    .buttons {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    button.action {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 5px 12px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 12px;
    }
    button.action:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button.action.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.action.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    button.action:disabled {
      opacity: 0.4;
      cursor: default;
    }
  </style>
</head>
<body>

  <!-- Section 1: Base Color -->
  <div class="section">
    <h3>Base Color</h3>
    <div class="color-info">
      <div class="swatch-wrap"><div class="swatch-inner" id="baseSwatch"></div></div>
      <div class="color-values">
        <button class="copy-btn" id="baseCopyOklch" title="Copy oklch value"><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4h1V2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h1zm1 0h4a1 1 0 0 1 1 1v5h1V2H6v2zm-2 1v8h6V5H3z"/></svg><span id="baseOklchText"></span><span class="copied-msg" id="baseCopiedOklch">Copied!</span></button>
        <button class="copy-btn" id="baseCopyHex" title="Copy hex value"><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4h1V2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h1zm1 0h4a1 1 0 0 1 1 1v5h1V2H6v2zm-2 1v8h6V5H3z"/></svg><span id="baseHexText"></span><span class="copied-msg" id="baseCopiedHex">Copied!</span></button>
      </div>
    </div>
    <div class="slider-group">
      <div class="slider-row">
        <span class="slider-label">L</span>
        <input type="range" id="baseSliderL" min="0" max="1" step="0.001">
        <input type="number" id="baseNumL" min="0" max="${fmtOpts.lightnessFormat === "percentage" ? "100" : "1"}" step="${fmtOpts.lightnessFormat === "percentage" ? "0.1" : "0.001"}">
        ${fmtOpts.lightnessFormat === "percentage" ? '<span class="slider-unit">%</span>' : ""}
      </div>
      <div class="slider-row">
        <span class="slider-label">C</span>
        <input type="range" id="baseSliderC" min="0" max="0.4" step="0.001">
        <input type="number" id="baseNumC" min="0" max="${fmtOpts.chromaFormat === "percentage" ? "125" : "0.5"}" step="${fmtOpts.chromaFormat === "percentage" ? "0.1" : "0.001"}">
        ${fmtOpts.chromaFormat === "percentage" ? '<span class="slider-unit">%</span>' : ""}
      </div>
      <div class="slider-row">
        <span class="slider-label">H</span>
        <input type="range" id="baseSliderH" min="0" max="360" step="0.5">
        <input type="number" id="baseNumH" min="0" max="360" step="0.5">
        ${fmtOpts.hueFormat === "deg" ? '<span class="slider-unit">deg</span>' : ""}
      </div>
      <div class="slider-row">
        <span class="slider-label">A</span>
        <input type="range" id="baseSliderA" min="0" max="1" step="0.01">
        <input type="number" id="baseNumA" min="0" max="${fmtOpts.alphaFormat === "percentage" ? "100" : "1"}" step="${fmtOpts.alphaFormat === "percentage" ? "1" : "0.01"}">
        ${fmtOpts.alphaFormat === "percentage" ? '<span class="slider-unit">%</span>' : ""}
      </div>
    </div>
  </div>

  <!-- Section 2: Contrast Results -->
  <div class="section">
    <h3>Contrast</h3>
    <div class="contrast-results">
      <div class="contrast-metric">
        <span class="contrast-label">APCA</span>
        <span class="contrast-value" id="apcaValue">—</span>
        <span class="contrast-desc" id="apcaDesc"></span>
      </div>
      <div class="contrast-metric">
        <span class="contrast-label">WCAG</span>
        <span class="contrast-value" id="wcagValue">—</span>
        <span id="wcagBadges"></span>
      </div>
    </div>
    <div class="preview-row">
      <div class="preview-box" id="previewDerivedOnBase">
        Sample Aa
        <span class="preview-label">Derived on Base</span>
      </div>
      <div class="preview-box" id="previewBaseOnDerived">
        Sample Aa
        <span class="preview-label">Base on Derived</span>
      </div>
    </div>
    <div class="alpha-note" id="alphaNote">Contrast assumes opaque colors</div>
  </div>

  <!-- Section 3: Derived Color -->
  <div class="section">
    <h3>Derived Color</h3>
    <div class="color-info">
      <div class="swatch-wrap"><div class="swatch-inner" id="derivedSwatch"></div></div>
      <div class="color-values">
        <button class="copy-btn" id="derivedCopyOklch" title="Copy oklch value"><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4h1V2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h1zm1 0h4a1 1 0 0 1 1 1v5h1V2H6v2zm-2 1v8h6V5H3z"/></svg><span id="derivedOklchText"></span><span class="copied-msg" id="derivedCopiedOklch">Copied!</span></button>
        <button class="copy-btn" id="derivedCopyHex" title="Copy hex value"><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4h1V2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h1zm1 0h4a1 1 0 0 1 1 1v5h1V2H6v2zm-2 1v8h6V5H3z"/></svg><span id="derivedHexText"></span><span class="copied-msg" id="derivedCopiedHex">Copied!</span></button>
      </div>
    </div>

    <div class="mode-toggle">
      <button class="mode-btn active" id="modeIndependent">Independent</button>
      <button class="mode-btn" id="modeRelative">Relative</button>
    </div>

    <!-- Independent mode sliders -->
    <div class="independent-controls visible" id="independentControls">
      <div class="slider-group">
        <div class="slider-row">
          <span class="slider-label">L</span>
          <input type="range" id="derivedSliderL" min="0" max="1" step="0.001">
          <input type="number" id="derivedNumL" min="0" max="${fmtOpts.lightnessFormat === "percentage" ? "100" : "1"}" step="${fmtOpts.lightnessFormat === "percentage" ? "0.1" : "0.001"}">
          ${fmtOpts.lightnessFormat === "percentage" ? '<span class="slider-unit">%</span>' : ""}
        </div>
        <div class="slider-row">
          <span class="slider-label">C</span>
          <input type="range" id="derivedSliderC" min="0" max="0.4" step="0.001">
          <input type="number" id="derivedNumC" min="0" max="${fmtOpts.chromaFormat === "percentage" ? "125" : "0.5"}" step="${fmtOpts.chromaFormat === "percentage" ? "0.1" : "0.001"}">
          ${fmtOpts.chromaFormat === "percentage" ? '<span class="slider-unit">%</span>' : ""}
        </div>
        <div class="slider-row">
          <span class="slider-label">H</span>
          <input type="range" id="derivedSliderH" min="0" max="360" step="0.5">
          <input type="number" id="derivedNumH" min="0" max="360" step="0.5">
          ${fmtOpts.hueFormat === "deg" ? '<span class="slider-unit">deg</span>' : ""}
        </div>
        <div class="slider-row">
          <span class="slider-label">A</span>
          <input type="range" id="derivedSliderA" min="0" max="1" step="0.01">
          <input type="number" id="derivedNumA" min="0" max="${fmtOpts.alphaFormat === "percentage" ? "100" : "1"}" step="${fmtOpts.alphaFormat === "percentage" ? "1" : "0.01"}">
          ${fmtOpts.alphaFormat === "percentage" ? '<span class="slider-unit">%</span>' : ""}
        </div>
      </div>
    </div>

    <!-- Relative mode controls -->
    <div class="relative-controls" id="relativeControls">
      <div class="presets">
        <button class="preset-btn" data-preset="accessible-text">Accessible text</button>
        <button class="preset-btn" data-preset="subtle-bg">Subtle background</button>
        <button class="preset-btn" data-preset="border">Border</button>
        <button class="preset-btn" data-preset="complementary">Complementary</button>
      </div>

      <div class="target-lc-row" id="targetLcRow">
        <label>Target APCA Lc:</label>
        <select id="targetLcSelect">
          <option value="90">Lc 90 — Preferred body</option>
          <option value="75" selected>Lc 75 — Body 18px+</option>
          <option value="60">Lc 60 — Content / bold</option>
          <option value="45">Lc 45 — Headlines</option>
          <option value="30">Lc 30 — Spot text</option>
        </select>
      </div>

      <div class="transform-row">
        <input type="checkbox" id="chkLightness" checked>
        <label for="chkLightness">Lightness</label>
        <select id="lightnessDir">
          <option value="lighter">Lighter</option>
          <option value="darker">Darker</option>
        </select>
        <input type="range" id="lightnessAmount" min="0" max="0.8" step="0.01" value="0.4">
        <input type="number" id="lightnessNum" min="0" max="0.8" step="0.01" value="0.4">
      </div>
      <div class="transform-row">
        <input type="checkbox" id="chkChroma" checked>
        <label for="chkChroma">Chroma</label>
        <input type="range" id="chromaScale" min="0" max="2" step="0.01" value="1">
        <input type="number" id="chromaNum" min="0" max="2" step="0.01" value="1">
      </div>
      <div class="transform-row">
        <input type="checkbox" id="chkHue">
        <label for="chkHue">Hue shift</label>
        <input type="range" id="hueShift" min="-180" max="180" step="1" value="0">
        <input type="number" id="hueNum" min="-180" max="180" step="1" value="0">
      </div>

      <div class="css-expression visible" id="cssExpression">
        <div class="css-expr-label">CSS relative color:</div>
        <div class="css-expr-code">
          <span class="css-expr-text" id="cssExprText"></span>
          <button class="copy-btn" id="copyCssExpr" title="Copy CSS expression"><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4h1V2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h1zm1 0h4a1 1 0 0 1 1 1v5h1V2H6v2zm-2 1v8h6V5H3z"/></svg><span class="copied-msg" id="copiedCssExpr">Copied!</span></button>
        </div>
      </div>
    </div>
  </div>

  <!-- Section 4: Actions -->
  <div class="section">
    <div class="buttons">
      <button class="action" id="btnApply">Apply Derived</button>
      <button class="action secondary" id="btnInsert">Insert Derived</button>
      <button class="action secondary" id="btnInsertRelative" style="display:none">Insert Relative</button>
    </div>
  </div>

<script nonce="${nonce}">
  const vscodeApi = acquireVsCodeApi();

  // --- Inline color conversion (same as pickerPanel, for real-time updates) ---
  function oklchToSrgb(L, C, H) {
    const hRad = H * Math.PI / 180;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;
    const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    return { r: linToSrgb(rLin), g: linToSrgb(gLin), b: linToSrgb(bLin) };
  }
  function linToSrgb(x) {
    if (x <= 0.0031308) return 12.92 * x;
    return 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  }
  function clamp01(x) { return Math.min(1, Math.max(0, x)); }
  function toHex(r, g, b) {
    const h = x => Math.min(255, Math.max(0, Math.round(x * 255))).toString(16).padStart(2, '0');
    return '#' + h(r) + h(g) + h(b);
  }

  // --- APCA (inline) ---
  function computeAPCA(text, bg) {
    const lin = c => Math.pow(Math.max(c, 0), 2.4);
    let Ytext = 0.2126729 * lin(text.r) + 0.7151522 * lin(text.g) + 0.072175 * lin(text.b);
    let Ybg = 0.2126729 * lin(bg.r) + 0.7151522 * lin(bg.g) + 0.072175 * lin(bg.b);
    if (Ytext < 0.022) Ytext += Math.pow(0.022 - Ytext, 1.414);
    if (Ybg < 0.022) Ybg += Math.pow(0.022 - Ybg, 1.414);
    let Lc;
    if (Ybg > Ytext) {
      Lc = (Math.pow(Ybg, 0.56) - Math.pow(Ytext, 0.57)) * 1.14 - 0.027;
    } else {
      Lc = (Math.pow(Ybg, 0.65) - Math.pow(Ytext, 0.62)) * 1.14 + 0.027;
    }
    if (Math.abs(Lc) < 0.001) return 0;
    return Lc * 100;
  }

  function apcaDescription(lc) {
    const abs = Math.abs(lc);
    if (abs >= 90) return 'Preferred body text';
    if (abs >= 75) return 'Body text (18px+)';
    if (abs >= 60) return 'Content text / 16px bold';
    if (abs >= 45) return 'Headlines / large text';
    if (abs >= 30) return 'Spot text / minimum';
    if (abs >= 15) return 'Non-text only';
    return 'Not readable';
  }

  // --- WCAG 2.x (inline) ---
  function computeWCAG(c1, c2) {
    const srgbLin = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    const lum = c => 0.2126 * srgbLin(c.r) + 0.7152 * srgbLin(c.g) + 0.0722 * srgbLin(c.b);
    const L1 = lum(c1), L2 = lum(c2);
    const lighter = Math.max(L1, L2), darker = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // --- Format settings ---
  const fmtLightness = '${fmtOpts.lightnessFormat}';
  const fmtChroma = '${fmtOpts.chromaFormat}';
  const fmtHue = '${fmtOpts.hueFormat}';
  const fmtAlpha = '${fmtOpts.alphaFormat}';

  function formatOklchValue(L, C, H, A) {
    const lStr = fmtLightness === 'percentage'
      ? parseFloat((L * 100).toFixed(2)) + '%'
      : '' + parseFloat(L.toFixed(4));
    const cStr = fmtChroma === 'percentage'
      ? parseFloat((C / 0.4 * 100).toFixed(2)) + '%'
      : '' + parseFloat(C.toFixed(4));
    const hStr = fmtHue === 'deg'
      ? parseFloat(H.toFixed(2)) + 'deg'
      : '' + parseFloat(H.toFixed(2));
    if (A < 1) {
      const aStr = fmtAlpha === 'percentage'
        ? parseFloat((A * 100).toFixed(0)) + '%'
        : '' + parseFloat(A.toFixed(2));
      return 'oklch(' + lStr + ' ' + cStr + ' ' + hStr + ' / ' + aStr + ')';
    }
    return 'oklch(' + lStr + ' ' + cStr + ' ' + hStr + ')';
  }

  // --- State ---
  let baseL = ${baseL}, baseC = ${baseC}, baseH = ${baseH}, baseA = ${baseA};
  let derivedL = 0.2, derivedC = 0.02, derivedH = ${baseH}, derivedA = 1;
  let mode = 'independent'; // 'independent' | 'relative'

  // Independent state
  let indL = 0.2, indC = 0.02, indH = ${baseH}, indA = 1;

  // Relative transforms
  let lightnessEnabled = true, lightnessDir = 'darker', lightnessAmount = 0.4;
  let chromaEnabled = true, chromaScale = 1;
  let hueEnabled = false, hueShift = 0;
  let activePreset = null;
  let targetLc = 75;

  // --- DOM refs ---
  const $ = id => document.getElementById(id);

  // Base sliders
  const baseSliderL = $('baseSliderL'), baseNumL = $('baseNumL');
  const baseSliderC = $('baseSliderC'), baseNumC = $('baseNumC');
  const baseSliderH = $('baseSliderH'), baseNumH = $('baseNumH');
  const baseSliderA = $('baseSliderA'), baseNumA = $('baseNumA');
  const baseSwatch = $('baseSwatch');
  const baseOklchText = $('baseOklchText'), baseHexText = $('baseHexText');

  // Derived sliders (independent mode)
  const derivedSliderL = $('derivedSliderL'), derivedNumL = $('derivedNumL');
  const derivedSliderC = $('derivedSliderC'), derivedNumC = $('derivedNumC');
  const derivedSliderH = $('derivedSliderH'), derivedNumH = $('derivedNumH');
  const derivedSliderA = $('derivedSliderA'), derivedNumA = $('derivedNumA');
  const derivedSwatch = $('derivedSwatch');
  const derivedOklchText = $('derivedOklchText'), derivedHexText = $('derivedHexText');

  // Contrast display
  const apcaValue = $('apcaValue'), apcaDesc = $('apcaDesc');
  const wcagValue = $('wcagValue'), wcagBadges = $('wcagBadges');
  const previewDerivedOnBase = $('previewDerivedOnBase');
  const previewBaseOnDerived = $('previewBaseOnDerived');
  const alphaNote = $('alphaNote');

  // Mode toggle
  const modeIndependent = $('modeIndependent'), modeRelative = $('modeRelative');
  const independentControls = $('independentControls'), relativeControls = $('relativeControls');

  // Relative controls
  const chkLightness = $('chkLightness'), lightnessDirEl = $('lightnessDir');
  const lightnessAmountEl = $('lightnessAmount'), lightnessNumEl = $('lightnessNum');
  const chkChroma = $('chkChroma'), chromaScaleEl = $('chromaScale'), chromaNumEl = $('chromaNum');
  const chkHue = $('chkHue'), hueShiftEl = $('hueShift'), hueNumEl = $('hueNum');
  const targetLcRow = $('targetLcRow'), targetLcSelect = $('targetLcSelect');
  const cssExprText = $('cssExprText');
  const cssExpression = $('cssExpression');

  // Buttons
  const btnApply = $('btnApply'), btnInsert = $('btnInsert'), btnInsertRelative = $('btnInsertRelative');

  // --- Slider wiring ---
  function wireSlider(slider, num, getSetter, numToInternal) {
    slider.addEventListener('input', () => {
      getSetter()(parseFloat(slider.value));
      fullUpdate();
    });
    num.addEventListener('input', () => {
      const v = parseFloat(num.value);
      if (!isNaN(v)) {
        getSetter()(numToInternal ? numToInternal(v) : v);
        fullUpdate();
      }
    });
  }

  const lNumToInternal = fmtLightness === 'percentage' ? v => v / 100 : null;
  const cNumToInternal = fmtChroma === 'percentage' ? v => v / 100 * 0.4 : null;
  const aNumToInternal = fmtAlpha === 'percentage' ? v => v / 100 : null;

  wireSlider(baseSliderL, baseNumL, () => v => { baseL = v; }, lNumToInternal);
  wireSlider(baseSliderC, baseNumC, () => v => { baseC = v; }, cNumToInternal);
  wireSlider(baseSliderH, baseNumH, () => v => { baseH = v; }, null);
  wireSlider(baseSliderA, baseNumA, () => v => { baseA = v; }, aNumToInternal);

  wireSlider(derivedSliderL, derivedNumL, () => v => { indL = v; }, lNumToInternal);
  wireSlider(derivedSliderC, derivedNumC, () => v => { indC = v; }, cNumToInternal);
  wireSlider(derivedSliderH, derivedNumH, () => v => { indH = v; }, null);
  wireSlider(derivedSliderA, derivedNumA, () => v => { indA = v; }, aNumToInternal);

  // --- Relative mode controls ---
  chkLightness.addEventListener('change', () => { lightnessEnabled = chkLightness.checked; activePreset = null; clearPresetBtns(); fullUpdate(); });
  lightnessDirEl.addEventListener('change', () => { lightnessDir = lightnessDirEl.value; activePreset = null; clearPresetBtns(); fullUpdate(); });
  lightnessAmountEl.addEventListener('input', () => { lightnessAmount = parseFloat(lightnessAmountEl.value); lightnessNumEl.value = lightnessAmount; activePreset = null; clearPresetBtns(); fullUpdate(); });
  lightnessNumEl.addEventListener('input', () => { const v = parseFloat(lightnessNumEl.value); if (!isNaN(v)) { lightnessAmount = v; lightnessAmountEl.value = v; activePreset = null; clearPresetBtns(); fullUpdate(); } });

  chkChroma.addEventListener('change', () => { chromaEnabled = chkChroma.checked; activePreset = null; clearPresetBtns(); fullUpdate(); });
  chromaScaleEl.addEventListener('input', () => { chromaScale = parseFloat(chromaScaleEl.value); chromaNumEl.value = chromaScale; activePreset = null; clearPresetBtns(); fullUpdate(); });
  chromaNumEl.addEventListener('input', () => { const v = parseFloat(chromaNumEl.value); if (!isNaN(v)) { chromaScale = v; chromaScaleEl.value = v; activePreset = null; clearPresetBtns(); fullUpdate(); } });

  chkHue.addEventListener('change', () => { hueEnabled = chkHue.checked; activePreset = null; clearPresetBtns(); fullUpdate(); });
  hueShiftEl.addEventListener('input', () => { hueShift = parseFloat(hueShiftEl.value); hueNumEl.value = hueShift; activePreset = null; clearPresetBtns(); fullUpdate(); });
  hueNumEl.addEventListener('input', () => { const v = parseFloat(hueNumEl.value); if (!isNaN(v)) { hueShift = v; hueShiftEl.value = v; activePreset = null; clearPresetBtns(); fullUpdate(); } });

  targetLcSelect.addEventListener('change', () => { targetLc = parseInt(targetLcSelect.value); fullUpdate(); });

  // --- Mode toggle ---
  modeIndependent.addEventListener('click', () => {
    mode = 'independent';
    modeIndependent.classList.add('active');
    modeRelative.classList.remove('active');
    independentControls.classList.add('visible');
    relativeControls.classList.remove('visible');
    btnInsertRelative.style.display = 'none';
    fullUpdate();
  });
  modeRelative.addEventListener('click', () => {
    mode = 'relative';
    modeRelative.classList.add('active');
    modeIndependent.classList.remove('active');
    relativeControls.classList.add('visible');
    independentControls.classList.remove('visible');
    btnInsertRelative.style.display = '';
    fullUpdate();
  });

  // --- Presets ---
  function clearPresetBtns() {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  }

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      clearPresetBtns();
      btn.classList.add('active');
      activePreset = preset;
      applyPreset(preset);
      fullUpdate();
    });
  });

  function applyPreset(preset) {
    switch (preset) {
      case 'accessible-text': {
        targetLcRow.classList.add('visible');
        // Auto-compute lightness for target APCA Lc
        const result = findAccessibleTextL(baseL, baseC, baseH, targetLc);
        lightnessEnabled = true; chkLightness.checked = true;
        lightnessDir = result.direction; lightnessDirEl.value = result.direction;
        lightnessAmount = result.amount; lightnessAmountEl.value = result.amount; lightnessNumEl.value = result.amount.toFixed(2);
        chromaEnabled = true; chkChroma.checked = true;
        chromaScale = 0.3; chromaScaleEl.value = '0.3'; chromaNumEl.value = '0.3';
        hueEnabled = false; chkHue.checked = false;
        hueShift = 0; hueShiftEl.value = '0'; hueNumEl.value = '0';
        break;
      }
      case 'subtle-bg': {
        targetLcRow.classList.remove('visible');
        lightnessEnabled = true; chkLightness.checked = true;
        // Direction: if base is light, go slightly lighter; if dark, slightly darker
        const baseIsLight = baseL > 0.5;
        lightnessDir = baseIsLight ? 'darker' : 'lighter'; lightnessDirEl.value = lightnessDir;
        lightnessAmount = 0.05; lightnessAmountEl.value = '0.05'; lightnessNumEl.value = '0.05';
        chromaEnabled = true; chkChroma.checked = true;
        chromaScale = 0.5; chromaScaleEl.value = '0.5'; chromaNumEl.value = '0.5';
        hueEnabled = false; chkHue.checked = false;
        hueShift = 0; hueShiftEl.value = '0'; hueNumEl.value = '0';
        break;
      }
      case 'border': {
        targetLcRow.classList.remove('visible');
        lightnessEnabled = true; chkLightness.checked = true;
        const baseIsLight2 = baseL > 0.5;
        lightnessDir = baseIsLight2 ? 'darker' : 'lighter'; lightnessDirEl.value = lightnessDir;
        lightnessAmount = 0.15; lightnessAmountEl.value = '0.15'; lightnessNumEl.value = '0.15';
        chromaEnabled = true; chkChroma.checked = true;
        chromaScale = 0.7; chromaScaleEl.value = '0.7'; chromaNumEl.value = '0.7';
        hueEnabled = false; chkHue.checked = false;
        hueShift = 0; hueShiftEl.value = '0'; hueNumEl.value = '0';
        break;
      }
      case 'complementary': {
        targetLcRow.classList.remove('visible');
        lightnessEnabled = false; chkLightness.checked = false;
        lightnessAmount = 0; lightnessAmountEl.value = '0'; lightnessNumEl.value = '0';
        chromaEnabled = false; chkChroma.checked = false;
        chromaScale = 1; chromaScaleEl.value = '1'; chromaNumEl.value = '1';
        hueEnabled = true; chkHue.checked = true;
        hueShift = 180; hueShiftEl.value = '180'; hueNumEl.value = '180';
        break;
      }
    }
  }

  // --- Accessible text binary search ---
  function findAccessibleTextL(bL, bC, bH, targetAbsLc) {
    const baseRgb = oklchToSrgb(bL, bC, bH);
    const baseRgbClamped = { r: clamp01(baseRgb.r), g: clamp01(baseRgb.g), b: clamp01(baseRgb.b) };

    // Determine luminance to decide search direction
    const lin = c => Math.pow(Math.max(c, 0), 2.4);
    const baseY = 0.2126729 * lin(baseRgbClamped.r) + 0.7151522 * lin(baseRgbClamped.g) + 0.072175 * lin(baseRgbClamped.b);

    const textC = Math.min(bC * 0.3, 0.03);
    let direction, lo, hi;

    if (baseY > 0.2) {
      // Light background → dark text
      direction = 'darker';
      lo = 0; hi = bL;
    } else {
      // Dark background → light text
      direction = 'lighter';
      lo = bL; hi = 1;
    }

    // Binary search for L
    let bestL = direction === 'darker' ? 0 : 1;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      const testRgb = oklchToSrgb(mid, textC, bH);
      const testRgbClamped = { r: clamp01(testRgb.r), g: clamp01(testRgb.g), b: clamp01(testRgb.b) };
      const lc = computeAPCA(testRgbClamped, baseRgbClamped);
      const absLc = Math.abs(lc);

      if (absLc >= targetAbsLc) {
        bestL = mid;
        if (direction === 'darker') {
          lo = mid; // Try a lighter (less contrast) value to find boundary
        } else {
          hi = mid; // Try a darker (less contrast) value to find boundary
        }
      } else {
        if (direction === 'darker') {
          hi = mid; // Need more contrast → go darker
        } else {
          lo = mid; // Need more contrast → go lighter
        }
      }
    }

    const amount = Math.abs(bestL - bL);
    return { direction, amount: Math.round(amount * 100) / 100 };
  }

  // --- Compute derived from relative transforms ---
  function computeRelativeDerived() {
    let dL = baseL, dC = baseC, dH = baseH, dA = baseA;

    if (lightnessEnabled) {
      if (lightnessDir === 'lighter') {
        dL = Math.min(1, baseL + lightnessAmount);
      } else {
        dL = Math.max(0, baseL - lightnessAmount);
      }
    }
    if (chromaEnabled) {
      dC = baseC * chromaScale;
    }
    if (hueEnabled) {
      dH = ((baseH + hueShift) % 360 + 360) % 360;
    }

    return { L: dL, C: dC, H: dH, alpha: dA };
  }

  // --- Generate CSS relative expression ---
  function buildCssExpression() {
    let lExpr = 'l', cExpr = 'c', hExpr = 'h';

    if (lightnessEnabled && lightnessAmount !== 0) {
      const sign = lightnessDir === 'lighter' ? '+' : '-';
      lExpr = 'calc(l ' + sign + ' ' + lightnessAmount.toFixed(2) + ')';
    }
    if (chromaEnabled && chromaScale !== 1) {
      if (chromaScale === 0) {
        cExpr = '0';
      } else {
        cExpr = 'calc(c * ' + chromaScale.toFixed(2) + ')';
      }
    }
    if (hueEnabled && hueShift !== 0) {
      const sign = hueShift > 0 ? '+' : '-';
      hExpr = 'calc(h ' + sign + ' ' + Math.abs(hueShift) + 'deg)';
    }

    return 'oklch(from var(--base) ' + lExpr + ' ' + cExpr + ' ' + hExpr + ')';
  }

  // --- Full UI update ---
  function fullUpdate() {
    // Resolve derived color
    if (mode === 'relative') {
      // If accessible-text preset is active, re-run binary search
      if (activePreset === 'accessible-text') {
        const result = findAccessibleTextL(baseL, baseC, baseH, targetLc);
        lightnessDir = result.direction; lightnessDirEl.value = result.direction;
        lightnessAmount = result.amount; lightnessAmountEl.value = result.amount; lightnessNumEl.value = result.amount.toFixed(2);
      }
      const d = computeRelativeDerived();
      derivedL = d.L; derivedC = d.C; derivedH = d.H; derivedA = d.alpha;
    } else {
      derivedL = indL; derivedC = indC; derivedH = indH; derivedA = indA;
    }

    // Update base UI
    baseSliderL.value = baseL; baseSliderC.value = baseC; baseSliderH.value = baseH; baseSliderA.value = baseA;
    baseNumL.value = fmtLightness === 'percentage' ? parseFloat((baseL * 100).toFixed(2)) : parseFloat(baseL.toFixed(4));
    baseNumC.value = fmtChroma === 'percentage' ? parseFloat((baseC / 0.4 * 100).toFixed(2)) : parseFloat(baseC.toFixed(4));
    baseNumH.value = parseFloat(baseH.toFixed(2));
    baseNumA.value = fmtAlpha === 'percentage' ? parseFloat((baseA * 100).toFixed(0)) : parseFloat(baseA.toFixed(2));

    const baseRgb = oklchToSrgb(baseL, baseC, baseH);
    const br = clamp01(baseRgb.r), bg = clamp01(baseRgb.g), bb = clamp01(baseRgb.b);
    const baseHex = toHex(br, bg, bb);
    baseSwatch.style.backgroundColor = 'rgba(' + Math.round(br*255) + ',' + Math.round(bg*255) + ',' + Math.round(bb*255) + ',' + baseA + ')';
    baseOklchText.textContent = formatOklchValue(baseL, baseC, baseH, baseA);
    baseHexText.textContent = baseA < 1 ? baseHex + Math.round(baseA*255).toString(16).padStart(2,'0') : baseHex;

    // Update derived UI
    if (mode === 'independent') {
      derivedSliderL.value = indL; derivedSliderC.value = indC; derivedSliderH.value = indH; derivedSliderA.value = indA;
      derivedNumL.value = fmtLightness === 'percentage' ? parseFloat((indL * 100).toFixed(2)) : parseFloat(indL.toFixed(4));
      derivedNumC.value = fmtChroma === 'percentage' ? parseFloat((indC / 0.4 * 100).toFixed(2)) : parseFloat(indC.toFixed(4));
      derivedNumH.value = parseFloat(indH.toFixed(2));
      derivedNumA.value = fmtAlpha === 'percentage' ? parseFloat((indA * 100).toFixed(0)) : parseFloat(indA.toFixed(2));
    }

    const derivedRgb = oklchToSrgb(derivedL, derivedC, derivedH);
    const dr = clamp01(derivedRgb.r), dg = clamp01(derivedRgb.g), db = clamp01(derivedRgb.b);
    const derivedHex = toHex(dr, dg, db);
    derivedSwatch.style.backgroundColor = 'rgba(' + Math.round(dr*255) + ',' + Math.round(dg*255) + ',' + Math.round(db*255) + ',' + derivedA + ')';
    derivedOklchText.textContent = formatOklchValue(derivedL, derivedC, derivedH, derivedA);
    derivedHexText.textContent = derivedA < 1 ? derivedHex + Math.round(derivedA*255).toString(16).padStart(2,'0') : derivedHex;

    // Compute contrast (using clamped opaque sRGB)
    const baseRgbOpaque = { r: br, g: bg, b: bb };
    const derivedRgbOpaque = { r: dr, g: dg, b: db };

    const apca = computeAPCA(derivedRgbOpaque, baseRgbOpaque);
    const absApca = Math.abs(apca);
    apcaValue.textContent = 'Lc ' + apca.toFixed(1);
    apcaValue.className = 'contrast-value' + (absApca >= 75 ? ' good' : absApca >= 45 ? ' ok' : ' poor');
    apcaDesc.textContent = apcaDescription(apca);

    const wcag = computeWCAG(baseRgbOpaque, derivedRgbOpaque);
    wcagValue.textContent = wcag.toFixed(2) + ':1';
    wcagValue.className = 'contrast-value' + (wcag >= 7 ? ' good' : wcag >= 4.5 ? ' ok' : ' poor');

    // WCAG badges
    const aaNormal = wcag >= 4.5, aaLarge = wcag >= 3, aaaNormal = wcag >= 7, aaaLarge = wcag >= 4.5;
    let badges = '';
    badges += '<span class="badge ' + (aaNormal ? 'badge-pass' : 'badge-fail') + '">AA</span>';
    badges += '<span class="badge ' + (aaaNormal ? 'badge-pass' : 'badge-fail') + '">AAA</span>';
    badges += '<span class="badge ' + (aaLarge ? 'badge-pass' : 'badge-fail') + '">AA Large</span>';
    wcagBadges.innerHTML = badges;

    // Preview boxes
    const baseCss = 'rgb(' + Math.round(br*255) + ',' + Math.round(bg*255) + ',' + Math.round(bb*255) + ')';
    const derivedCss = 'rgb(' + Math.round(dr*255) + ',' + Math.round(dg*255) + ',' + Math.round(db*255) + ')';
    previewDerivedOnBase.style.backgroundColor = baseCss;
    previewDerivedOnBase.style.color = derivedCss;
    previewBaseOnDerived.style.backgroundColor = derivedCss;
    previewBaseOnDerived.style.color = baseCss;

    // Alpha note
    alphaNote.style.display = (baseA < 1 || derivedA < 1) ? 'block' : 'none';

    // CSS expression (relative mode)
    if (mode === 'relative') {
      cssExpression.classList.add('visible');
      cssExprText.textContent = buildCssExpression();
    } else {
      cssExpression.classList.remove('visible');
    }
  }

  // --- Copy buttons ---
  function showCopied(id) {
    const el = $(id);
    el.classList.add('visible');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('visible'), 1000);
  }

  $('baseCopyOklch').addEventListener('click', () => { navigator.clipboard.writeText(baseOklchText.textContent); showCopied('baseCopiedOklch'); });
  $('baseCopyHex').addEventListener('click', () => { navigator.clipboard.writeText(baseHexText.textContent); showCopied('baseCopiedHex'); });
  $('derivedCopyOklch').addEventListener('click', () => { navigator.clipboard.writeText(derivedOklchText.textContent); showCopied('derivedCopiedOklch'); });
  $('derivedCopyHex').addEventListener('click', () => { navigator.clipboard.writeText(derivedHexText.textContent); showCopied('derivedCopiedHex'); });
  $('copyCssExpr').addEventListener('click', () => { navigator.clipboard.writeText(cssExprText.textContent); showCopied('copiedCssExpr'); });

  // --- Action buttons ---
  btnApply.disabled = ${initialBaseColor ? "false" : "true"};
  btnApply.addEventListener('click', () => {
    if (!btnApply.disabled) {
      vscodeApi.postMessage({ command: 'apply', L: derivedL, C: derivedC, H: derivedH, alpha: derivedA });
    }
  });
  btnInsert.addEventListener('click', () => {
    vscodeApi.postMessage({ command: 'insert', L: derivedL, C: derivedC, H: derivedH, alpha: derivedA });
  });
  btnInsertRelative.addEventListener('click', () => {
    vscodeApi.postMessage({ command: 'insertRelative', expression: buildCssExpression() });
  });

  // --- Messages from extension ---
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.command === 'setBaseColor') {
      baseL = msg.L; baseC = msg.C; baseH = msg.H; baseA = msg.alpha;
      fullUpdate();
    } else if (msg.command === 'cursorContext') {
      btnApply.disabled = !msg.hasCssColor;
      if (msg.hasCssColor) {
        baseL = msg.L; baseC = msg.C; baseH = msg.H; baseA = msg.alpha;
        fullUpdate();
      }
    }
  });

  // --- Keyboard navigation between sliders ---
  const baseSliders = [baseSliderL, baseSliderC, baseSliderH, baseSliderA];
  const derivedSliders = [derivedSliderL, derivedSliderC, derivedSliderH, derivedSliderA];
  const actionBtns = [btnApply, btnInsert, btnInsertRelative];

  function wireArrowNav(sliders, nextTarget) {
    sliders.forEach((slider, i) => {
      slider.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (i < sliders.length - 1) {
            sliders[i + 1].focus();
          } else if (nextTarget) {
            nextTarget.focus();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (i > 0) {
            sliders[i - 1].focus();
          }
        }
      });
    });
  }

  wireArrowNav(baseSliders, derivedSliderL);
  wireArrowNav(derivedSliders, btnApply);

  actionBtns.forEach((btn, i) => {
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (mode === 'independent') {
          derivedSliders[derivedSliders.length - 1].focus();
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        // Find next visible button
        for (let j = 1; j <= actionBtns.length; j++) {
          const next = actionBtns[(i + j) % actionBtns.length];
          if (next.style.display !== 'none') { next.focus(); break; }
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        for (let j = 1; j <= actionBtns.length; j++) {
          const prev = actionBtns[(i - j + actionBtns.length) % actionBtns.length];
          if (prev.style.display !== 'none') { prev.focus(); break; }
        }
      }
    });
  });

  // --- Init ---
  fullUpdate();
</script>
</body>
</html>`;
}

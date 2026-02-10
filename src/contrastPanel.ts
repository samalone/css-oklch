import * as vscode from "vscode";
import {
  OklchColor,
  createPanel,
  applyColorAtCursor,
  insertColorAtCursor,
  insertExpressionAtCursor,
} from "./panelBase";
import { getFormatOptions } from "./formatOklch";
import { WEBVIEW_COLOR_CORE, WEBVIEW_CONTRAST_MATH, webviewFormatScript } from "./webviewScripts";
import {
  CSS_BASE,
  cssSliders,
  CSS_COPY_BUTTON,
  CSS_TRANSFORM_CONTROLS,
  CSS_ACTION_BUTTONS,
} from "./webviewStyles";

export function openContrastPanel(
  context: vscode.ExtensionContext,
  initialBaseColor?: OklchColor
): void {
  createPanel(
    {
      viewType: "oklchContrastChecker",
      title: "OKLCH Contrast Checker",
      initialMessageCommand: "setBaseColor",
      cursorContextMode: "full",
      getHtml: (nonce, color) => getContrastWebviewHtml(nonce, color),
      handleMessage: (message, editor, lastCursorOffset) => {
        switch (message.command) {
          case "apply":
            applyColorAtCursor(
              editor,
              lastCursorOffset,
              message.L,
              message.C,
              message.H,
              message.alpha
            );
            break;
          case "insert":
            insertColorAtCursor(
              editor,
              message.L,
              message.C,
              message.H,
              message.alpha
            );
            break;
          case "insertRelative":
            insertExpressionAtCursor(editor, message.expression);
            break;
        }
      },
    },
    context,
    initialBaseColor
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
    ${CSS_BASE}

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
    ${CSS_COPY_BUTTON}

    /* Sliders */
    .slider-group { margin-bottom: 4px; }
    ${cssSliders()}

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

    /* Per-component derived grid */
    .derived-grid {
      display: grid;
      grid-template-columns: auto auto 1fr;
      gap: 6px 6px;
      align-items: center;
      margin-bottom: 4px;
    }
    .comp-mode-select {
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 2px;
      padding: 1px 3px;
      font-size: 11px;
      width: 68px;
    }
    .comp-mode-spacer {
      display: inline-block;
      width: 68px;
    }
    .comp-controls {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .fixed-ctrl, .rel-ctrl {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: 0;
    }
    .rel-ctrl { display: none; }
    .fixed-ctrl input[type="range"],
    .rel-ctrl input[type="range"] {
      flex: 1;
      min-width: 0;
    }
    .fixed-ctrl input[type="number"],
    .rel-ctrl input[type="number"] {
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
    }

    ${CSS_TRANSFORM_CONTROLS}

    /* CSS expression visibility (contrast-specific) */
    .css-expression {
      margin-top: 8px;
      display: none;
    }
    .css-expression.visible {
      display: block;
    }

    ${CSS_ACTION_BUTTONS}
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
    <div class="slider-group sliders-grid">
      <span class="slider-label">L</span>
      <input type="range" id="baseSliderL" min="0" max="1" step="0.001">
      <input type="number" id="baseNumL" min="0" max="${fmtOpts.lightnessFormat === "percentage" ? "100" : "1"}" step="${fmtOpts.lightnessFormat === "percentage" ? "0.1" : "0.001"}">
      <span class="slider-unit">${fmtOpts.lightnessFormat === "percentage" ? "%" : ""}</span>

      <span class="slider-label">C</span>
      <input type="range" id="baseSliderC" min="0" max="0.4" step="0.001">
      <input type="number" id="baseNumC" min="0" max="${fmtOpts.chromaFormat === "percentage" ? "125" : "0.5"}" step="${fmtOpts.chromaFormat === "percentage" ? "0.1" : "0.001"}">
      <span class="slider-unit">${fmtOpts.chromaFormat === "percentage" ? "%" : ""}</span>

      <span class="slider-label">H</span>
      <input type="range" id="baseSliderH" min="0" max="360" step="0.5">
      <input type="number" id="baseNumH" min="0" max="360" step="0.5">
      <span class="slider-unit">${fmtOpts.hueFormat === "deg" ? "deg" : ""}</span>

      <span class="slider-label">A</span>
      <input type="range" id="baseSliderA" min="0" max="1" step="0.01">
      <input type="number" id="baseNumA" min="0" max="${fmtOpts.alphaFormat === "percentage" ? "100" : "1"}" step="${fmtOpts.alphaFormat === "percentage" ? "1" : "0.01"}">
      <span class="slider-unit">${fmtOpts.alphaFormat === "percentage" ? "%" : ""}</span>
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

    <!-- Presets -->
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

    <!-- Per-component derived controls -->
    <div class="derived-grid">
      <!-- L row -->
      <select class="comp-mode-select" id="modeL">
        <option value="fixed">Fixed</option>
        <option value="lighter">Lighter</option>
        <option value="darker">Darker</option>
      </select>
      <span class="slider-label">L</span>
      <div class="comp-controls">
        <div class="fixed-ctrl" id="fixedL">
          <input type="range" id="derivedSliderL" min="0" max="1" step="0.001">
          <input type="number" id="derivedNumL" min="0" max="${fmtOpts.lightnessFormat === "percentage" ? "100" : "1"}" step="${fmtOpts.lightnessFormat === "percentage" ? "0.1" : "0.001"}">
          <span class="slider-unit">${fmtOpts.lightnessFormat === "percentage" ? "%" : ""}</span>
        </div>
        <div class="rel-ctrl" id="relL">
          <input type="range" id="lightnessAmount" min="0" max="0.8" step="0.01" value="0.4">
          <input type="number" id="lightnessNum" min="0" max="0.8" step="0.01" value="0.4">
        </div>
      </div>

      <!-- C row -->
      <select class="comp-mode-select" id="modeC">
        <option value="fixed">Fixed</option>
        <option value="relative">Relative</option>
      </select>
      <span class="slider-label">C</span>
      <div class="comp-controls">
        <div class="fixed-ctrl" id="fixedC">
          <input type="range" id="derivedSliderC" min="0" max="0.4" step="0.001">
          <input type="number" id="derivedNumC" min="0" max="${fmtOpts.chromaFormat === "percentage" ? "125" : "0.5"}" step="${fmtOpts.chromaFormat === "percentage" ? "0.1" : "0.001"}">
          <span class="slider-unit">${fmtOpts.chromaFormat === "percentage" ? "%" : ""}</span>
        </div>
        <div class="rel-ctrl" id="relC">
          <input type="range" id="chromaScale" min="0" max="2" step="0.01" value="1">
          <input type="number" id="chromaNum" min="0" max="2" step="0.01" value="1">
        </div>
      </div>

      <!-- H row -->
      <select class="comp-mode-select" id="modeH">
        <option value="fixed">Fixed</option>
        <option value="relative">Relative</option>
      </select>
      <span class="slider-label">H</span>
      <div class="comp-controls">
        <div class="fixed-ctrl" id="fixedH">
          <input type="range" id="derivedSliderH" min="0" max="360" step="0.5">
          <input type="number" id="derivedNumH" min="0" max="360" step="0.5">
          <span class="slider-unit">${fmtOpts.hueFormat === "deg" ? "deg" : ""}</span>
        </div>
        <div class="rel-ctrl" id="relH">
          <input type="range" id="hueShift" min="-180" max="180" step="1" value="0">
          <input type="number" id="hueNum" min="-180" max="180" step="1" value="0">
        </div>
      </div>

      <!-- A row (always fixed) -->
      <span class="comp-mode-spacer"></span>
      <span class="slider-label">A</span>
      <div class="comp-controls">
        <div class="fixed-ctrl">
          <input type="range" id="derivedSliderA" min="0" max="1" step="0.01">
          <input type="number" id="derivedNumA" min="0" max="${fmtOpts.alphaFormat === "percentage" ? "100" : "1"}" step="${fmtOpts.alphaFormat === "percentage" ? "1" : "0.01"}">
          <span class="slider-unit">${fmtOpts.alphaFormat === "percentage" ? "%" : ""}</span>
        </div>
      </div>
    </div>

    <!-- CSS expression (shown when any component is relative) -->
    <div class="css-expression" id="cssExpression">
      <div class="css-expr-label">CSS relative color:</div>
      <div class="css-expr-code">
        <span class="css-expr-text" id="cssExprText"></span>
        <button class="copy-btn" id="copyCssExpr" title="Copy CSS expression"><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4h1V2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h1zm1 0h4a1 1 0 0 1 1 1v5h1V2H6v2zm-2 1v8h6V5H3z"/></svg><span class="copied-msg" id="copiedCssExpr">Copied!</span></button>
      </div>
    </div>
  </div>

  <!-- Section 4: Actions -->
  <div class="section">
    <div class="buttons">
      <button class="action" id="btnApply">Apply Derived</button>
      <button class="action secondary" id="btnInsert">Insert Derived</button>
      <button class="action secondary" id="btnInsertRelative">Insert Relative</button>
    </div>
  </div>

<script nonce="${nonce}">
  const vscodeApi = acquireVsCodeApi();

  // --- Inline color conversion & math ---
  ${WEBVIEW_COLOR_CORE}
  ${WEBVIEW_CONTRAST_MATH}
  ${webviewFormatScript(fmtOpts)}

  // --- State ---
  let baseL = ${baseL}, baseC = ${baseC}, baseH = ${baseH}, baseA = ${baseA};
  let derivedL = 0.2, derivedC = 0.02, derivedH = ${baseH}, derivedA = 1;

  // Per-component mode: modeL='fixed'|'lighter'|'darker'; modeC,modeH='fixed'|'relative'
  let modeL = 'fixed', modeC = 'fixed', modeH = 'fixed';

  // Fixed (absolute) values
  let indL = 0.2, indC = 0.02, indH = ${baseH}, indA = 1;

  // Relative transform parameters
  let lightnessAmount = 0.4;
  let chromaScale = 1;
  let hueShift = 0;
  let activePreset = null;
  let targetLc = 75;

  function anyRelative() { return modeL !== 'fixed' || modeC === 'relative' || modeH === 'relative'; }

  // --- DOM refs ---
  const $ = id => document.getElementById(id);

  // Base sliders
  const baseSliderL = $('baseSliderL'), baseNumL = $('baseNumL');
  const baseSliderC = $('baseSliderC'), baseNumC = $('baseNumC');
  const baseSliderH = $('baseSliderH'), baseNumH = $('baseNumH');
  const baseSliderA = $('baseSliderA'), baseNumA = $('baseNumA');
  const baseSwatch = $('baseSwatch');
  const baseOklchText = $('baseOklchText'), baseHexText = $('baseHexText');

  // Derived sliders (fixed mode)
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

  // Per-component mode selects and control containers
  const modeLEl = $('modeL'), modeCEl = $('modeC'), modeHEl = $('modeH');
  const fixedLEl = $('fixedL'), relLEl = $('relL');
  const fixedCEl = $('fixedC'), relCEl = $('relC');
  const fixedHEl = $('fixedH'), relHEl = $('relH');

  // Relative controls
  const lightnessAmountEl = $('lightnessAmount'), lightnessNumEl = $('lightnessNum');
  const chromaScaleEl = $('chromaScale'), chromaNumEl = $('chromaNum');
  const hueShiftEl = $('hueShift'), hueNumEl = $('hueNum');
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

  // --- Per-component mode toggling ---
  function updateComponentVisibility(comp) {
    if (comp === 'L') {
      const isRel = modeL !== 'fixed';
      fixedLEl.style.display = isRel ? 'none' : '';
      relLEl.style.display = isRel ? 'flex' : '';
    } else if (comp === 'C') {
      const isRel = modeC === 'relative';
      fixedCEl.style.display = isRel ? 'none' : '';
      relCEl.style.display = isRel ? 'flex' : '';
    } else if (comp === 'H') {
      const isRel = modeH === 'relative';
      fixedHEl.style.display = isRel ? 'none' : '';
      relHEl.style.display = isRel ? 'flex' : '';
    }
    const hasRel = anyRelative();
    btnInsertRelative.style.display = hasRel ? '' : 'none';
  }

  modeLEl.addEventListener('change', () => {
    if (modeLEl.value === 'fixed' && modeL !== 'fixed') { indL = derivedL; }
    modeL = modeLEl.value;
    activePreset = null; clearPresetBtns();
    updateComponentVisibility('L');
    fullUpdate();
  });
  modeCEl.addEventListener('change', () => {
    if (modeCEl.value === 'fixed' && modeC === 'relative') { indC = derivedC; }
    modeC = modeCEl.value;
    activePreset = null; clearPresetBtns();
    updateComponentVisibility('C');
    fullUpdate();
  });
  modeHEl.addEventListener('change', () => {
    if (modeHEl.value === 'fixed' && modeH === 'relative') { indH = derivedH; }
    modeH = modeHEl.value;
    activePreset = null; clearPresetBtns();
    updateComponentVisibility('H');
    fullUpdate();
  });

  // --- Relative transform controls ---
  lightnessAmountEl.addEventListener('input', () => { lightnessAmount = parseFloat(lightnessAmountEl.value); lightnessNumEl.value = lightnessAmount; activePreset = null; clearPresetBtns(); fullUpdate(); });
  lightnessNumEl.addEventListener('input', () => { const v = parseFloat(lightnessNumEl.value); if (!isNaN(v)) { lightnessAmount = v; lightnessAmountEl.value = v; activePreset = null; clearPresetBtns(); fullUpdate(); } });

  chromaScaleEl.addEventListener('input', () => { chromaScale = parseFloat(chromaScaleEl.value); chromaNumEl.value = chromaScale; activePreset = null; clearPresetBtns(); fullUpdate(); });
  chromaNumEl.addEventListener('input', () => { const v = parseFloat(chromaNumEl.value); if (!isNaN(v)) { chromaScale = v; chromaScaleEl.value = v; activePreset = null; clearPresetBtns(); fullUpdate(); } });

  hueShiftEl.addEventListener('input', () => { hueShift = parseFloat(hueShiftEl.value); hueNumEl.value = hueShift; activePreset = null; clearPresetBtns(); fullUpdate(); });
  hueNumEl.addEventListener('input', () => { const v = parseFloat(hueNumEl.value); if (!isNaN(v)) { hueShift = v; hueShiftEl.value = v; activePreset = null; clearPresetBtns(); fullUpdate(); } });

  targetLcSelect.addEventListener('change', () => { targetLc = parseInt(targetLcSelect.value); fullUpdate(); });

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

  function setAllComponentVisibility() {
    updateComponentVisibility('L');
    updateComponentVisibility('C');
    updateComponentVisibility('H');
  }

  function applyPreset(preset) {
    switch (preset) {
      case 'accessible-text': {
        targetLcRow.classList.add('visible');
        const result = findAccessibleTextL(baseL, baseC, baseH, targetLc);
        modeL = result.direction; modeLEl.value = result.direction;
        lightnessAmount = result.amount; lightnessAmountEl.value = result.amount; lightnessNumEl.value = result.amount.toFixed(2);
        modeC = 'relative'; modeCEl.value = 'relative';
        chromaScale = 0.3; chromaScaleEl.value = '0.3'; chromaNumEl.value = '0.3';
        modeH = 'relative'; modeHEl.value = 'relative';
        hueShift = 0; hueShiftEl.value = '0'; hueNumEl.value = '0';
        setAllComponentVisibility();
        break;
      }
      case 'subtle-bg': {
        targetLcRow.classList.remove('visible');
        const baseIsLight = baseL > 0.5;
        modeL = baseIsLight ? 'darker' : 'lighter'; modeLEl.value = modeL;
        lightnessAmount = 0.05; lightnessAmountEl.value = '0.05'; lightnessNumEl.value = '0.05';
        modeC = 'relative'; modeCEl.value = 'relative';
        chromaScale = 0.5; chromaScaleEl.value = '0.5'; chromaNumEl.value = '0.5';
        modeH = 'relative'; modeHEl.value = 'relative';
        hueShift = 0; hueShiftEl.value = '0'; hueNumEl.value = '0';
        setAllComponentVisibility();
        break;
      }
      case 'border': {
        targetLcRow.classList.remove('visible');
        const baseIsLight2 = baseL > 0.5;
        modeL = baseIsLight2 ? 'darker' : 'lighter'; modeLEl.value = modeL;
        lightnessAmount = 0.15; lightnessAmountEl.value = '0.15'; lightnessNumEl.value = '0.15';
        modeC = 'relative'; modeCEl.value = 'relative';
        chromaScale = 0.7; chromaScaleEl.value = '0.7'; chromaNumEl.value = '0.7';
        modeH = 'relative'; modeHEl.value = 'relative';
        hueShift = 0; hueShiftEl.value = '0'; hueNumEl.value = '0';
        setAllComponentVisibility();
        break;
      }
      case 'complementary': {
        targetLcRow.classList.remove('visible');
        modeL = 'lighter'; modeLEl.value = 'lighter';
        lightnessAmount = 0; lightnessAmountEl.value = '0'; lightnessNumEl.value = '0';
        modeC = 'relative'; modeCEl.value = 'relative';
        chromaScale = 1; chromaScaleEl.value = '1'; chromaNumEl.value = '1';
        modeH = 'relative'; modeHEl.value = 'relative';
        hueShift = 180; hueShiftEl.value = '180'; hueNumEl.value = '180';
        setAllComponentVisibility();
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

  // --- Compute derived color (per-component) ---
  function computeDerived() {
    let dL, dC, dH;

    if (modeL === 'lighter') {
      dL = Math.min(1, baseL + lightnessAmount);
    } else if (modeL === 'darker') {
      dL = Math.max(0, baseL - lightnessAmount);
    } else {
      dL = indL;
    }

    dC = modeC === 'relative' ? baseC * chromaScale : indC;
    dH = modeH === 'relative' ? ((baseH + hueShift) % 360 + 360) % 360 : indH;

    return { L: dL, C: dC, H: dH, alpha: indA };
  }

  // --- Generate CSS relative expression (mixed fixed/relative) ---
  function buildCssExpression() {
    let lExpr, cExpr, hExpr;

    // Lightness
    if (modeL !== 'fixed') {
      if (lightnessAmount === 0) {
        lExpr = 'l';
      } else {
        const sign = modeL === 'lighter' ? '+' : '-';
        lExpr = 'calc(l ' + sign + ' ' + lightnessAmount.toFixed(2) + ')';
      }
    } else {
      lExpr = fmtLightness === 'percentage'
        ? parseFloat((indL * 100).toFixed(2)) + '%'
        : '' + parseFloat(indL.toFixed(4));
    }

    // Chroma
    if (modeC === 'relative') {
      if (chromaScale === 0) {
        cExpr = '0';
      } else if (chromaScale === 1) {
        cExpr = 'c';
      } else {
        cExpr = 'calc(c * ' + chromaScale.toFixed(2) + ')';
      }
    } else {
      cExpr = fmtChroma === 'percentage'
        ? parseFloat((indC / 0.4 * 100).toFixed(2)) + '%'
        : '' + parseFloat(indC.toFixed(4));
    }

    // Hue
    if (modeH === 'relative') {
      if (hueShift === 0) {
        hExpr = 'h';
      } else {
        const sign = hueShift > 0 ? '+' : '-';
        hExpr = 'calc(h ' + sign + ' ' + Math.abs(hueShift) + 'deg)';
      }
    } else {
      hExpr = fmtHue === 'deg'
        ? parseFloat(indH.toFixed(2)) + 'deg'
        : '' + parseFloat(indH.toFixed(2));
    }

    let expr = 'oklch(from var(--base) ' + lExpr + ' ' + cExpr + ' ' + hExpr;
    if (indA < 1) {
      const aStr = fmtAlpha === 'percentage'
        ? parseFloat((indA * 100).toFixed(0)) + '%'
        : '' + parseFloat(indA.toFixed(2));
      expr += ' / ' + aStr;
    }
    expr += ')';
    return expr;
  }

  // --- Full UI update ---
  function fullUpdate() {
    // If accessible-text preset is active, re-run binary search
    if (activePreset === 'accessible-text' && modeL !== 'fixed') {
      const result = findAccessibleTextL(baseL, baseC, baseH, targetLc);
      modeL = result.direction; modeLEl.value = result.direction;
      lightnessAmount = result.amount; lightnessAmountEl.value = result.amount; lightnessNumEl.value = result.amount.toFixed(2);
    }

    // Compute derived color
    const d = computeDerived();
    derivedL = d.L; derivedC = d.C; derivedH = d.H; derivedA = d.alpha;

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

    // Update derived fixed sliders
    derivedSliderL.value = indL; derivedSliderC.value = indC; derivedSliderH.value = indH; derivedSliderA.value = indA;
    derivedNumL.value = fmtLightness === 'percentage' ? parseFloat((indL * 100).toFixed(2)) : parseFloat(indL.toFixed(4));
    derivedNumC.value = fmtChroma === 'percentage' ? parseFloat((indC / 0.4 * 100).toFixed(2)) : parseFloat(indC.toFixed(4));
    derivedNumH.value = parseFloat(indH.toFixed(2));
    derivedNumA.value = fmtAlpha === 'percentage' ? parseFloat((indA * 100).toFixed(0)) : parseFloat(indA.toFixed(2));

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

    // CSS expression (when any component is relative)
    if (anyRelative()) {
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
  const actionBtns = [btnApply, btnInsert, btnInsertRelative];

  function getVisibleDerivedControls() {
    const controls = [];
    controls.push(modeL !== 'fixed' ? lightnessAmountEl : derivedSliderL);
    controls.push(modeC === 'relative' ? chromaScaleEl : derivedSliderC);
    controls.push(modeH === 'relative' ? hueShiftEl : derivedSliderH);
    controls.push(derivedSliderA);
    return controls;
  }

  function wireArrowNav(sliders, nextTarget) {
    sliders.forEach((slider, i) => {
      slider.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (i < sliders.length - 1) {
            sliders[i + 1].focus();
          } else if (nextTarget) {
            (typeof nextTarget === 'function' ? nextTarget() : nextTarget).focus();
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

  wireArrowNav(baseSliders, () => getVisibleDerivedControls()[0]);

  // Dynamic arrow nav for derived controls
  document.addEventListener('keydown', (e) => {
    const controls = getVisibleDerivedControls();
    const idx = controls.indexOf(document.activeElement);
    if (idx === -1) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx < controls.length - 1) {
        controls[idx + 1].focus();
      } else {
        btnApply.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx > 0) {
        controls[idx - 1].focus();
      } else {
        baseSliders[baseSliders.length - 1].focus();
      }
    }
  });

  actionBtns.forEach((btn, i) => {
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const dc = getVisibleDerivedControls();
        dc[dc.length - 1].focus();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
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
  setAllComponentVisibility();
  fullUpdate();
</script>
</body>
</html>`;
}

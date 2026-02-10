import * as vscode from "vscode";
import {
  OklchColor,
  createPanel,
  insertExpressionAtCursor,
} from "./panelBase";
import { getFormatOptions } from "./formatOklch";
import {
  WEBVIEW_COLOR_CORE,
  WEBVIEW_GAMUT_CHECK,
  WEBVIEW_CONTRAST_MATH,
  webviewFormatScript,
} from "./webviewScripts";
import {
  CSS_BASE,
  cssSliders,
  CSS_COPY_BUTTON,
  CSS_TRANSFORM_CONTROLS,
  CSS_ACTION_BUTTONS,
} from "./webviewStyles";

export function openFormulaPanel(
  context: vscode.ExtensionContext,
  initialColor?: OklchColor
): void {
  createPanel(
    {
      viewType: "oklchAdaptiveFormula",
      title: "OKLCH Adaptive Formula",
      initialMessageCommand: "setInitialColor",
      cursorContextMode: "boolean",
      getHtml: (nonce, color) => getFormulaWebviewHtml(nonce, color),
      handleMessage: (message, editor) => {
        switch (message.command) {
          case "insertRelative":
            insertExpressionAtCursor(editor, message.expression);
            break;
        }
      },
    },
    context,
    initialColor
  );
}

function getFormulaWebviewHtml(
  nonce: string,
  initialColor?: OklchColor
): string {
  const initL = initialColor?.L ?? 0.55;
  const initC = initialColor?.C ?? 0.15;
  const initH = initialColor?.H ?? 240;
  const initialPropertyName = initialColor?.propertyName
    ? JSON.stringify(initialColor.propertyName)
    : "null";
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

    /* Variable selector */
    .var-selector {
      display: flex;
      gap: 0;
      margin-bottom: 10px;
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 3px;
      overflow: hidden;
    }
    .var-btn {
      flex: 1;
      padding: 4px 8px;
      border: none;
      background: transparent;
      color: var(--vscode-editor-foreground);
      cursor: pointer;
      font-size: 12px;
      transition: background 0.1s;
    }
    .var-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    }
    .var-btn.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    /* Range inputs */
    .range-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }
    .range-label {
      font-size: 11px;
      font-weight: 600;
      opacity: 0.7;
      min-width: 52px;
    }
    .range-row input[type="number"] {
      width: 62px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 2px;
      padding: 1px 3px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
    }
    .range-sep { font-size: 11px; opacity: 0.5; }
    .range-wrap-note {
      font-size: 10px;
      opacity: 0.5;
      font-style: italic;
      white-space: nowrap;
    }

    /* Hue arc selector */
    .hue-arc-wrap {
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .hue-arc-wrap.visible { display: flex; }
    .hue-arc-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    #hueArcCanvas {
      cursor: pointer;
      flex-shrink: 0;
    }
    .hue-arc-inputs {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .hue-arc-inputs .arc-input-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .hue-arc-inputs .arc-input-label {
      font-size: 10px;
      font-weight: 600;
      opacity: 0.6;
      min-width: 32px;
    }
    .hue-arc-inputs input[type="number"] {
      width: 56px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 2px;
      padding: 1px 3px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
    }
    .hue-arc-span {
      font-size: 10px;
      opacity: 0.5;
      text-align: center;
    }

    ${cssSliders()}

    /* Swatch */
    .swatch-wrap {
      width: 32px;
      height: 32px;
      border-radius: 4px;
      flex-shrink: 0;
      position: relative;
      overflow: hidden;
      border: 1px solid var(--vscode-panel-border, #444);
    }
    .swatch-inner {
      position: absolute;
      inset: 0;
    }
    .mini-swatch-pair {
      display: inline-flex;
      align-items: center;
      gap: 0;
      border-radius: 3px;
      overflow: hidden;
      border: 1px solid var(--vscode-panel-border, #444);
      vertical-align: middle;
      height: 22px;
      font-size: 11px;
      font-weight: 700;
    }
    .mini-swatch-pair .swatch-bg {
      padding: 2px 6px;
      line-height: 1;
    }

    ${CSS_TRANSFORM_CONTROLS}
    ${CSS_COPY_BUTTON}

    /* CSS expression (always visible in formula panel) */
    .css-expression { margin-top: 8px; }

    /* Chart */
    .chart-wrap {
      position: relative;
      margin-bottom: 4px;
    }
    #contrastChart {
      width: 100%;
      height: 180px;
      display: block;
      border: 1px solid var(--vscode-panel-border, #444);
      border-radius: 3px;
    }
    .metric-toggle {
      display: flex;
      gap: 0;
      margin-bottom: 8px;
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 3px;
      overflow: hidden;
      width: fit-content;
    }
    .metric-btn {
      padding: 3px 10px;
      border: none;
      background: transparent;
      color: var(--vscode-editor-foreground);
      cursor: pointer;
      font-size: 11px;
    }
    .metric-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    }
    .metric-btn.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    /* Results */
    .result-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .result-label {
      font-size: 11px;
      font-weight: 600;
      opacity: 0.7;
      min-width: 32px;
    }
    .contrast-value {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 13px;
      font-weight: 700;
    }
    .contrast-value.good { color: #4caf50; }
    .contrast-value.ok { color: #ff9800; }
    .contrast-value.poor { color: #f44336; }
    .result-at {
      font-size: 11px;
      opacity: 0.6;
      font-family: var(--vscode-editor-font-family, monospace);
    }
    .assessment {
      font-size: 12px;
      margin-top: 8px;
      padding: 6px 8px;
      border-radius: 3px;
      border: 1px solid var(--vscode-panel-border, #444);
    }
    .assessment.pass {
      border-color: #4caf50;
      color: #4caf50;
    }
    .assessment.warn {
      border-color: #ff9800;
      color: #ff9800;
    }
    .assessment.fail {
      border-color: #f44336;
      color: #f44336;
    }

    ${CSS_ACTION_BUTTONS}
  </style>
</head>
<body>

  <!-- Section 1: Base Color Configuration -->
  <div class="section">
    <h3>Base Color (Variable Component)</h3>
    <div class="var-selector">
      <button class="var-btn" data-var="L">Lightness</button>
      <button class="var-btn" data-var="C">Chroma</button>
      <button class="var-btn active" data-var="H">Hue</button>
    </div>

    <div id="fixedSliders"></div>

    <div class="range-row" id="rangeRow">
      <span class="range-label" id="rangeLabel">L range</span>
      <input type="number" id="rangeMin" step="0.01" value="0">
      <span class="range-sep" id="rangeSep">to</span>
      <input type="number" id="rangeMax" step="0.01" value="1">
      <span class="range-wrap-note" id="rangeWrapNote"></span>
    </div>

    <div class="hue-arc-wrap" id="hueArcWrap">
      <div class="hue-arc-row">
        <canvas id="hueArcCanvas" width="140" height="140"></canvas>
        <div class="hue-arc-inputs">
          <div class="arc-input-row">
            <span class="arc-input-label">Start</span>
            <input type="number" id="arcStartNum" min="0" max="360" step="1" value="0">
            <span class="slider-unit">°</span>
          </div>
          <div class="arc-input-row">
            <span class="arc-input-label">End</span>
            <input type="number" id="arcEndNum" min="0" max="360" step="1" value="360">
            <span class="slider-unit">°</span>
          </div>
          <div class="hue-arc-span" id="arcSpanLabel">360° span</div>
        </div>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
      <span style="font-size:11px;opacity:0.6;">Midpoint preview:</span>
      <div class="swatch-wrap"><div class="swatch-inner" id="midSwatch"></div></div>
    </div>
  </div>

  <!-- Section 2: Formula -->
  <div class="section">
    <h3>Formula</h3>
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
        <option value="darker" selected>Darker</option>
      </select>
      <input type="range" id="lightnessAmount" min="0" max="0.8" step="0.01" value="0.4">
      <input type="number" id="lightnessNum" min="0" max="0.8" step="0.01" value="0.4">
    </div>
    <div class="transform-row">
      <input type="checkbox" id="chkChroma" checked>
      <label for="chkChroma">Chroma</label>
      <input type="range" id="chromaScale" min="0" max="2" step="0.01" value="0.3">
      <input type="number" id="chromaNum" min="0" max="2" step="0.01" value="0.3">
    </div>
    <div class="transform-row">
      <input type="checkbox" id="chkHue">
      <label for="chkHue">Hue shift</label>
      <input type="range" id="hueShift" min="-180" max="180" step="1" value="0">
      <input type="number" id="hueNum" min="-180" max="180" step="1" value="0">
    </div>

    <div class="css-expression">
      <div class="css-expr-label">CSS relative color:</div>
      <div class="css-expr-code">
        <span class="css-expr-text" id="cssExprText"></span>
        <button class="copy-btn" id="copyCssExpr" title="Copy CSS expression"><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4h1V2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h1zm1 0h4a1 1 0 0 1 1 1v5h1V2H6v2zm-2 1v8h6V5H3z"/></svg><span class="copied-msg" id="copiedCssExpr">Copied!</span></button>
      </div>
    </div>
  </div>

  <!-- Section 3: Contrast Chart -->
  <div class="section">
    <h3>Contrast Across Range</h3>
    <div class="metric-toggle">
      <button class="metric-btn active" data-metric="apca">APCA</button>
      <button class="metric-btn" data-metric="wcag">WCAG</button>
    </div>
    <div class="chart-wrap">
      <canvas id="contrastChart"></canvas>
    </div>
  </div>

  <!-- Section 4: Results -->
  <div class="section">
    <h3>Results</h3>
    <div class="result-row">
      <span class="result-label">Min</span>
      <span class="contrast-value" id="minValue">—</span>
      <span class="result-at" id="minAt"></span>
      <span id="minSwatches"></span>
    </div>
    <div class="result-row">
      <span class="result-label">Max</span>
      <span class="contrast-value" id="maxValue">—</span>
      <span class="result-at" id="maxAt"></span>
      <span id="maxSwatches"></span>
    </div>
    <div class="assessment" id="assessment"></div>
  </div>

  <!-- Section 5: Actions -->
  <div class="section">
    <div class="buttons">
      <button class="action" id="btnInsertFormula">Insert Formula</button>
      <button class="action secondary" id="btnCopyFormula">Copy Formula</button>
    </div>
  </div>

<script nonce="${nonce}">
  const vscodeApi = acquireVsCodeApi();

  // --- Inline color conversion & math ---
  ${WEBVIEW_COLOR_CORE}
  ${WEBVIEW_GAMUT_CHECK}
  ${WEBVIEW_CONTRAST_MATH}
  ${webviewFormatScript(fmtOpts)}

  // --- State ---
  let variableComponent = 'H';
  let fixedL = ${initL}, fixedC = ${initC}, fixedH = ${initH};
  let basePropertyName = ${initialPropertyName};
  let varMin = 0, varMax = 360;

  // Transform state
  let lightnessEnabled = true, lightnessDir = 'darker', lightnessAmount = 0.4;
  let chromaEnabled = true, chromaScale = 0.3;
  let hueEnabled = false, hueShift = 0;
  let activePreset = null;
  let targetLc = 75;

  // Chart
  let chartMetric = 'apca';
  let contrastSamples = [];
  let minContrast = { t: 0, value: 0, baseL: 0, baseC: 0, baseH: 0, dL: 0, dC: 0, dH: 0 };
  let maxContrast = { t: 0, value: 0, baseL: 0, baseC: 0, baseH: 0, dL: 0, dC: 0, dH: 0 };

  // --- DOM refs ---
  const $ = id => document.getElementById(id);
  const fixedSlidersEl = $('fixedSliders');
  const rangeMinEl = $('rangeMin');
  const rangeMaxEl = $('rangeMax');
  const rangeLabelEl = $('rangeLabel');
  const midSwatch = $('midSwatch');
  const canvas = $('contrastChart');
  const ctx = canvas.getContext('2d');
  const cssExprText = $('cssExprText');
  const targetLcRow = $('targetLcRow');
  const targetLcSelect = $('targetLcSelect');
  const btnInsertFormula = $('btnInsertFormula');
  const btnCopyFormula = $('btnCopyFormula');

  // --- Variable component selector ---
  document.querySelectorAll('.var-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.var-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const newVar = btn.dataset.var;
      switchVariable(newVar);
    });
  });

  // --- Hue wrapping helpers ---
  // For hue, the range can wrap around 0°/360°. E.g., 320° to 40° means
  // 320→360→0→40 (a span of 80°). We detect wrapping when varMin > varMax.
  function isHueWrapping() {
    return variableComponent === 'H' && varMin > varMax;
  }

  function effectiveRange() {
    if (isHueWrapping()) return 360 - varMin + varMax;
    return varMax - varMin;
  }

  // Map a linear parameter p in [0, effectiveRange] to the actual hue value
  function paramToHue(p) {
    let h = varMin + p;
    if (h >= 360) h -= 360;
    return h;
  }

  // Map a sample index i (out of N total) to the actual variable value
  function sampleValue(i, N) {
    const er = effectiveRange();
    if (variableComponent === 'H' && isHueWrapping()) {
      return paramToHue(er * i / N);
    }
    return varMin + (er * i / N);
  }

  // Midpoint of the variable range (handling hue wrapping)
  function rangeMidpoint() {
    if (isHueWrapping()) {
      return paramToHue(effectiveRange() / 2);
    }
    return (varMin + varMax) / 2;
  }

  function switchVariable(newVar) {
    // Before switching, save the current midpoint of the variable range as its fixed value
    if (variableComponent === 'L') fixedL = rangeMidpoint();
    else if (variableComponent === 'C') fixedC = rangeMidpoint();
    else fixedH = rangeMidpoint();

    variableComponent = newVar;

    // Set default range for the new variable
    if (newVar === 'L') { varMin = 0; varMax = 1; }
    else if (newVar === 'C') { varMin = 0; varMax = 0.4; }
    else { varMin = 0; varMax = 360; }

    buildFixedSliders();
    updateRangeInputs();
    fullUpdate();
  }

  function buildSliderCells(comp) {
    if (comp === 'L') {
      return '<span class="slider-label">L</span>'
        + '<input type="range" id="fixSliderL" min="0" max="1" step="0.001" value="' + fixedL + '">'
        + '<input type="number" id="fixNumL" min="0" max="' + (fmtLightness === 'percentage' ? '100' : '1') + '" step="' + (fmtLightness === 'percentage' ? '0.1' : '0.001') + '">'
        + '<span class="slider-unit">' + (fmtLightness === 'percentage' ? '%' : '') + '</span>';
    } else if (comp === 'C') {
      return '<span class="slider-label">C</span>'
        + '<input type="range" id="fixSliderC" min="0" max="0.4" step="0.001" value="' + fixedC + '">'
        + '<input type="number" id="fixNumC" min="0" max="' + (fmtChroma === 'percentage' ? '125' : '0.5') + '" step="' + (fmtChroma === 'percentage' ? '0.1' : '0.001') + '">'
        + '<span class="slider-unit">' + (fmtChroma === 'percentage' ? '%' : '') + '</span>';
    } else {
      return '<span class="slider-label">H</span>'
        + '<input type="range" id="fixSliderH" min="0" max="360" step="0.5" value="' + fixedH + '">'
        + '<input type="number" id="fixNumH" min="0" max="360" step="0.5">'
        + '<span class="slider-unit">' + (fmtHue === 'deg' ? 'deg' : '') + '</span>';
    }
  }

  function buildFixedSliders() {
    // Build all three component rows in L, C, H order.
    // Fixed components go into a CSS grid for aligned columns.
    // The variable component's control (range row or hue arc) sits outside the grid.
    // We build: [before-grid varSlot?] [grid of fixed sliders] [after-grid varSlot?]
    // depending on where the variable falls in L, C, H order.
    const components = ['L', 'C', 'H'];
    let beforeVar = '';
    let afterVar = '';
    let seenVar = false;
    components.forEach(comp => {
      if (comp === variableComponent) {
        seenVar = true;
        return;
      }
      const cells = buildSliderCells(comp);
      if (!seenVar) {
        beforeVar += cells;
      } else {
        afterVar += cells;
      }
    });

    let html = '';
    if (beforeVar) html += '<div class="sliders-grid">' + beforeVar + '</div>';
    html += '<div id="varSlot"></div>';
    if (afterVar) html += '<div class="sliders-grid">' + afterVar + '</div>';
    fixedSlidersEl.innerHTML = html;

    // Move the range row or hue arc into the variable slot
    const varSlot = $('varSlot');
    if (variableComponent === 'H') {
      varSlot.appendChild(hueArcWrap);
      hueArcWrap.classList.add('visible');
      rangeRow.style.display = 'none';
    } else {
      varSlot.appendChild(rangeRow);
      rangeRow.style.display = '';
      hueArcWrap.classList.remove('visible');
    }

    // Wire up fixed sliders
    if (variableComponent !== 'L') {
      wireFixedSlider('fixSliderL', 'fixNumL', v => { fixedL = v; },
        fmtLightness === 'percentage' ? v => v / 100 : null,
        fmtLightness === 'percentage' ? v => parseFloat((v * 100).toFixed(2)) : v => parseFloat(v.toFixed(4)));
    }
    if (variableComponent !== 'C') {
      wireFixedSlider('fixSliderC', 'fixNumC', v => { fixedC = v; },
        fmtChroma === 'percentage' ? v => v / 100 * 0.4 : null,
        fmtChroma === 'percentage' ? v => parseFloat((v / 0.4 * 100).toFixed(2)) : v => parseFloat(v.toFixed(4)));
    }
    if (variableComponent !== 'H') {
      wireFixedSlider('fixSliderH', 'fixNumH', v => { fixedH = v; },
        null,
        v => parseFloat(v.toFixed(2)));
    }
  }

  function wireFixedSlider(sliderId, numId, setter, numToInternal, internalToNum) {
    const slider = $(sliderId);
    const num = $(numId);
    if (!slider || !num) return;
    // Set initial num value
    const currentVal = sliderId.includes('L') ? fixedL : sliderId.includes('C') ? fixedC : fixedH;
    num.value = internalToNum(currentVal);

    slider.addEventListener('input', () => {
      setter(parseFloat(slider.value));
      num.value = internalToNum(parseFloat(slider.value));
      fullUpdate();
    });
    num.addEventListener('input', () => {
      const v = parseFloat(num.value);
      if (!isNaN(v)) {
        const internal = numToInternal ? numToInternal(v) : v;
        setter(internal);
        slider.value = internal;
        fullUpdate();
      }
    });
  }

  const rangeWrapNote = $('rangeWrapNote');

  function updateRangeInputs() {
    if (variableComponent === 'L') {
      rangeLabelEl.textContent = 'L range';
      rangeMinEl.min = '0'; rangeMinEl.max = '1'; rangeMinEl.step = '0.01';
      rangeMaxEl.min = '0'; rangeMaxEl.max = '1'; rangeMaxEl.step = '0.01';
    } else if (variableComponent === 'C') {
      rangeLabelEl.textContent = 'C range';
      rangeMinEl.min = '0'; rangeMinEl.max = '0.4'; rangeMinEl.step = '0.001';
      rangeMaxEl.min = '0'; rangeMaxEl.max = '0.4'; rangeMaxEl.step = '0.001';
    } else {
      rangeLabelEl.textContent = 'H range';
      rangeMinEl.min = '0'; rangeMinEl.max = '360'; rangeMinEl.step = '1';
      rangeMaxEl.min = '0'; rangeMaxEl.max = '360'; rangeMaxEl.step = '1';
    }
    rangeMinEl.value = varMin;
    rangeMaxEl.value = varMax;

    // Show wrap note for hue
    if (isHueWrapping()) {
      rangeWrapNote.textContent = '(wraps through 0\\u00B0)';
    } else {
      rangeWrapNote.textContent = '';
    }

    // Sync hue arc inputs
    if (variableComponent === 'H') {
      syncArcInputs();
    }
  }

  rangeMinEl.addEventListener('input', () => {
    const v = parseFloat(rangeMinEl.value);
    if (!isNaN(v)) { varMin = v; fullUpdate(); }
  });
  rangeMaxEl.addEventListener('input', () => {
    const v = parseFloat(rangeMaxEl.value);
    if (!isNaN(v)) { varMax = v; fullUpdate(); }
  });

  // --- Hue arc selector ---
  const hueArcWrap = $('hueArcWrap');
  const hueArcCanvas = $('hueArcCanvas');
  const hueArcCtx = hueArcCanvas.getContext('2d');
  const arcStartNum = $('arcStartNum');
  const arcEndNum = $('arcEndNum');
  const arcSpanLabel = $('arcSpanLabel');
  const rangeRow = $('rangeRow');

  const ARC_SIZE = 140;
  const ARC_CX = ARC_SIZE / 2;
  const ARC_CY = ARC_SIZE / 2;
  const ARC_OUTER = 62;
  const ARC_INNER = 42;
  const ARC_MID = (ARC_OUTER + ARC_INNER) / 2;
  const ARC_HANDLE_R = 8;

  // Convert hue degrees to canvas angle (0° = top, clockwise)
  function hueToAngle(h) { return (h - 90) * Math.PI / 180; }
  function angleToHue(a) { let h = a * 180 / Math.PI + 90; return ((h % 360) + 360) % 360; }

  function drawHueArc() {
    const w = ARC_SIZE, h = ARC_SIZE;
    hueArcCtx.clearRect(0, 0, w, h);

    // Draw full hue ring
    const steps = 360;
    for (let i = 0; i < steps; i++) {
      const hue = i;
      const a1 = hueToAngle(hue) - 0.01;
      const a2 = hueToAngle(hue + 1.5);
      const rgb = oklchToSrgb(0.7, 0.15, hue);
      const r = Math.min(255, Math.max(0, Math.round(clamp01(rgb.r) * 255)));
      const g = Math.min(255, Math.max(0, Math.round(clamp01(rgb.g) * 255)));
      const b = Math.min(255, Math.max(0, Math.round(clamp01(rgb.b) * 255)));
      hueArcCtx.beginPath();
      hueArcCtx.arc(ARC_CX, ARC_CY, ARC_OUTER, a1, a2);
      hueArcCtx.arc(ARC_CX, ARC_CY, ARC_INNER, a2, a1, true);
      hueArcCtx.closePath();
      hueArcCtx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      hueArcCtx.fill();
    }

    // Dim the non-selected region with a semi-transparent overlay
    const startAngle = hueToAngle(varMin);
    const endAngle = hueToAngle(varMax);
    // The selected arc goes from varMin to varMax (clockwise, possibly wrapping)
    // We dim everything OUTSIDE that arc
    hueArcCtx.globalCompositeOperation = 'source-over';
    // Draw dim overlay for the non-selected arc
    hueArcCtx.beginPath();
    if (varMin === 0 && varMax === 360) {
      // Full circle selected — no dimming needed
    } else {
      // Dim from endAngle back to startAngle (the non-selected arc)
      hueArcCtx.arc(ARC_CX, ARC_CY, ARC_OUTER + 1, endAngle, startAngle);
      hueArcCtx.arc(ARC_CX, ARC_CY, ARC_INNER - 1, startAngle, endAngle, true);
      hueArcCtx.closePath();
      hueArcCtx.fillStyle = 'rgba(0,0,0,0.55)';
      hueArcCtx.fill();
    }

    // Draw handle outlines on the selected arc boundary
    function drawHandle(hue, label) {
      const a = hueToAngle(hue);
      const hx = ARC_CX + ARC_MID * Math.cos(a);
      const hy = ARC_CY + ARC_MID * Math.sin(a);

      // Handle circle
      hueArcCtx.beginPath();
      hueArcCtx.arc(hx, hy, ARC_HANDLE_R, 0, Math.PI * 2);
      const rgb = oklchToSrgb(0.7, 0.15, hue);
      const r = Math.round(clamp01(rgb.r) * 255);
      const g = Math.round(clamp01(rgb.g) * 255);
      const b = Math.round(clamp01(rgb.b) * 255);
      hueArcCtx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      hueArcCtx.fill();
      hueArcCtx.strokeStyle = '#fff';
      hueArcCtx.lineWidth = 2;
      hueArcCtx.stroke();

      // Label inside handle
      hueArcCtx.fillStyle = (r * 0.299 + g * 0.587 + b * 0.114) > 128 ? '#000' : '#fff';
      hueArcCtx.font = 'bold 8px sans-serif';
      hueArcCtx.textAlign = 'center';
      hueArcCtx.textBaseline = 'middle';
      hueArcCtx.fillText(label, hx, hy);
    }

    drawHandle(varMin, 'S');
    drawHandle(varMax, 'E');

    // Draw span arc indicator (inner edge, thin line)
    hueArcCtx.beginPath();
    hueArcCtx.arc(ARC_CX, ARC_CY, ARC_INNER - 4, startAngle, endAngle);
    hueArcCtx.strokeStyle = 'rgba(255,255,255,0.4)';
    hueArcCtx.lineWidth = 2;
    hueArcCtx.stroke();

    // Center text: span in degrees
    const span = effectiveRange();
    hueArcCtx.fillStyle = getComputedStyle(document.body).color || '#ccc';
    hueArcCtx.font = '13px sans-serif';
    hueArcCtx.textAlign = 'center';
    hueArcCtx.textBaseline = 'middle';
    hueArcCtx.fillText(Math.round(span) + '°', ARC_CX, ARC_CY);
  }

  // Hit-test handles
  function hitTestArcHandle(x, y) {
    function dist(hue) {
      const a = hueToAngle(hue);
      const hx = ARC_CX + ARC_MID * Math.cos(a);
      const hy = ARC_CY + ARC_MID * Math.sin(a);
      return Math.sqrt((x - hx) * (x - hx) + (y - hy) * (y - hy));
    }
    const ds = dist(varMin);
    const de = dist(varMax);
    const threshold = ARC_HANDLE_R + 4;
    if (ds < threshold && ds <= de) return 'start';
    if (de < threshold) return 'end';
    return null;
  }

  let arcDragging = null; // 'start' | 'end' | null

  hueArcCanvas.addEventListener('pointerdown', (e) => {
    const rect = hueArcCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = hitTestArcHandle(x, y);
    if (hit) {
      arcDragging = hit;
      hueArcCanvas.setPointerCapture(e.pointerId);
    }
  });

  hueArcCanvas.addEventListener('pointermove', (e) => {
    if (!arcDragging) return;
    const rect = hueArcCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const angle = Math.atan2(y - ARC_CY, x - ARC_CX);
    let hue = Math.round(angleToHue(angle));
    hue = ((hue % 360) + 360) % 360;

    if (arcDragging === 'start') {
      varMin = hue;
    } else {
      varMax = hue;
    }
    syncArcInputs();
    fullUpdate();
  });

  hueArcCanvas.addEventListener('pointerup', () => { arcDragging = null; });
  hueArcCanvas.addEventListener('pointercancel', () => { arcDragging = null; });

  // Sync number inputs with arc state
  function syncArcInputs() {
    arcStartNum.value = Math.round(varMin);
    arcEndNum.value = Math.round(varMax);
    const span = effectiveRange();
    arcSpanLabel.textContent = Math.round(span) + '° span';
  }

  // Number inputs update arc
  arcStartNum.addEventListener('input', () => {
    const v = parseFloat(arcStartNum.value);
    if (!isNaN(v) && v >= 0 && v <= 360) {
      varMin = v;
      fullUpdate();
    }
  });
  arcEndNum.addEventListener('input', () => {
    const v = parseFloat(arcEndNum.value);
    if (!isNaN(v) && v >= 0 && v <= 360) {
      varMax = v;
      fullUpdate();
    }
  });

  // --- Transform controls ---
  const chkLightness = $('chkLightness'), lightnessDirEl = $('lightnessDir');
  const lightnessAmountEl = $('lightnessAmount'), lightnessNumEl = $('lightnessNum');
  const chkChroma = $('chkChroma'), chromaScaleEl = $('chromaScale'), chromaNumEl = $('chromaNum');
  const chkHue = $('chkHue'), hueShiftEl = $('hueShift'), hueNumEl = $('hueNum');

  function clearPresetBtns() {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  }

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

  // --- Presets ---
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
      case 'accessible-text':
        targetLcRow.classList.add('visible');
        lightnessEnabled = true; chkLightness.checked = true;
        lightnessDir = 'darker'; lightnessDirEl.value = 'darker';
        lightnessAmount = 0.4; lightnessAmountEl.value = '0.4'; lightnessNumEl.value = '0.4';
        chromaEnabled = true; chkChroma.checked = true;
        chromaScale = 0.3; chromaScaleEl.value = '0.3'; chromaNumEl.value = '0.3';
        hueEnabled = false; chkHue.checked = false;
        hueShift = 0; hueShiftEl.value = '0'; hueNumEl.value = '0';
        break;
      case 'subtle-bg':
        targetLcRow.classList.remove('visible');
        lightnessEnabled = true; chkLightness.checked = true;
        lightnessDir = 'darker'; lightnessDirEl.value = 'darker';
        lightnessAmount = 0.05; lightnessAmountEl.value = '0.05'; lightnessNumEl.value = '0.05';
        chromaEnabled = true; chkChroma.checked = true;
        chromaScale = 0.5; chromaScaleEl.value = '0.5'; chromaNumEl.value = '0.5';
        hueEnabled = false; chkHue.checked = false;
        hueShift = 0; hueShiftEl.value = '0'; hueNumEl.value = '0';
        break;
      case 'border':
        targetLcRow.classList.remove('visible');
        lightnessEnabled = true; chkLightness.checked = true;
        lightnessDir = 'darker'; lightnessDirEl.value = 'darker';
        lightnessAmount = 0.15; lightnessAmountEl.value = '0.15'; lightnessNumEl.value = '0.15';
        chromaEnabled = true; chkChroma.checked = true;
        chromaScale = 0.7; chromaScaleEl.value = '0.7'; chromaNumEl.value = '0.7';
        hueEnabled = false; chkHue.checked = false;
        hueShift = 0; hueShiftEl.value = '0'; hueNumEl.value = '0';
        break;
      case 'complementary':
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

  // --- Metric toggle ---
  document.querySelectorAll('.metric-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.metric-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      chartMetric = btn.dataset.metric;
      fullUpdate();
    });
  });

  // --- Core: compute derived from base ---
  function computeDerived(bL, bC, bH) {
    let dL = bL, dC = bC, dH = bH;
    if (lightnessEnabled) {
      dL = lightnessDir === 'lighter'
        ? Math.min(1, bL + lightnessAmount)
        : Math.max(0, bL - lightnessAmount);
    }
    if (chromaEnabled) { dC = bC * chromaScale; }
    if (hueEnabled) { dH = ((bH + hueShift) % 360 + 360) % 360; }
    return { L: dL, C: dC, H: dH };
  }

  function clampedSrgb(L, C, H) {
    const rgb = oklchToSrgb(L, C, H);
    return { r: clamp01(rgb.r), g: clamp01(rgb.g), b: clamp01(rgb.b) };
  }

  // --- Sweep contrast across the variable range ---
  function sweepContrast() {
    const N = 200;
    const samples = [];
    const er = effectiveRange();
    if (er <= 0) {
      contrastSamples = [];
      return;
    }

    for (let i = 0; i <= N; i++) {
      const t = sampleValue(i, N);

      let bL, bC, bH;
      if (variableComponent === 'L') { bL = t; bC = fixedC; bH = fixedH; }
      else if (variableComponent === 'C') { bL = fixedL; bC = t; bH = fixedH; }
      else { bL = fixedL; bC = fixedC; bH = t; }

      const derived = computeDerived(bL, bC, bH);
      const baseRgb = oklchToSrgb(bL, bC, bH);
      const derivedRgb = oklchToSrgb(derived.L, derived.C, derived.H);
      const baseInGamut = isInGamut(baseRgb.r, baseRgb.g, baseRgb.b);
      const derivedInGamut = isInGamut(derivedRgb.r, derivedRgb.g, derivedRgb.b);
      const baseClamped = { r: clamp01(baseRgb.r), g: clamp01(baseRgb.g), b: clamp01(baseRgb.b) };
      const derivedClamped = { r: clamp01(derivedRgb.r), g: clamp01(derivedRgb.g), b: clamp01(derivedRgb.b) };

      let contrast;
      if (chartMetric === 'apca') {
        contrast = computeAPCA(derivedClamped, baseClamped);
      } else {
        contrast = computeWCAG(baseClamped, derivedClamped);
      }

      samples.push({
        t, contrast,
        bL, bC, bH,
        dL: derived.L, dC: derived.C, dH: derived.H,
        inGamut: baseInGamut && derivedInGamut
      });
    }

    contrastSamples = samples;

    // Find min/max by absolute contrast
    let minIdx = 0, maxIdx = 0;
    for (let i = 0; i < samples.length; i++) {
      const v = chartMetric === 'apca' ? Math.abs(samples[i].contrast) : samples[i].contrast;
      const minV = chartMetric === 'apca' ? Math.abs(samples[minIdx].contrast) : samples[minIdx].contrast;
      const maxV = chartMetric === 'apca' ? Math.abs(samples[maxIdx].contrast) : samples[maxIdx].contrast;
      if (v < minV) minIdx = i;
      if (v > maxV) maxIdx = i;
    }

    // Refine with golden section search
    minContrast = refineExtremum(samples, minIdx, 'min');
    maxContrast = refineExtremum(samples, maxIdx, 'max');
  }

  // Evaluate contrast at a variable value t (actual value, not parameter)
  function evalContrastAt(t) {
    let bL, bC, bH;
    if (variableComponent === 'L') { bL = t; bC = fixedC; bH = fixedH; }
    else if (variableComponent === 'C') { bL = fixedL; bC = t; bH = fixedH; }
    else { bL = fixedL; bC = fixedC; bH = t; }

    const derived = computeDerived(bL, bC, bH);
    const baseClamped = clampedSrgb(bL, bC, bH);
    const derivedClamped = clampedSrgb(derived.L, derived.C, derived.H);

    const contrast = chartMetric === 'apca'
      ? Math.abs(computeAPCA(derivedClamped, baseClamped))
      : computeWCAG(baseClamped, derivedClamped);

    return { contrast, bL, bC, bH, dL: derived.L, dC: derived.C, dH: derived.H };
  }

  // Evaluate contrast at a linear parameter p (offset from varMin), handling hue wrapping
  function evalContrastAtParam(p) {
    let t;
    if (isHueWrapping()) {
      t = varMin + p;
      if (t >= 360) t -= 360;
    } else {
      t = varMin + p;
    }
    return { ...evalContrastAt(t), t };
  }

  // Convert actual t value to linear parameter (offset from varMin)
  function tToParam(t) {
    if (isHueWrapping()) {
      return t >= varMin ? t - varMin : t + 360 - varMin;
    }
    return t - varMin;
  }

  function refineExtremum(samples, idx, type) {
    // Work in linear parameter space to avoid hue wrapping issues
    const pIdx = tToParam(samples[idx].t);
    const er = effectiveRange();
    const step = er / samples.length;
    const pLo = Math.max(0, pIdx - step);
    const pHi = Math.min(er, pIdx + step);

    if (pLo === pHi) {
      const e = evalContrastAtParam(pIdx);
      return { t: e.t, value: e.contrast, baseL: e.bL, baseC: e.bC, baseH: e.bH, dL: e.dL, dC: e.dC, dH: e.dH };
    }

    const phi = (1 + Math.sqrt(5)) / 2;
    const resphi = 2 - phi;
    let a = pLo, b = pHi;
    let x1 = a + resphi * (b - a);
    let x2 = b - resphi * (b - a);
    let f1 = evalContrastAtParam(x1).contrast;
    let f2 = evalContrastAtParam(x2).contrast;

    for (let i = 0; i < 30; i++) {
      const isMin = type === 'min';
      if ((isMin && f1 < f2) || (!isMin && f1 > f2)) {
        b = x2; x2 = x1; f2 = f1;
        x1 = a + resphi * (b - a);
        f1 = evalContrastAtParam(x1).contrast;
      } else {
        a = x1; x1 = x2; f1 = f2;
        x2 = b - resphi * (b - a);
        f2 = evalContrastAtParam(x2).contrast;
      }
    }

    const pBest = (a + b) / 2;
    const e = evalContrastAtParam(pBest);
    return { t: e.t, value: e.contrast, baseL: e.bL, baseC: e.bC, baseH: e.bH, dL: e.dL, dC: e.dC, dH: e.dH };
  }

  // --- CSS expression ---
  function buildCssExpression() {
    let lExpr = 'l', cExpr = 'c', hExpr = 'h';
    if (lightnessEnabled && lightnessAmount !== 0) {
      const sign = lightnessDir === 'lighter' ? '+' : '-';
      lExpr = 'calc(l ' + sign + ' ' + lightnessAmount.toFixed(2) + ')';
    }
    if (chromaEnabled && chromaScale !== 1) {
      if (chromaScale === 0) { cExpr = '0'; }
      else { cExpr = 'calc(c * ' + chromaScale.toFixed(2) + ')'; }
    }
    if (hueEnabled && hueShift !== 0) {
      const sign = hueShift > 0 ? '+' : '-';
      hExpr = 'calc(h ' + sign + ' ' + Math.abs(hueShift) + 'deg)';
    }
    const baseRef = basePropertyName && basePropertyName.startsWith('--')
      ? 'var(' + basePropertyName + ')'
      : 'var(--base)';
    return 'oklch(from ' + baseRef + ' ' + lExpr + ' ' + cExpr + ' ' + hExpr + ')';
  }

  // --- Chart rendering ---
  let chartW = 360, chartH = 180;
  const pad = { top: 12, right: 52, bottom: 28, left: 42 };

  function resizeChart() {
    const rect = canvas.getBoundingClientRect();
    chartW = Math.floor(rect.width);
    chartH = Math.floor(rect.height);
    canvas.width = chartW;
    canvas.height = chartH;
  }

  function drawChart() {
    ctx.clearRect(0, 0, chartW, chartH);
    if (contrastSamples.length === 0) return;

    const plotW = chartW - pad.left - pad.right;
    const plotH = chartH - pad.top - pad.bottom;

    // Determine Y range
    const absValues = contrastSamples.map(s =>
      chartMetric === 'apca' ? Math.abs(s.contrast) : s.contrast
    );
    const dataMax = Math.max(...absValues);
    const yMin = 0;
    const yMax = chartMetric === 'apca'
      ? Math.max(110, Math.ceil(dataMax / 10) * 10)
      : Math.max(22, Math.ceil(dataMax + 1));

    const er = effectiveRange() || 1;
    const xPx = t => pad.left + (tToParam(t) / er) * plotW;
    const yPx = v => pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(pad.left, pad.top, plotW, plotH);

    // Threshold lines
    const thresholds = chartMetric === 'apca'
      ? [{ v: 90, c: '#4caf50' }, { v: 75, c: '#8bc34a' }, { v: 60, c: '#ff9800' }, { v: 45, c: '#ff5722' }, { v: 30, c: '#9e9e9e' }]
      : [{ v: 7, c: '#4caf50' }, { v: 4.5, c: '#ff9800' }, { v: 3, c: '#9e9e9e' }];

    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    thresholds.forEach(th => {
      const y = yPx(th.v);
      if (y >= pad.top && y <= pad.top + plotH) {
        ctx.strokeStyle = th.c;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + plotW, y);
        ctx.stroke();
        // Label
        ctx.fillStyle = th.c;
        ctx.globalAlpha = 0.7;
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(chartMetric === 'apca' ? 'Lc ' + th.v : th.v + ':1', pad.left + plotW + 4, y + 3);
      }
    });
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);

    // Draw curve — split into in-gamut and out-of-gamut segments
    ctx.lineWidth = 2;
    let prevInGamut = contrastSamples[0].inGamut;
    let segStart = 0;

    for (let i = 1; i <= contrastSamples.length; i++) {
      const curInGamut = i < contrastSamples.length ? contrastSamples[i].inGamut : !prevInGamut;
      if (curInGamut !== prevInGamut || i === contrastSamples.length) {
        // Draw segment from segStart to i-1
        ctx.strokeStyle = prevInGamut ? '#64b5f6' : '#64b5f6';
        ctx.globalAlpha = prevInGamut ? 1 : 0.35;
        ctx.setLineDash(prevInGamut ? [] : [3, 3]);
        ctx.beginPath();
        for (let j = segStart; j < i; j++) {
          const s = contrastSamples[j];
          const x = xPx(s.t);
          const v = chartMetric === 'apca' ? Math.abs(s.contrast) : s.contrast;
          const y = yPx(v);
          if (j === segStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        segStart = i;
        prevInGamut = curInGamut;
      }
    }

    // Min/max markers
    [minContrast, maxContrast].forEach((pt, i) => {
      const x = xPx(pt.t);
      const y = yPx(pt.value);
      ctx.fillStyle = i === 0 ? '#f44336' : '#4caf50';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // X axis labels
    ctx.fillStyle = getComputedStyle(document.body).color || '#ccc';
    ctx.globalAlpha = 0.6;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    const xSteps = 5;
    for (let i = 0; i <= xSteps; i++) {
      const t = sampleValue(i, xSteps);
      const x = pad.left + (plotW * i / xSteps);
      const label = variableComponent === 'L' ? t.toFixed(2) :
                     variableComponent === 'C' ? t.toFixed(3) :
                     Math.round(t) + '';
      ctx.fillText(label, x, chartH - 4);
    }

    // X axis title
    ctx.textAlign = 'center';
    ctx.fillText(variableComponent === 'L' ? 'Lightness' : variableComponent === 'C' ? 'Chroma' : 'Hue', pad.left + plotW / 2, chartH - 14);

    // Y axis labels
    ctx.textAlign = 'right';
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const v = yMin + (yMax - yMin) * i / ySteps;
      const y = yPx(v);
      const label = chartMetric === 'apca' ? Math.round(v) + '' : v.toFixed(1);
      ctx.fillText(label, pad.left - 4, y + 3);
    }
    ctx.globalAlpha = 1;
  }

  // --- Results ---
  function updateResults() {
    const minEl = $('minValue');
    const maxEl = $('maxValue');
    const minAtEl = $('minAt');
    const maxAtEl = $('maxAt');
    const minSwEl = $('minSwatches');
    const maxSwEl = $('maxSwatches');
    const assessEl = $('assessment');

    if (contrastSamples.length === 0) {
      minEl.textContent = '—'; maxEl.textContent = '—';
      minAtEl.textContent = ''; maxAtEl.textContent = '';
      minSwEl.innerHTML = ''; maxSwEl.innerHTML = '';
      assessEl.textContent = 'No data'; assessEl.className = 'assessment';
      return;
    }

    const minV = minContrast.value;
    const maxV = maxContrast.value;

    // Format values
    if (chartMetric === 'apca') {
      minEl.textContent = 'Lc ' + minV.toFixed(1);
      maxEl.textContent = 'Lc ' + maxV.toFixed(1);
      minEl.className = 'contrast-value' + (minV >= 75 ? ' good' : minV >= 45 ? ' ok' : ' poor');
      maxEl.className = 'contrast-value' + (maxV >= 75 ? ' good' : maxV >= 45 ? ' ok' : ' poor');
    } else {
      minEl.textContent = minV.toFixed(2) + ':1';
      maxEl.textContent = maxV.toFixed(2) + ':1';
      minEl.className = 'contrast-value' + (minV >= 7 ? ' good' : minV >= 4.5 ? ' ok' : ' poor');
      maxEl.className = 'contrast-value' + (maxV >= 7 ? ' good' : maxV >= 4.5 ? ' ok' : ' poor');
    }

    // "at X = ..." labels
    const varLabel = variableComponent;
    const fmtT = t => variableComponent === 'L' ? t.toFixed(2) :
                       variableComponent === 'C' ? t.toFixed(3) :
                       Math.round(t) + '°';
    minAtEl.textContent = 'at ' + varLabel + ' = ' + fmtT(minContrast.t);
    maxAtEl.textContent = 'at ' + varLabel + ' = ' + fmtT(maxContrast.t);

    // Mini swatches — show text on background to visualize the contrast relationship
    // Uses DOM API to set styles (CSP blocks inline style="" attributes in innerHTML)
    function buildSwatchPair(bL, bC, bH, dL, dC, dH) {
      const br = clampedSrgb(bL, bC, bH);
      const dr = clampedSrgb(dL, dC, dH);
      const bc = 'rgb(' + Math.round(br.r*255) + ',' + Math.round(br.g*255) + ',' + Math.round(br.b*255) + ')';
      const dc = 'rgb(' + Math.round(dr.r*255) + ',' + Math.round(dr.g*255) + ',' + Math.round(dr.b*255) + ')';

      const pair = document.createElement('span');
      pair.className = 'mini-swatch-pair';

      const s1 = document.createElement('span');
      s1.className = 'swatch-bg';
      s1.textContent = 'Ab';
      s1.style.backgroundColor = bc;
      s1.style.color = dc;

      const s2 = document.createElement('span');
      s2.className = 'swatch-bg';
      s2.textContent = 'Ab';
      s2.style.backgroundColor = dc;
      s2.style.color = bc;

      pair.appendChild(s1);
      pair.appendChild(s2);
      return pair;
    }

    minSwEl.textContent = '';
    minSwEl.appendChild(buildSwatchPair(minContrast.baseL, minContrast.baseC, minContrast.baseH, minContrast.dL, minContrast.dC, minContrast.dH));
    maxSwEl.textContent = '';
    maxSwEl.appendChild(buildSwatchPair(maxContrast.baseL, maxContrast.baseC, maxContrast.baseH, maxContrast.dL, maxContrast.dC, maxContrast.dH));

    // Worst-case assessment
    if (chartMetric === 'apca') {
      const desc = apcaDescription(minV);
      if (minV >= 90) {
        assessEl.textContent = '\\u2713 Guaranteed APCA Lc \\u2265 90 (preferred body) across full range';
        assessEl.className = 'assessment pass';
      } else if (minV >= 75) {
        assessEl.textContent = '\\u2713 Guaranteed APCA Lc \\u2265 75 (body 18px+) across full range';
        assessEl.className = 'assessment pass';
      } else if (minV >= 60) {
        assessEl.textContent = '\\u2713 Guaranteed APCA Lc \\u2265 60 (content / bold) — not enough for body text at ' + varLabel + ' = ' + fmtT(minContrast.t);
        assessEl.className = 'assessment warn';
      } else if (minV >= 45) {
        assessEl.textContent = '\\u26A0 Guaranteed APCA Lc \\u2265 45 (headlines) — not enough for body text at ' + varLabel + ' = ' + fmtT(minContrast.t);
        assessEl.className = 'assessment warn';
      } else if (minV >= 30) {
        assessEl.textContent = '\\u26A0 APCA Lc drops to ' + minV.toFixed(0) + ' at ' + varLabel + ' = ' + fmtT(minContrast.t) + ' — spot text only';
        assessEl.className = 'assessment warn';
      } else {
        assessEl.textContent = '\\u2717 Contrast too low at ' + varLabel + ' = ' + fmtT(minContrast.t) + ' (Lc ' + minV.toFixed(0) + ') — not readable';
        assessEl.className = 'assessment fail';
      }
    } else {
      if (minV >= 7) {
        assessEl.textContent = '\\u2713 Guaranteed WCAG AAA (7:1) across full range';
        assessEl.className = 'assessment pass';
      } else if (minV >= 4.5) {
        assessEl.textContent = '\\u2713 Guaranteed WCAG AA (4.5:1) — AAA fails at ' + varLabel + ' = ' + fmtT(minContrast.t);
        assessEl.className = 'assessment pass';
      } else if (minV >= 3) {
        assessEl.textContent = '\\u26A0 WCAG AA fails for normal text at ' + varLabel + ' = ' + fmtT(minContrast.t) + ' — large text only';
        assessEl.className = 'assessment warn';
      } else {
        assessEl.textContent = '\\u2717 WCAG contrast too low at ' + varLabel + ' = ' + fmtT(minContrast.t) + ' (' + minV.toFixed(1) + ':1)';
        assessEl.className = 'assessment fail';
      }
    }
  }

  // --- Full update ---
  function fullUpdate() {
    // Update range wrap note
    if (isHueWrapping()) {
      rangeWrapNote.textContent = '(wraps through 0\\u00B0)';
    } else {
      rangeWrapNote.textContent = '';
    }

    // Redraw hue arc if active
    if (variableComponent === 'H') {
      drawHueArc();
      syncArcInputs();
    }

    // Update midpoint swatch
    let midL, midC, midH;
    const midT = rangeMidpoint();
    if (variableComponent === 'L') { midL = midT; midC = fixedC; midH = fixedH; }
    else if (variableComponent === 'C') { midL = fixedL; midC = midT; midH = fixedH; }
    else { midL = fixedL; midC = fixedC; midH = midT; }
    const midRgb = clampedSrgb(midL, midC, midH);
    midSwatch.style.backgroundColor = 'rgb(' + Math.round(midRgb.r*255) + ',' + Math.round(midRgb.g*255) + ',' + Math.round(midRgb.b*255) + ')';

    // Sweep and compute
    sweepContrast();

    // Draw chart
    drawChart();

    // Update results
    updateResults();

    // Update CSS expression
    cssExprText.textContent = buildCssExpression();
  }

  // --- Copy/Insert ---
  function showCopied(id) {
    const el = $(id);
    el.classList.add('visible');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('visible'), 1000);
  }

  $('copyCssExpr').addEventListener('click', () => {
    navigator.clipboard.writeText(cssExprText.textContent);
    showCopied('copiedCssExpr');
  });

  btnInsertFormula.addEventListener('click', () => {
    vscodeApi.postMessage({ command: 'insertRelative', expression: buildCssExpression() });
  });

  btnCopyFormula.addEventListener('click', () => {
    navigator.clipboard.writeText(buildCssExpression());
  });

  // --- Messages from extension ---
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.command === 'setInitialColor') {
      fixedL = msg.L; fixedC = msg.C; fixedH = msg.H;
      basePropertyName = msg.propertyName || null;
      buildFixedSliders();
      fullUpdate();
    } else if (msg.command === 'cursorContext') {
      // Don't auto-update base — this panel is about ranges
      // Just track for potential future use
    }
  });

  // --- Chart resize ---
  resizeChart();
  new ResizeObserver(() => { resizeChart(); drawChart(); }).observe(canvas);

  // --- Init ---
  buildFixedSliders();
  updateRangeInputs();
  fullUpdate();
</script>
</body>
</html>`;
}

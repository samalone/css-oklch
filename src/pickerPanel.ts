import * as vscode from "vscode";
import * as crypto from "crypto";
import { findOklchAtOffset } from "./oklchParser";

interface OklchColor {
  L: number;
  C: number;
  H: number;
  alpha: number;
}

let currentPanel: vscode.WebviewPanel | undefined;
let lastEditor: vscode.TextEditor | undefined;
let lastCursorOffset: number | undefined;

export function openPickerPanel(
  context: vscode.ExtensionContext,
  initialColor?: OklchColor
): void {
  // Capture the active editor before opening the panel
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    lastEditor = editor;
    lastCursorOffset = editor.document.offsetAt(editor.selection.active);
  }

  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.Beside);
    if (initialColor) {
      currentPanel.webview.postMessage({
        command: "setColor",
        ...initialColor,
      });
    }
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "oklchColorPicker",
    "OKLCH Color Picker",
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
    const match = findOklchAtOffset(text, offset);
    if (match) {
      currentPanel.webview.postMessage({
        command: "cursorContext",
        hasOklch: true,
        L: match.L,
        C: match.C,
        H: match.H,
        alpha: match.alpha,
      });
    } else {
      currentPanel.webview.postMessage({
        command: "cursorContext",
        hasOklch: false,
      });
    }
  }

  // Track the last active text editor (ignoring when the webview takes focus)
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((e) => {
      if (e) {
        lastEditor = e;
        lastCursorOffset = e.document.offsetAt(e.selection.active);
        notifyCursorContext();
      }
    })
  );

  // Track cursor movements in the editor
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
  panel.webview.html = getWebviewHtml(nonce, initialColor);

  panel.webview.onDidReceiveMessage(
    (message) => {
      if (!lastEditor) {
        vscode.window.showWarningMessage("No active text editor.");
        return;
      }
      const editor = lastEditor;

      const { L, C, H, alpha } = message;
      const oklchStr = formatOklch(L, C, H, alpha);

      switch (message.command) {
        case "apply": {
          const doc = editor.document;
          const text = doc.getText();
          const offset = lastCursorOffset ?? doc.offsetAt(editor.selection.active);
          // Find oklch() at or near cursor
          const regex = /oklch\(\s*[^)]*\s*\)/gi;
          let match: RegExpExecArray | null;
          let bestMatch: { start: number; end: number } | null = null;
          regex.lastIndex = 0;
          while ((match = regex.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (offset >= start && offset <= end) {
              bestMatch = { start, end };
              break;
            }
          }
          if (bestMatch) {
            const range = new vscode.Range(
              doc.positionAt(bestMatch.start),
              doc.positionAt(bestMatch.end)
            );
            editor.edit((editBuilder) => {
              editBuilder.replace(range, oklchStr);
            });
          } else {
            vscode.window.showWarningMessage(
              "No oklch() value found at cursor position. Use 'Insert' instead."
            );
          }
          break;
        }
        case "insert": {
          editor.edit((editBuilder) => {
            editBuilder.insert(editor.selection.active, oklchStr);
          });
          break;
        }
      }
    },
    undefined,
    context.subscriptions
  );
}

function formatOklch(
  L: number,
  C: number,
  H: number,
  alpha: number
): string {
  const lStr = parseFloat(L.toFixed(4));
  const cStr = parseFloat(C.toFixed(4));
  const hStr = parseFloat(H.toFixed(2));
  if (alpha < 1) {
    const aStr = parseFloat(alpha.toFixed(2));
    return `oklch(${lStr} ${cStr} ${hStr} / ${aStr})`;
  }
  return `oklch(${lStr} ${cStr} ${hStr})`;
}

function getWebviewHtml(nonce: string, initialColor?: OklchColor): string {
  const L = initialColor?.L ?? 0.7;
  const C = initialColor?.C ?? 0.15;
  const H = initialColor?.H ?? 180;
  const alpha = initialColor?.alpha ?? 1;

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
    .canvas-wrap {
      position: relative;
      margin-bottom: 12px;
    }
    #colorPlane {
      width: 100%;
      height: 200px;
      cursor: crosshair;
      border: 1px solid var(--vscode-panel-border, #444);
      border-radius: 3px;
      display: block;
    }
    .info-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
    }
    .swatch-wrap {
      width: 60px;
      height: 60px;
      border-radius: 4px;
      flex-shrink: 0;
      position: relative;
      overflow: hidden;
      background-image:
        linear-gradient(45deg, #808080 25%, transparent 25%),
        linear-gradient(-45deg, #808080 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #808080 75%),
        linear-gradient(-45deg, transparent 75%, #808080 75%);
      background-size: 12px 12px;
      background-position: 0 0, 0 6px, 6px -6px, -6px 0;
    }
    #swatch {
      position: absolute;
      inset: 0;
    }
    .swatch-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    #btnEyedropper {
      display: none;
      align-items: center;
      justify-content: center;
      background: none;
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 3px;
      padding: 3px;
      cursor: pointer;
      color: var(--vscode-editor-foreground);
      opacity: 0.6;
    }
    #btnEyedropper:hover {
      opacity: 1;
      background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    }
    .info-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .copy-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      padding: 2px 4px;
      border-radius: 3px;
      cursor: pointer;
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 13px;
    }
    .copy-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    }
    .copy-btn svg {
      opacity: 0.5;
      flex-shrink: 0;
    }
    .copy-btn:hover svg {
      opacity: 1;
    }
    #gamutWarning {
      color: var(--vscode-editorWarning-foreground, #cca700);
      font-size: 12px;
      display: none;
    }
    .copied-msg {
      color: var(--vscode-editorWarning-foreground, #cca700);
      font-size: 12px;
      margin-left: 4px;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .copied-msg.visible {
      opacity: 1;
    }
    .slider-group {
      margin-bottom: 8px;
    }
    .slider-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .slider-label {
      width: 90px;
      font-size: 12px;
      flex-shrink: 0;
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
      width: 72px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 2px;
      padding: 2px 4px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
    }
    .buttons {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 14px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 13px;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    button:disabled {
      opacity: 0.4;
      cursor: default;
    }
  </style>
</head>
<body>
  <div class="canvas-wrap">
    <canvas id="colorPlane"></canvas>
  </div>

  <div class="info-row">
    <div class="swatch-col">
      <div class="swatch-wrap"><div id="swatch"></div></div>
      <button id="btnEyedropper" title="Pick color from screen"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.4 1.6a2.1 2.1 0 0 0-3 0l-1.7 1.7-.5-.5a.5.5 0 0 0-.7 0l-.4.4a.5.5 0 0 0 0 .7l.2.2-5.1 5.1a1.5 1.5 0 0 0-.4.8l-.3 2a.5.5 0 0 0 .5.6h.1l2-.3a1.5 1.5 0 0 0 .8-.4l5.1-5.1.2.2a.5.5 0 0 0 .7 0l.4-.4a.5.5 0 0 0 0-.7l-.5-.5 1.7-1.7a2.1 2.1 0 0 0 0-3zM4.7 11.3a.5.5 0 0 1-.3.1l-1.3.2.2-1.3a.5.5 0 0 1 .1-.3L8.5 5l1.5 1.5-5.3 4.8zm7.3-7.3L10.6 5.4 9.1 3.9 10.4 2.6a1.1 1.1 0 0 1 1.6 0 1.1 1.1 0 0 1 0 1.6z"/></svg></button>
    </div>
    <div class="info-text">
      <button class="copy-btn" id="copyOklch" title="Copy oklch value"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4h1V2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h1zm1 0h4a1 1 0 0 1 1 1v5h1V2H6v2zm-2 1v8h6V5H3z"/></svg><span id="oklchValue"></span><span class="copied-msg" id="copiedOklch">Copied!</span></button>
      <button class="copy-btn" id="copyHex" title="Copy hex value"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4h1V2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h1zm1 0h4a1 1 0 0 1 1 1v5h1V2H6v2zm-2 1v8h6V5H3z"/></svg><span id="hexValue"></span><span class="copied-msg" id="copiedHex">Copied!</span></button>
      <div id="gamutWarning">&#9888; Outside sRGB gamut (clamped)</div>
    </div>
  </div>

  <div class="slider-group">
    <div class="slider-row">
      <span class="slider-label">L (Lightness)</span>
      <input type="range" id="sliderL" min="0" max="1" step="0.001">
      <input type="number" id="numL" min="0" max="1" step="0.001">
    </div>
    <div class="slider-row">
      <span class="slider-label">C (Chroma)</span>
      <input type="range" id="sliderC" min="0" max="0.4" step="0.001">
      <input type="number" id="numC" min="0" max="0.5" step="0.001">
    </div>
    <div class="slider-row">
      <span class="slider-label">H (Hue)</span>
      <input type="range" id="sliderH" min="0" max="360" step="0.5">
      <input type="number" id="numH" min="0" max="360" step="0.5">
    </div>
    <div class="slider-row">
      <span class="slider-label">A (Alpha)</span>
      <input type="range" id="sliderA" min="0" max="1" step="0.01">
      <input type="number" id="numA" min="0" max="1" step="0.01">
    </div>
  </div>

  <div class="buttons">
    <button id="btnApply">Apply</button>
    <button id="btnInsert" class="secondary">Insert New</button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // --- Color conversion (inline copy for real-time preview) ---
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
    function isInGamut(r, g, b) {
      return r >= -0.001 && r <= 1.001 && g >= -0.001 && g <= 1.001 && b >= -0.001 && b <= 1.001;
    }
    function srgbToLinear(x) {
      if (x <= 0.04045) return x / 12.92;
      return Math.pow((x + 0.055) / 1.055, 2.4);
    }
    function srgbToOklch(r, g, b) {
      const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
      const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
      const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
      const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
      const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
      const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
      const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
      const bv = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
      const C = Math.sqrt(a * a + bv * bv);
      let H = Math.atan2(bv, a) * 180 / Math.PI;
      if (H < 0) H += 360;
      return { L, C, H };
    }

    // --- State ---
    let curL = ${L}, curC = ${C}, curH = ${H}, curA = ${alpha};

    // --- DOM refs ---
    const sliderL = document.getElementById('sliderL');
    const sliderC = document.getElementById('sliderC');
    const sliderH = document.getElementById('sliderH');
    const sliderA = document.getElementById('sliderA');
    const numL = document.getElementById('numL');
    const numC = document.getElementById('numC');
    const numH = document.getElementById('numH');
    const numA = document.getElementById('numA');
    const swatch = document.getElementById('swatch');
    const oklchValue = document.getElementById('oklchValue');
    const hexValue = document.getElementById('hexValue');
    const gamutWarning = document.getElementById('gamutWarning');
    const canvas = document.getElementById('colorPlane');
    const ctx = canvas.getContext('2d');

    // --- Canvas rendering ---
    let canvasWidth = 360;
    let canvasHeight = 200;
    const MAX_CHROMA = 0.4;

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      canvasWidth = Math.floor(rect.width);
      canvasHeight = Math.floor(rect.height);
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }

    function drawColorPlane() {
      const imgData = ctx.createImageData(canvasWidth, canvasHeight);
      const data = imgData.data;
      for (let y = 0; y < canvasHeight; y++) {
        const chroma = MAX_CHROMA * (1 - y / (canvasHeight - 1));
        for (let x = 0; x < canvasWidth; x++) {
          const hue = (x / (canvasWidth - 1)) * 360;
          const { r, g, b } = oklchToSrgb(curL, chroma, hue);
          const inGamut = isInGamut(r, g, b);
          const idx = (y * canvasWidth + x) * 4;
          if (inGamut) {
            data[idx]     = Math.round(clamp01(r) * 255);
            data[idx + 1] = Math.round(clamp01(g) * 255);
            data[idx + 2] = Math.round(clamp01(b) * 255);
          } else {
            // Dim out-of-gamut pixels
            data[idx]     = Math.round(clamp01(r) * 255 * 0.3);
            data[idx + 1] = Math.round(clamp01(g) * 255 * 0.3);
            data[idx + 2] = Math.round(clamp01(b) * 255 * 0.3);
          }
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      drawCrosshair();
    }

    function drawCrosshair() {
      const x = (curH / 360) * (canvasWidth - 1);
      const y = (1 - curC / MAX_CHROMA) * (canvasHeight - 1);
      ctx.save();
      ctx.strokeStyle = curL > 0.5 ? '#000' : '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 10, y); ctx.lineTo(x - 3, y);
      ctx.moveTo(x + 3, y); ctx.lineTo(x + 10, y);
      ctx.moveTo(x, y - 10); ctx.lineTo(x, y - 3);
      ctx.moveTo(x, y + 3); ctx.lineTo(x, y + 10);
      ctx.stroke();
      ctx.restore();
    }

    // --- Canvas interaction ---
    let isDragging = false;

    function canvasPick(e) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      curH = Math.max(0, Math.min(360, (x / (canvasWidth - 1)) * 360));
      curC = Math.max(0, Math.min(MAX_CHROMA, MAX_CHROMA * (1 - y / (canvasHeight - 1))));
      syncFromState();
    }

    canvas.addEventListener('mousedown', (e) => { isDragging = true; canvasPick(e); });
    canvas.addEventListener('mousemove', (e) => { if (isDragging) canvasPick(e); });
    window.addEventListener('mouseup', () => { isDragging = false; });

    // --- Sync UI ---
    function syncFromState() {
      sliderL.value = curL;
      sliderC.value = curC;
      sliderH.value = curH;
      sliderA.value = curA;
      numL.value = curL.toFixed(4);
      numC.value = curC.toFixed(4);
      numH.value = curH.toFixed(2);
      numA.value = curA.toFixed(2);
      updatePreview();
      drawColorPlane();
    }

    function updatePreview() {
      const { r, g, b } = oklchToSrgb(curL, curC, curH);
      const inGamut = isInGamut(r, g, b);
      const cr = clamp01(r), cg = clamp01(g), cb = clamp01(b);
      const hex = toHex(cr, cg, cb);
      const r8 = Math.round(cr * 255), g8 = Math.round(cg * 255), b8 = Math.round(cb * 255);
      swatch.style.backgroundColor = 'rgba(' + r8 + ',' + g8 + ',' + b8 + ',' + curA + ')';
      if (curA < 1) {
        const a8 = Math.round(curA * 255).toString(16).padStart(2, '0');
        hexValue.textContent = hex + a8;
      } else {
        hexValue.textContent = hex;
      }
      gamutWarning.style.display = inGamut ? 'none' : 'block';

      const lStr = parseFloat(curL.toFixed(4));
      const cStr = parseFloat(curC.toFixed(4));
      const hStr = parseFloat(curH.toFixed(2));
      if (curA < 1) {
        const aStr = parseFloat(curA.toFixed(2));
        oklchValue.textContent = 'oklch(' + lStr + ' ' + cStr + ' ' + hStr + ' / ' + aStr + ')';
      } else {
        oklchValue.textContent = 'oklch(' + lStr + ' ' + cStr + ' ' + hStr + ')';
      }
    }

    // --- Slider/number input events ---
    function onSliderInput(slider, num, setter) {
      slider.addEventListener('input', () => { setter(parseFloat(slider.value)); syncFromState(); });
      num.addEventListener('input', () => { const v = parseFloat(num.value); if (!isNaN(v)) { setter(v); syncFromState(); } });
    }
    onSliderInput(sliderL, numL, v => { curL = v; });
    onSliderInput(sliderC, numC, v => { curC = v; });
    onSliderInput(sliderH, numH, v => { curH = v; });
    onSliderInput(sliderA, numA, v => { curA = v; });

    // Redraw canvas only when L changes (other changes just move crosshair)
    sliderL.addEventListener('input', () => drawColorPlane());
    numL.addEventListener('input', () => drawColorPlane());

    // --- Buttons (declared early for arrow key navigation) ---
    const btnApply = document.getElementById('btnApply');
    const btnInsert = document.getElementById('btnInsert');
    btnApply.disabled = ${initialColor ? "false" : "true"};
    btnApply.addEventListener('click', () => {
      if (!btnApply.disabled) {
        vscode.postMessage({ command: 'apply', L: curL, C: curC, H: curH, alpha: curA });
      }
    });
    btnInsert.addEventListener('click', () => {
      vscode.postMessage({ command: 'insert', L: curL, C: curC, H: curH, alpha: curA });
    });

    // --- Arrow key navigation between sliders and buttons ---
    const sliders = [sliderL, sliderC, sliderH, sliderA];
    const actionBtns = [btnApply, btnInsert];

    sliders.forEach((slider, i) => {
      slider.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (i < sliders.length - 1) {
            sliders[i + 1].focus();
          } else {
            btnApply.focus();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (i > 0) {
            sliders[i - 1].focus();
          }
        }
      });
    });

    actionBtns.forEach((btn, i) => {
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          sliders[sliders.length - 1].focus();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          actionBtns[(i + 1) % actionBtns.length].focus();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          actionBtns[(i - 1 + actionBtns.length) % actionBtns.length].focus();
        }
      });
    });

    // --- Copy buttons ---
    function showCopied(id) {
      const el = document.getElementById(id);
      el.classList.add('visible');
      clearTimeout(el._timer);
      el._timer = setTimeout(() => el.classList.remove('visible'), 1000);
    }
    document.getElementById('copyOklch').addEventListener('click', () => {
      navigator.clipboard.writeText(oklchValue.textContent);
      showCopied('copiedOklch');
    });
    document.getElementById('copyHex').addEventListener('click', () => {
      navigator.clipboard.writeText(hexValue.textContent);
      showCopied('copiedHex');
    });

    // --- Eyedropper ---
    const btnEyedropper = document.getElementById('btnEyedropper');
    if (typeof EyeDropper !== 'undefined') {
      btnEyedropper.style.display = 'flex';
      btnEyedropper.addEventListener('click', async () => {
        try {
          const dropper = new EyeDropper();
          const result = await dropper.open();
          const hex = result.sRGBHex;
          const r = parseInt(hex.slice(1, 3), 16) / 255;
          const g = parseInt(hex.slice(3, 5), 16) / 255;
          const b = parseInt(hex.slice(5, 7), 16) / 255;
          const oklch = srgbToOklch(r, g, b);
          curL = oklch.L; curC = oklch.C; curH = oklch.H; curA = 1;
          syncFromState();
        } catch (e) {
          // User cancelled the eyedropper
        }
      });
    }

    // --- Messages from extension ---
    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (msg.command === 'setColor') {
        curL = msg.L; curC = msg.C; curH = msg.H; curA = msg.alpha;
        syncFromState();
      } else if (msg.command === 'cursorContext') {
        btnApply.disabled = !msg.hasOklch;
        if (msg.hasOklch) {
          curL = msg.L; curC = msg.C; curH = msg.H; curA = msg.alpha;
          syncFromState();
        }
      }
    });

    // --- Init ---
    resizeCanvas();
    syncFromState();

    // Handle resize
    new ResizeObserver(() => { resizeCanvas(); drawColorPlane(); }).observe(canvas);
  </script>
</body>
</html>`;
}

import * as vscode from "vscode";
import {
  OklchColor,
  createPanel,
  applyColorAtCursor,
  insertColorAtCursor,
} from "./panelBase";
import { getFormatOptions } from "./formatOklch";
import {
  WEBVIEW_COLOR_CORE,
  WEBVIEW_GAMUT_CHECK,
  WEBVIEW_SRGB_TO_OKLCH,
  webviewFormatScript,
} from "./webviewScripts";
import { CSS_BASE, cssSliders } from "./webviewStyles";

export function openPickerPanel(
  context: vscode.ExtensionContext,
  initialColor?: OklchColor
): void {
  createPanel(
    {
      viewType: "oklchColorPicker",
      title: "OKLCH Color Picker",
      initialMessageCommand: "setColor",
      cursorContextMode: "full",
      getHtml: (nonce, color) => getWebviewHtml(nonce, color),
      handleMessage: (message, editor, lastCursorOffset) => {
        const { L, C, H, alpha } = message;
        switch (message.command) {
          case "apply":
            applyColorAtCursor(editor, lastCursorOffset, L, C, H, alpha);
            break;
          case "insert":
            insertColorAtCursor(editor, L, C, H, alpha);
            break;
        }
      },
    },
    context,
    initialColor
  );
}

function getWebviewHtml(nonce: string, initialColor?: OklchColor): string {
  const L = initialColor?.L ?? 0.7;
  const C = initialColor?.C ?? 0.15;
  const H = initialColor?.H ?? 180;
  const alpha = initialColor?.alpha ?? 1;
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
    ${cssSliders({ numberWidth: "72px", fontSize: "12px", gap: "6px 8px" })}
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
    <div class="sliders-grid">
      <span class="slider-label">L (Lightness)</span>
      <input type="range" id="sliderL" min="0" max="1" step="0.001">
      <input type="number" id="numL" min="0" max="${fmtOpts.lightnessFormat === "percentage" ? "100" : "1"}" step="${fmtOpts.lightnessFormat === "percentage" ? "0.1" : "0.001"}">
      <span class="slider-unit">${fmtOpts.lightnessFormat === "percentage" ? "%" : ""}</span>

      <span class="slider-label">C (Chroma)</span>
      <input type="range" id="sliderC" min="0" max="0.4" step="0.001">
      <input type="number" id="numC" min="0" max="${fmtOpts.chromaFormat === "percentage" ? "125" : "0.5"}" step="${fmtOpts.chromaFormat === "percentage" ? "0.1" : "0.001"}">
      <span class="slider-unit">${fmtOpts.chromaFormat === "percentage" ? "%" : ""}</span>

      <span class="slider-label">H (Hue)</span>
      <input type="range" id="sliderH" min="0" max="360" step="0.5">
      <input type="number" id="numH" min="0" max="360" step="0.5">
      <span class="slider-unit">${fmtOpts.hueFormat === "deg" ? "deg" : ""}</span>

      <span class="slider-label">A (Alpha)</span>
      <input type="range" id="sliderA" min="0" max="1" step="0.01">
      <input type="number" id="numA" min="0" max="${fmtOpts.alphaFormat === "percentage" ? "100" : "1"}" step="${fmtOpts.alphaFormat === "percentage" ? "1" : "0.01"}">
      <span class="slider-unit">${fmtOpts.alphaFormat === "percentage" ? "%" : ""}</span>
    </div>
  </div>

  <div class="buttons">
    <button id="btnApply">Apply</button>
    <button id="btnInsert" class="secondary">Insert New</button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // --- Color conversion (inline for real-time preview) ---
    ${WEBVIEW_COLOR_CORE}
    ${WEBVIEW_GAMUT_CHECK}
    ${WEBVIEW_SRGB_TO_OKLCH}
    ${webviewFormatScript(fmtOpts)}

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
      numL.value = fmtLightness === 'percentage'
        ? parseFloat((curL * 100).toFixed(2))
        : parseFloat(curL.toFixed(4));
      numC.value = fmtChroma === 'percentage'
        ? parseFloat((curC / 0.4 * 100).toFixed(2))
        : parseFloat(curC.toFixed(4));
      numH.value = parseFloat(curH.toFixed(2));
      numA.value = fmtAlpha === 'percentage'
        ? parseFloat((curA * 100).toFixed(0))
        : parseFloat(curA.toFixed(2));
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
      oklchValue.textContent = formatOklchValue(curL, curC, curH, curA);
    }

    // --- Slider/number input events ---
    // Sliders always use internal values; number inputs use display values
    function onSliderInput(slider, num, setter, numToInternal) {
      slider.addEventListener('input', () => { setter(parseFloat(slider.value)); syncFromState(); });
      num.addEventListener('input', () => {
        const v = parseFloat(num.value);
        if (!isNaN(v)) { setter(numToInternal ? numToInternal(v) : v); syncFromState(); }
      });
    }
    onSliderInput(sliderL, numL, v => { curL = v; },
      fmtLightness === 'percentage' ? v => v / 100 : null);
    onSliderInput(sliderC, numC, v => { curC = v; },
      fmtChroma === 'percentage' ? v => v / 100 * 0.4 : null);
    onSliderInput(sliderH, numH, v => { curH = v; }, null);
    onSliderInput(sliderA, numA, v => { curA = v; },
      fmtAlpha === 'percentage' ? v => v / 100 : null);

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
        btnApply.disabled = !msg.hasCssColor;
        if (msg.hasCssColor) {
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

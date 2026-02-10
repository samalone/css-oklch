/**
 * Shared CSS strings for webview interpolation.
 *
 * These are string constants containing CSS rules that get interpolated
 * into webview <style> tags. Each panel uses a subset of these.
 */

/**
 * Base CSS reset, body, h3, and section layout. Used by all 3 panels.
 */
export const CSS_BASE = `
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
    }`;

/**
 * Slider grid layout. Used by all 3 panels with slightly different parameters.
 *
 * Defaults match contrast/formula panels. Picker overrides numberWidth, fontSize, gap.
 */
export function cssSliders(opts?: {
  numberWidth?: string;
  fontSize?: string;
  gap?: string;
}): string {
  const numberWidth = opts?.numberWidth ?? "62px";
  const fontSize = opts?.fontSize ?? "11px";
  const gap = opts?.gap ?? "6px 6px";
  return `
    .sliders-grid {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      grid-auto-rows: minmax(24px, auto);
      gap: ${gap};
      align-items: center;
    }
    .slider-label {
      font-size: ${fontSize};
      font-weight: 600;
      opacity: 0.7;
      white-space: nowrap;
    }
    .sliders-grid input[type="range"] {
      width: 100%;
      min-width: 0;
    }
    .sliders-grid input[type="range"]:focus {
      outline: 2px solid var(--vscode-input-background);
      outline-offset: 2px;
    }
    .sliders-grid input[type="number"] {
      width: ${numberWidth};
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 2px;
      padding: 1px 3px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: ${fontSize};
    }
    .slider-unit {
      font-size: ${fontSize};
      opacity: 0.6;
    }`;
}

/**
 * Copy button + copied message CSS. Used by contrast + formula panels.
 * (Picker has a slightly different version with different padding/font-size.)
 */
export const CSS_COPY_BUTTON = `
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
    .copied-msg.visible { opacity: 1; }`;

/**
 * Transform controls, presets, target Lc, and CSS expression styles.
 * Used by contrast + formula panels.
 */
export const CSS_TRANSFORM_CONTROLS = `
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

    /* Target Lc selector */
    .target-lc-row {
      display: none;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }
    .target-lc-row.visible { display: flex; }
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

    /* CSS expression */
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
    .css-expr-text { flex: 1; }`;

/**
 * Action button styles. Used by contrast + formula panels.
 * (Picker has different button styling without .action class.)
 */
export const CSS_ACTION_BUTTONS = `
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
    }`;

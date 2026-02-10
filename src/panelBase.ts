import * as vscode from "vscode";
import * as crypto from "crypto";
import { findCssColorAtOffset, findPropertyContext } from "./cssColorParser";
import { formatOklch } from "./formatOklch";

export interface OklchColor {
  L: number;
  C: number;
  H: number;
  alpha: number;
  propertyName?: string;
}

export interface PanelConfig {
  viewType: string;
  title: string;
  initialMessageCommand: string;
  cursorContextMode: "full" | "boolean";
  getHtml: (nonce: string, initialColor?: OklchColor) => string;
  handleMessage: (
    message: any,
    editor: vscode.TextEditor,
    lastCursorOffset: number | undefined
  ) => void;
}

interface PanelState {
  currentPanel: vscode.WebviewPanel | undefined;
  lastEditor: vscode.TextEditor | undefined;
  lastCursorOffset: number | undefined;
}

const panelStates = new Map<string, PanelState>();

function getState(viewType: string): PanelState {
  if (!panelStates.has(viewType)) {
    panelStates.set(viewType, {
      currentPanel: undefined,
      lastEditor: undefined,
      lastCursorOffset: undefined,
    });
  }
  return panelStates.get(viewType)!;
}

export function createPanel(
  config: PanelConfig,
  context: vscode.ExtensionContext,
  initialColor?: OklchColor
): void {
  const state = getState(config.viewType);

  // Capture the active editor before opening the panel
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    state.lastEditor = editor;
    state.lastCursorOffset = editor.document.offsetAt(editor.selection.active);
  }

  if (state.currentPanel) {
    state.currentPanel.reveal(vscode.ViewColumn.Beside);
    if (initialColor) {
      state.currentPanel.webview.postMessage({
        command: config.initialMessageCommand,
        ...initialColor,
      });
    }
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    config.viewType,
    config.title,
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: true, retainContextWhenHidden: true }
  );

  state.currentPanel = panel;

  function notifyCursorContext(): void {
    if (!state.currentPanel || !state.lastEditor) {
      return;
    }
    const text = state.lastEditor.document.getText();
    const offset = state.lastCursorOffset ?? 0;
    const match = findCssColorAtOffset(text, offset);
    if (config.cursorContextMode === "full") {
      if (match) {
        const propertyName = findPropertyContext(text, match.startOffset);
        state.currentPanel.webview.postMessage({
          command: "cursorContext",
          hasCssColor: true,
          L: match.L,
          C: match.C,
          H: match.H,
          alpha: match.alpha,
          propertyName,
        });
      } else {
        state.currentPanel.webview.postMessage({
          command: "cursorContext",
          hasCssColor: false,
        });
      }
    } else {
      state.currentPanel.webview.postMessage({
        command: "cursorContext",
        hasCssColor: !!match,
      });
    }
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((e) => {
      if (e) {
        state.lastEditor = e;
        state.lastCursorOffset = e.document.offsetAt(e.selection.active);
        notifyCursorContext();
      }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((e) => {
      state.lastEditor = e.textEditor;
      state.lastCursorOffset = e.textEditor.document.offsetAt(
        e.selections[0].active
      );
      notifyCursorContext();
    })
  );

  panel.onDidDispose(() => {
    state.currentPanel = undefined;
  });

  const nonce = crypto.randomBytes(16).toString("base64");
  panel.webview.html = config.getHtml(nonce, initialColor);

  panel.webview.onDidReceiveMessage(
    (message) => {
      if (!state.lastEditor) {
        vscode.window.showWarningMessage("No active text editor.");
        return;
      }
      config.handleMessage(message, state.lastEditor, state.lastCursorOffset);
    },
    undefined,
    context.subscriptions
  );
}

/** Replace the CSS color at the cursor with a formatted oklch() value. */
export function applyColorAtCursor(
  editor: vscode.TextEditor,
  lastCursorOffset: number | undefined,
  L: number,
  C: number,
  H: number,
  alpha: number
): void {
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
}

/** Insert a formatted oklch() value at the cursor. */
export function insertColorAtCursor(
  editor: vscode.TextEditor,
  L: number,
  C: number,
  H: number,
  alpha: number
): void {
  const oklchStr = formatOklch(L, C, H, alpha);
  editor.edit((editBuilder) => {
    editBuilder.insert(editor.selection.active, oklchStr);
  });
}

/** Insert an arbitrary expression at the cursor. */
export function insertExpressionAtCursor(
  editor: vscode.TextEditor,
  expression: string
): void {
  editor.edit((editBuilder) => {
    editBuilder.insert(editor.selection.active, expression);
  });
}

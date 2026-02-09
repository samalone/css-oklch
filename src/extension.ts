import * as vscode from "vscode";
import { OklchColorProvider } from "./colorProvider";
import { findCssColorAtOffset, findAllCssColors } from "./cssColorParser";
import { formatOklch } from "./formatOklch";
import { openPickerPanel } from "./pickerPanel";
import { openContrastPanel } from "./contrastPanel";
import { openFormulaPanel } from "./formulaPanel";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new OklchColorProvider();
  context.subscriptions.push(
    vscode.languages.registerColorProvider(
      [{ language: "css" }, { language: "scss" }, { language: "less" }],
      provider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cssOklch.openColorPicker", () => {
      const editor = vscode.window.activeTextEditor;
      let initialColor: { L: number; C: number; H: number; alpha: number } | undefined;

      if (editor) {
        const text = editor.document.getText();
        const offset = editor.document.offsetAt(editor.selection.active);
        const match = findCssColorAtOffset(text, offset);
        if (match) {
          initialColor = {
            L: match.L,
            C: match.C,
            H: match.H,
            alpha: match.alpha,
          };
        }
      }

      openPickerPanel(context, initialColor);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cssOklch.openContrastPanel", () => {
      const editor = vscode.window.activeTextEditor;
      let initialColor: { L: number; C: number; H: number; alpha: number } | undefined;

      if (editor) {
        const text = editor.document.getText();
        const offset = editor.document.offsetAt(editor.selection.active);
        const match = findCssColorAtOffset(text, offset);
        if (match) {
          initialColor = {
            L: match.L,
            C: match.C,
            H: match.H,
            alpha: match.alpha,
          };
        }
      }

      openContrastPanel(context, initialColor);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cssOklch.openFormulaPanel", () => {
      const editor = vscode.window.activeTextEditor;
      let initialColor: { L: number; C: number; H: number; alpha: number } | undefined;

      if (editor) {
        const text = editor.document.getText();
        const offset = editor.document.offsetAt(editor.selection.active);
        const match = findCssColorAtOffset(text, offset);
        if (match) {
          initialColor = {
            L: match.L,
            C: match.C,
            H: match.H,
            alpha: match.alpha,
          };
        }
      }

      openFormulaPanel(context, initialColor);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cssOklch.convertSelection", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active text editor.");
        return;
      }
      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage("No text selected.");
        return;
      }

      const selectedText = editor.document.getText(selection);
      const selectionStartOffset = editor.document.offsetAt(selection.start);
      const matches = findAllCssColors(selectedText);
      if (matches.length === 0) {
        vscode.window.showInformationMessage("No CSS colors found in selection.");
        return;
      }

      editor.edit((editBuilder) => {
        // Replace from end to start to preserve offsets
        for (let i = matches.length - 1; i >= 0; i--) {
          const m = matches[i];
          const range = new vscode.Range(
            editor.document.positionAt(selectionStartOffset + m.startOffset),
            editor.document.positionAt(selectionStartOffset + m.endOffset)
          );
          editBuilder.replace(range, formatOklch(m.L, m.C, m.H, m.alpha));
        }
      });

      const converted = matches.filter((m) => m.originalFormat !== "oklch").length;
      const reformatted = matches.length - converted;
      const parts: string[] = [];
      if (converted > 0) {
        parts.push(`Converted ${converted}`);
      }
      if (reformatted > 0) {
        parts.push(`${converted > 0 ? "reformatted" : "Reformatted"} ${reformatted}`);
      }
      vscode.window.showInformationMessage(
        `${parts.join(", ")} color${matches.length === 1 ? "" : "s"} to oklch.`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cssOklch.convertDocument", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active text editor.");
        return;
      }

      const text = editor.document.getText();
      const matches = findAllCssColors(text);
      if (matches.length === 0) {
        vscode.window.showInformationMessage("No CSS colors to convert in this document.");
        return;
      }

      editor.edit((editBuilder) => {
        for (let i = matches.length - 1; i >= 0; i--) {
          const m = matches[i];
          const range = new vscode.Range(
            editor.document.positionAt(m.startOffset),
            editor.document.positionAt(m.endOffset)
          );
          editBuilder.replace(range, formatOklch(m.L, m.C, m.H, m.alpha));
        }
      });

      const converted = matches.filter((m) => m.originalFormat !== "oklch").length;
      const reformatted = matches.length - converted;
      const parts: string[] = [];
      if (converted > 0) {
        parts.push(`Converted ${converted}`);
      }
      if (reformatted > 0) {
        parts.push(`${converted > 0 ? "reformatted" : "Reformatted"} ${reformatted}`);
      }
      vscode.window.showInformationMessage(
        `${parts.join(", ")} color${matches.length === 1 ? "" : "s"} to oklch.`
      );
    })
  );
}

export function deactivate(): void {}

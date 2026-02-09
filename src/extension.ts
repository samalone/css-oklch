import * as vscode from "vscode";
import { OklchColorProvider } from "./colorProvider";
import { findCssColorAtOffset } from "./cssColorParser";
import { openPickerPanel } from "./pickerPanel";

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
}

export function deactivate(): void {}

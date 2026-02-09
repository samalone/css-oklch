import * as vscode from "vscode";
import { findOklchColors } from "./oklchParser";
import { oklchToSrgb, srgbToOklch } from "./colorConversion";

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max);
}

export class OklchColorProvider implements vscode.DocumentColorProvider {
  provideDocumentColors(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.ColorInformation[] {
    const text = document.getText();
    const matches = findOklchColors(text);
    const results: vscode.ColorInformation[] = [];

    for (const m of matches) {
      const { r, g, b } = oklchToSrgb(m.L, m.C, m.H);
      const range = new vscode.Range(
        document.positionAt(m.startOffset),
        document.positionAt(m.endOffset)
      );
      const color = new vscode.Color(
        clamp(r, 0, 1),
        clamp(g, 0, 1),
        clamp(b, 0, 1),
        m.alpha
      );
      results.push(new vscode.ColorInformation(range, color));
    }

    return results;
  }

  provideColorPresentations(
    color: vscode.Color,
    _context: { document: vscode.TextDocument; range: vscode.Range },
    _token: vscode.CancellationToken
  ): vscode.ColorPresentation[] {
    const { L, C, H } = srgbToOklch(color.red, color.green, color.blue);

    // Round to sensible precision
    const lStr = roundTo(L, 4);
    const cStr = roundTo(C, 4);
    const hStr = roundTo(H, 2);

    let label: string;
    if (color.alpha < 1) {
      const aStr = roundTo(color.alpha, 2);
      label = `oklch(${lStr} ${cStr} ${hStr} / ${aStr})`;
    } else {
      label = `oklch(${lStr} ${cStr} ${hStr})`;
    }

    return [new vscode.ColorPresentation(label)];
  }
}

function roundTo(value: number, decimals: number): string {
  const rounded = parseFloat(value.toFixed(decimals));
  return String(rounded);
}

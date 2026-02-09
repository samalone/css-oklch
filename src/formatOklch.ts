import * as vscode from "vscode";

export interface OklchFormatOptions {
  lightnessFormat: "number" | "percentage";
  chromaFormat: "number" | "percentage";
  hueFormat: "number" | "deg";
  alphaFormat: "number" | "percentage";
}

export function getFormatOptions(): OklchFormatOptions {
  const config = vscode.workspace.getConfiguration("cssOklch");
  return {
    lightnessFormat: config.get<"number" | "percentage">("lightnessFormat", "number"),
    chromaFormat: config.get<"number" | "percentage">("chromaFormat", "number"),
    hueFormat: config.get<"number" | "deg">("hueFormat", "number"),
    alphaFormat: config.get<"number" | "percentage">("alphaFormat", "number"),
  };
}

export function formatOklch(
  L: number,
  C: number,
  H: number,
  alpha: number
): string {
  const opts = getFormatOptions();
  return formatOklchWithOptions(L, C, H, alpha, opts);
}

export function formatOklchWithOptions(
  L: number,
  C: number,
  H: number,
  alpha: number,
  opts: OklchFormatOptions
): string {
  const lStr =
    opts.lightnessFormat === "percentage"
      ? `${parseFloat((L * 100).toFixed(2))}%`
      : `${parseFloat(L.toFixed(4))}`;

  const cStr =
    opts.chromaFormat === "percentage"
      ? `${parseFloat(((C / 0.4) * 100).toFixed(2))}%`
      : `${parseFloat(C.toFixed(4))}`;

  const hStr =
    opts.hueFormat === "deg"
      ? `${parseFloat(H.toFixed(2))}deg`
      : `${parseFloat(H.toFixed(2))}`;

  if (alpha < 1) {
    const aStr =
      opts.alphaFormat === "percentage"
        ? `${parseFloat((alpha * 100).toFixed(0))}%`
        : `${parseFloat(alpha.toFixed(2))}`;
    return `oklch(${lStr} ${cStr} ${hStr} / ${aStr})`;
  }
  return `oklch(${lStr} ${cStr} ${hStr})`;
}

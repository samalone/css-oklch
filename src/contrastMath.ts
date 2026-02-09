// APCA and WCAG 2.x contrast computation
// Pure functions — no vscode dependency. Used by the extension host
// and inlined in the webview for real-time updates.

// ---------------------------------------------------------------------------
// APCA (Accessible Perceptual Contrast Algorithm) — APCA-W3 0.0.98G-4g
// Reference: https://github.com/Myndex/SAPC-APCA
// ---------------------------------------------------------------------------

/**
 * Compute APCA contrast (Lc) between text and background sRGB colors.
 * Uses simple pow(x, 2.4) gamma — NOT the piecewise sRGB transfer function.
 *
 * @param text  sRGB {r,g,b} in 0-1 range
 * @param bg    sRGB {r,g,b} in 0-1 range
 * @returns Lc value; positive = dark text on light bg, negative = light text on dark bg
 */
export function computeAPCA(
  text: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number }
): number {
  // Simple 2.4 gamma linearization (APCA-specific, not piecewise sRGB)
  const lin = (c: number) => Math.pow(Math.max(c, 0), 2.4);

  let Ytext =
    0.2126729 * lin(text.r) + 0.7151522 * lin(text.g) + 0.072175 * lin(text.b);
  let Ybg =
    0.2126729 * lin(bg.r) + 0.7151522 * lin(bg.g) + 0.072175 * lin(bg.b);

  // Soft-clamp for very dark values
  if (Ytext < 0.022) {
    Ytext += Math.pow(0.022 - Ytext, 1.414);
  }
  if (Ybg < 0.022) {
    Ybg += Math.pow(0.022 - Ybg, 1.414);
  }

  let Lc: number;

  if (Ybg > Ytext) {
    // Dark text on light background (positive Lc)
    const SAPC = Math.pow(Ybg, 0.56) - Math.pow(Ytext, 0.57);
    Lc = SAPC * 1.14 - 0.027;
  } else {
    // Light text on dark background (negative Lc)
    const SAPC = Math.pow(Ybg, 0.65) - Math.pow(Ytext, 0.62);
    Lc = SAPC * 1.14 + 0.027;
  }

  if (Math.abs(Lc) < 0.1) {
    return 0;
  }

  return Lc * 100; // Scale to Lc percentage
}

/**
 * Describe APCA Lc value in terms of suitable use cases.
 */
export function apcaDescription(lc: number): string {
  const abs = Math.abs(lc);
  if (abs >= 90) {
    return "Preferred body text";
  }
  if (abs >= 75) {
    return "Body text (18px+)";
  }
  if (abs >= 60) {
    return "Content text / 16px bold";
  }
  if (abs >= 45) {
    return "Headlines / large text";
  }
  if (abs >= 30) {
    return "Spot text / minimum";
  }
  if (abs >= 15) {
    return "Non-text only";
  }
  return "Not readable";
}

// APCA font-size lookup table (minimum Lc required for given font weight and size)
// This is a simplified version; full APCA uses more detailed lookup tables.
export const APCA_THRESHOLDS = [
  { lc: 90, label: "Preferred body" },
  { lc: 75, label: "Body 18px+" },
  { lc: 60, label: "Content 16px bold" },
  { lc: 45, label: "Headlines" },
  { lc: 30, label: "Spot text min" },
  { lc: 15, label: "Non-text" },
] as const;

// ---------------------------------------------------------------------------
// WCAG 2.x Contrast Ratio
// Reference: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
// ---------------------------------------------------------------------------

/**
 * Compute WCAG 2.x contrast ratio between two sRGB colors.
 * Uses the standard piecewise sRGB linearization.
 *
 * @param c1 sRGB {r,g,b} in 0-1 range
 * @param c2 sRGB {r,g,b} in 0-1 range
 * @returns Contrast ratio in range [1, 21]
 */
export function computeWCAG(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number }
): number {
  const luminance = (c: { r: number; g: number; b: number }) => {
    const srgbToLin = (v: number) =>
      v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    return (
      0.2126 * srgbToLin(c.r) + 0.7152 * srgbToLin(c.g) + 0.0722 * srgbToLin(c.b)
    );
  };

  const L1 = luminance(c1);
  const L2 = luminance(c2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determine WCAG conformance level.
 */
export function wcagLevel(
  ratio: number,
  isLargeText: boolean
): { aa: boolean; aaa: boolean } {
  if (isLargeText) {
    return { aa: ratio >= 3, aaa: ratio >= 4.5 };
  }
  return { aa: ratio >= 4.5, aaa: ratio >= 7 };
}

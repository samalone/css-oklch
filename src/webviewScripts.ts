/**
 * Shared inline JavaScript strings for webview interpolation.
 *
 * These are NOT runnable Node modules — they are string constants containing
 * JS code that gets interpolated into webview <script> tags. They run in the
 * webview's isolated browser context, not the extension host.
 */

import { OklchFormatOptions } from "./formatOklch";

/**
 * Core color conversion functions used by all 3 panels:
 * oklchToSrgb, linToSrgb, clamp01, toHex
 */
export const WEBVIEW_COLOR_CORE = `
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
  }`;

/**
 * sRGB gamut check. Used by picker + formula panels.
 */
export const WEBVIEW_GAMUT_CHECK = `
  function isInGamut(r, g, b) {
    return r >= -0.001 && r <= 1.001 && g >= -0.001 && g <= 1.001 && b >= -0.001 && b <= 1.001;
  }`;

/**
 * Inverse conversion: sRGB to OKLCH. Used by picker only (eyedropper).
 */
export const WEBVIEW_SRGB_TO_OKLCH = `
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
  }`;

/**
 * APCA and WCAG contrast computation. Used by contrast + formula panels.
 */
export const WEBVIEW_CONTRAST_MATH = `
  function computeAPCA(text, bg) {
    const lin = c => Math.pow(Math.max(c, 0), 2.4);
    let Ytext = 0.2126729 * lin(text.r) + 0.7151522 * lin(text.g) + 0.072175 * lin(text.b);
    let Ybg = 0.2126729 * lin(bg.r) + 0.7151522 * lin(bg.g) + 0.072175 * lin(bg.b);
    if (Ytext < 0.022) Ytext += Math.pow(0.022 - Ytext, 1.414);
    if (Ybg < 0.022) Ybg += Math.pow(0.022 - Ybg, 1.414);
    let Lc;
    if (Ybg > Ytext) {
      Lc = (Math.pow(Ybg, 0.56) - Math.pow(Ytext, 0.57)) * 1.14 - 0.027;
    } else {
      Lc = (Math.pow(Ybg, 0.65) - Math.pow(Ytext, 0.62)) * 1.14 + 0.027;
    }
    if (Math.abs(Lc) < 0.001) return 0;
    return Lc * 100;
  }

  function apcaDescription(lc) {
    const abs = Math.abs(lc);
    if (abs >= 90) return 'Preferred body text';
    if (abs >= 75) return 'Body text (18px+)';
    if (abs >= 60) return 'Content text / 16px bold';
    if (abs >= 45) return 'Headlines / large text';
    if (abs >= 30) return 'Spot text / minimum';
    if (abs >= 15) return 'Non-text only';
    return 'Not readable';
  }

  function computeWCAG(c1, c2) {
    const srgbLin = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    const lum = c => 0.2126 * srgbLin(c.r) + 0.7152 * srgbLin(c.g) + 0.0722 * srgbLin(c.b);
    const L1 = lum(c1), L2 = lum(c2);
    const lighter = Math.max(L1, L2), darker = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
  }`;

/**
 * Returns format variable declarations + formatOklchValue() as a JS string.
 * Must be called at build time because it interpolates format options.
 */
export function webviewFormatScript(fmtOpts: OklchFormatOptions): string {
  return `
  const fmtLightness = '${fmtOpts.lightnessFormat}';
  const fmtChroma = '${fmtOpts.chromaFormat}';
  const fmtHue = '${fmtOpts.hueFormat}';
  const fmtAlpha = '${fmtOpts.alphaFormat}';

  function formatOklchValue(L, C, H, A) {
    const lStr = fmtLightness === 'percentage'
      ? parseFloat((L * 100).toFixed(2)) + '%'
      : '' + parseFloat(L.toFixed(4));
    const cStr = fmtChroma === 'percentage'
      ? parseFloat((C / 0.4 * 100).toFixed(2)) + '%'
      : '' + parseFloat(C.toFixed(4));
    const hStr = fmtHue === 'deg'
      ? parseFloat(H.toFixed(2)) + 'deg'
      : '' + parseFloat(H.toFixed(2));
    if (A < 1) {
      const aStr = fmtAlpha === 'percentage'
        ? parseFloat((A * 100).toFixed(0)) + '%'
        : '' + parseFloat(A.toFixed(2));
      return 'oklch(' + lStr + ' ' + cStr + ' ' + hStr + ' / ' + aStr + ')';
    }
    return 'oklch(' + lStr + ' ' + cStr + ' ' + hStr + ')';
  }`;
}

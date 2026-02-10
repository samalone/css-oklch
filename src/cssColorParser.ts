import { findOklchAtOffset, findOklchColors } from "./oklchParser";
import { srgbToOklch, hslToSrgb, oklabToOklch } from "./colorConversion";

export type CssColorFormat = "oklch" | "hex" | "rgb" | "hsl" | "named" | "oklab";

export interface CssColorMatch {
  startOffset: number;
  endOffset: number;
  L: number;
  C: number;
  H: number;
  alpha: number;
  originalFormat: CssColorFormat;
}

export function findCssColorAtOffset(
  text: string,
  offset: number
): CssColorMatch | null {
  // 1. Try oklch (highest priority — preserves original values)
  const oklch = findOklchAtOffset(text, offset);
  if (oklch) {
    return { ...oklch, originalFormat: "oklch" };
  }

  // 2. Try functional notations: rgb(), hsl(), oklab()
  const func = findFunctionalColorAtOffset(text, offset);
  if (func) {
    return func;
  }

  // 3. Try hex
  const hex = findHexColorAtOffset(text, offset);
  if (hex) {
    return hex;
  }

  // 4. Try named color
  const named = findNamedColorAtOffset(text, offset);
  if (named) {
    return named;
  }

  return null;
}

/**
 * Find all CSS colors in the given text, including oklch() values.
 * Returns matches sorted by startOffset. oklch() values are included
 * so that batch conversion can reformat them to the user's preferred format.
 */
export function findAllCssColors(text: string): CssColorMatch[] {
  const results: CssColorMatch[] = [];
  // Include existing oklch() values for reformatting
  for (const m of findOklchColors(text)) {
    results.push({ ...m, originalFormat: "oklch" });
  }
  results.push(...findAllFunctionalColors(text));
  results.push(...findAllHexColors(text));
  results.push(...findAllNamedColors(text));
  results.sort((a, b) => a.startOffset - b.startOffset);
  return results;
}

// --- Functional color parser (rgb, hsl, oklab) ---

const FUNC_COLOR_REGEX = /(rgba?|hsla?|oklab)\(\s*([^)]*)\s*\)/gi;
const NUM_RE =
  /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn|%)?$/i;

function findFunctionalColorAtOffset(
  text: string,
  offset: number
): CssColorMatch | null {
  FUNC_COLOR_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FUNC_COLOR_REGEX.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) {
      const funcName = match[1].toLowerCase();
      const interior = match[2].trim();

      // Skip relative color syntax
      if (interior.startsWith("from")) {
        continue;
      }

      if (funcName === "rgb" || funcName === "rgba") {
        return parseRgbInterior(interior, start, end);
      } else if (funcName === "hsl" || funcName === "hsla") {
        return parseHslInterior(interior, start, end);
      } else if (funcName === "oklab") {
        return parseOklabInterior(interior, start, end);
      }
    }
  }
  return null;
}

function findAllFunctionalColors(text: string): CssColorMatch[] {
  const results: CssColorMatch[] = [];
  FUNC_COLOR_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FUNC_COLOR_REGEX.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const funcName = match[1].toLowerCase();
    const interior = match[2].trim();

    if (interior.startsWith("from")) {
      continue;
    }

    let result: CssColorMatch | null = null;
    if (funcName === "rgb" || funcName === "rgba") {
      result = parseRgbInterior(interior, start, end);
    } else if (funcName === "hsl" || funcName === "hsla") {
      result = parseHslInterior(interior, start, end);
    } else if (funcName === "oklab") {
      result = parseOklabInterior(interior, start, end);
    }
    if (result) {
      results.push(result);
    }
  }
  return results;
}

function splitColorArgs(interior: string): {
  tokens: string[];
  alpha: string | null;
} {
  // Split on "/" for alpha
  const slashParts = interior.split("/");
  if (slashParts.length > 2) {
    return { tokens: [], alpha: null };
  }

  const colorPart = slashParts[0].trim();
  const alphaPart = slashParts.length === 2 ? slashParts[1].trim() : null;

  // Detect comma-separated vs space-separated
  const hasCommas = colorPart.includes(",");
  let tokens: string[];
  if (hasCommas) {
    // Legacy comma syntax: may have alpha as 4th comma-separated value
    tokens = colorPart.split(",").map((t) => t.trim());
    if (tokens.length === 4 && alphaPart === null) {
      return { tokens: tokens.slice(0, 3), alpha: tokens[3] };
    }
  } else {
    tokens = colorPart.split(/\s+/).filter((t) => t.length > 0);
  }

  return { tokens, alpha: alphaPart };
}

function parseNumericToken(token: string): { value: number; unit: string | undefined } | null {
  if (token === "none") {
    return { value: 0, unit: undefined };
  }
  const m = token.match(NUM_RE);
  if (!m) {
    return null;
  }
  return { value: parseFloat(m[1]), unit: m[2]?.toLowerCase() };
}

function parseAlphaValue(token: string): number | null {
  const parsed = parseNumericToken(token);
  if (!parsed) {
    return null;
  }
  if (parsed.unit === "%") {
    return parsed.value / 100;
  }
  return parsed.value;
}

function parseRgbInterior(
  interior: string,
  startOffset: number,
  endOffset: number
): CssColorMatch | null {
  const { tokens, alpha: alphaToken } = splitColorArgs(interior);
  if (tokens.length !== 3) {
    return null;
  }

  const channels: number[] = [];
  for (const token of tokens) {
    const parsed = parseNumericToken(token);
    if (!parsed) {
      return null;
    }
    if (parsed.unit === "%") {
      channels.push(parsed.value / 100);
    } else {
      channels.push(parsed.value / 255);
    }
  }

  let alpha = 1;
  if (alphaToken) {
    const a = parseAlphaValue(alphaToken);
    if (a === null) {
      return null;
    }
    alpha = a;
  }

  const oklch = srgbToOklch(channels[0], channels[1], channels[2]);
  return {
    startOffset,
    endOffset,
    L: oklch.L,
    C: oklch.C,
    H: oklch.H,
    alpha,
    originalFormat: "rgb",
  };
}

function parseHslInterior(
  interior: string,
  startOffset: number,
  endOffset: number
): CssColorMatch | null {
  const { tokens, alpha: alphaToken } = splitColorArgs(interior);
  if (tokens.length !== 3) {
    return null;
  }

  // Parse hue (with angle units)
  const hParsed = parseNumericToken(tokens[0]);
  if (!hParsed) {
    return null;
  }
  let h = hParsed.value;
  switch (hParsed.unit) {
    case "grad":
      h = h * (360 / 400);
      break;
    case "rad":
      h = h * (180 / Math.PI);
      break;
    case "turn":
      h = h * 360;
      break;
    // deg or no unit = degrees
  }

  // Parse saturation and lightness (always percentages in CSS)
  const sParsed = parseNumericToken(tokens[1]);
  const lParsed = parseNumericToken(tokens[2]);
  if (!sParsed || !lParsed) {
    return null;
  }
  // In CSS, s and l are always specified as percentages
  const s = sParsed.unit === "%" ? sParsed.value / 100 : sParsed.value / 100;
  const l = lParsed.unit === "%" ? lParsed.value / 100 : lParsed.value / 100;

  let alpha = 1;
  if (alphaToken) {
    const a = parseAlphaValue(alphaToken);
    if (a === null) {
      return null;
    }
    alpha = a;
  }

  const rgb = hslToSrgb(h, s, l);
  const oklchVal = srgbToOklch(rgb.r, rgb.g, rgb.b);
  return {
    startOffset,
    endOffset,
    L: oklchVal.L,
    C: oklchVal.C,
    H: oklchVal.H,
    alpha,
    originalFormat: "hsl",
  };
}

function parseOklabInterior(
  interior: string,
  startOffset: number,
  endOffset: number
): CssColorMatch | null {
  const { tokens, alpha: alphaToken } = splitColorArgs(interior);
  if (tokens.length !== 3) {
    return null;
  }

  const lParsed = parseNumericToken(tokens[0]);
  const aParsed = parseNumericToken(tokens[1]);
  const bParsed = parseNumericToken(tokens[2]);
  if (!lParsed || !aParsed || !bParsed) {
    return null;
  }

  const labL = lParsed.unit === "%" ? lParsed.value / 100 : lParsed.value;
  // For a and b, percentage maps to -0.4..0.4 range (100% = 0.4)
  const labA = aParsed.unit === "%" ? (aParsed.value / 100) * 0.4 : aParsed.value;
  const labB = bParsed.unit === "%" ? (bParsed.value / 100) * 0.4 : bParsed.value;

  let alpha = 1;
  if (alphaToken) {
    const a = parseAlphaValue(alphaToken);
    if (a === null) {
      return null;
    }
    alpha = a;
  }

  const oklch = oklabToOklch(labL, labA, labB);
  return {
    startOffset,
    endOffset,
    L: oklch.L,
    C: oklch.C,
    H: oklch.H,
    alpha,
    originalFormat: "oklab",
  };
}

// --- Hex color parser ---

const HEX_REGEX = /#([0-9a-fA-F]{3,8})\b/g;

function findHexColorAtOffset(
  text: string,
  offset: number
): CssColorMatch | null {
  HEX_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HEX_REGEX.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) {
      const hex = match[1];
      const len = hex.length;
      if (len !== 3 && len !== 4 && len !== 6 && len !== 8) {
        continue;
      }

      // Check preceding character isn't part of an identifier
      if (start > 0) {
        const prev = text[start - 1];
        if (/[a-zA-Z0-9_-]/.test(prev)) {
          continue;
        }
      }

      let r: number, g: number, b: number, alpha = 1;
      if (len === 3) {
        r = parseInt(hex[0] + hex[0], 16) / 255;
        g = parseInt(hex[1] + hex[1], 16) / 255;
        b = parseInt(hex[2] + hex[2], 16) / 255;
      } else if (len === 4) {
        r = parseInt(hex[0] + hex[0], 16) / 255;
        g = parseInt(hex[1] + hex[1], 16) / 255;
        b = parseInt(hex[2] + hex[2], 16) / 255;
        alpha = parseInt(hex[3] + hex[3], 16) / 255;
      } else if (len === 6) {
        r = parseInt(hex.slice(0, 2), 16) / 255;
        g = parseInt(hex.slice(2, 4), 16) / 255;
        b = parseInt(hex.slice(4, 6), 16) / 255;
      } else {
        // len === 8
        r = parseInt(hex.slice(0, 2), 16) / 255;
        g = parseInt(hex.slice(2, 4), 16) / 255;
        b = parseInt(hex.slice(4, 6), 16) / 255;
        alpha = parseInt(hex.slice(6, 8), 16) / 255;
      }

      const oklch = srgbToOklch(r, g, b);
      return {
        startOffset: start,
        endOffset: end,
        L: oklch.L,
        C: oklch.C,
        H: oklch.H,
        alpha,
        originalFormat: "hex",
      };
    }
  }
  return null;
}

function findAllHexColors(text: string): CssColorMatch[] {
  const results: CssColorMatch[] = [];
  HEX_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HEX_REGEX.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const hex = match[1];
    const len = hex.length;
    if (len !== 3 && len !== 4 && len !== 6 && len !== 8) {
      continue;
    }
    if (start > 0) {
      const prev = text[start - 1];
      if (/[a-zA-Z0-9_-]/.test(prev)) {
        continue;
      }
    }

    let r: number, g: number, b: number, alpha = 1;
    if (len === 3) {
      r = parseInt(hex[0] + hex[0], 16) / 255;
      g = parseInt(hex[1] + hex[1], 16) / 255;
      b = parseInt(hex[2] + hex[2], 16) / 255;
    } else if (len === 4) {
      r = parseInt(hex[0] + hex[0], 16) / 255;
      g = parseInt(hex[1] + hex[1], 16) / 255;
      b = parseInt(hex[2] + hex[2], 16) / 255;
      alpha = parseInt(hex[3] + hex[3], 16) / 255;
    } else if (len === 6) {
      r = parseInt(hex.slice(0, 2), 16) / 255;
      g = parseInt(hex.slice(2, 4), 16) / 255;
      b = parseInt(hex.slice(4, 6), 16) / 255;
    } else {
      r = parseInt(hex.slice(0, 2), 16) / 255;
      g = parseInt(hex.slice(2, 4), 16) / 255;
      b = parseInt(hex.slice(4, 6), 16) / 255;
      alpha = parseInt(hex.slice(6, 8), 16) / 255;
    }

    const oklch = srgbToOklch(r, g, b);
    results.push({
      startOffset: start,
      endOffset: end,
      L: oklch.L,
      C: oklch.C,
      H: oklch.H,
      alpha,
      originalFormat: "hex",
    });
  }
  return results;
}

// --- Named color parser ---

function findNamedColorAtOffset(
  text: string,
  offset: number
): CssColorMatch | null {
  // Extract the word at the cursor position
  const wordRegex = /[a-zA-Z]+/g;
  wordRegex.lastIndex = Math.max(0, offset - 30);
  let match: RegExpExecArray | null;
  while ((match = wordRegex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (start > offset) {
      break;
    }
    if (offset >= start && offset <= end) {
      const word = match[0].toLowerCase();
      const rgb = NAMED_COLORS[word];
      if (rgb) {
        // Don't match if preceded by a dash (custom property like --red)
        if (start > 0 && text[start - 1] === "-") {
          return null;
        }
        const oklch = srgbToOklch(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
        return {
          startOffset: start,
          endOffset: end,
          L: oklch.L,
          C: oklch.C,
          H: oklch.H,
          alpha: rgb.length > 3 ? 0 : 1,
          originalFormat: "named",
        };
      }
      return null;
    }
  }
  return null;
}

// Build a regex that matches any named color as a whole word.
// Lazy-initialized on first use.
let namedColorRegex: RegExp | undefined;

function getNamedColorRegex(): RegExp {
  if (!namedColorRegex) {
    // Sort by length descending so longer names match first (e.g. "darkred" before "red")
    const names = Object.keys(NAMED_COLORS).sort((a, b) => b.length - a.length);
    namedColorRegex = new RegExp(`\\b(${names.join("|")})\\b`, "gi");
  }
  namedColorRegex.lastIndex = 0;
  return namedColorRegex;
}

function findAllNamedColors(text: string): CssColorMatch[] {
  const results: CssColorMatch[] = [];
  const regex = getNamedColorRegex();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const word = match[0].toLowerCase();

    // Don't match inside custom properties (--red) or function calls (red())
    if (start > 0 && text[start - 1] === "-") {
      continue;
    }
    if (end < text.length && text[end] === "(") {
      continue;
    }

    const rgb = NAMED_COLORS[word];
    if (rgb) {
      const oklch = srgbToOklch(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
      results.push({
        startOffset: start,
        endOffset: end,
        L: oklch.L,
        C: oklch.C,
        H: oklch.H,
        alpha: 1,
        originalFormat: "named",
      });
    }
  }
  return results;
}

/**
 * Scan backwards from a color's startOffset to find the CSS property name
 * in whose declaration the color appears. Returns the property name
 * (e.g. "--brand-primary" or "color") or null if not found.
 */
export function findPropertyContext(
  text: string,
  colorStartOffset: number
): string | null {
  const searchStart = Math.max(0, colorStartOffset - 200);
  const textBefore = text.substring(searchStart, colorStartOffset);
  const m = textBefore.match(/([\w-]+)\s*:\s*[^;{}]*$/);
  return m ? m[1] : null;
}

// CSS named colors: name -> [r, g, b] (0-255)
const NAMED_COLORS: Record<string, [number, number, number]> = {
  aliceblue: [240, 248, 255],
  antiquewhite: [250, 235, 215],
  aqua: [0, 255, 255],
  aquamarine: [127, 255, 212],
  azure: [240, 255, 255],
  beige: [245, 245, 220],
  bisque: [255, 228, 196],
  black: [0, 0, 0],
  blanchedalmond: [255, 235, 205],
  blue: [0, 0, 255],
  blueviolet: [138, 43, 226],
  brown: [165, 42, 42],
  burlywood: [222, 184, 135],
  cadetblue: [95, 158, 160],
  chartreuse: [127, 255, 0],
  chocolate: [210, 105, 30],
  coral: [255, 127, 80],
  cornflowerblue: [100, 149, 237],
  cornsilk: [255, 248, 220],
  crimson: [220, 20, 60],
  cyan: [0, 255, 255],
  darkblue: [0, 0, 139],
  darkcyan: [0, 139, 139],
  darkgoldenrod: [184, 134, 11],
  darkgray: [169, 169, 169],
  darkgreen: [0, 100, 0],
  darkgrey: [169, 169, 169],
  darkkhaki: [189, 183, 107],
  darkmagenta: [139, 0, 139],
  darkolivegreen: [85, 107, 47],
  darkorange: [255, 140, 0],
  darkorchid: [153, 50, 204],
  darkred: [139, 0, 0],
  darksalmon: [233, 150, 122],
  darkseagreen: [143, 188, 143],
  darkslateblue: [72, 61, 139],
  darkslategray: [47, 79, 79],
  darkslategrey: [47, 79, 79],
  darkturquoise: [0, 206, 209],
  darkviolet: [148, 0, 211],
  deeppink: [255, 20, 147],
  deepskyblue: [0, 191, 255],
  dimgray: [105, 105, 105],
  dimgrey: [105, 105, 105],
  dodgerblue: [30, 144, 255],
  firebrick: [178, 34, 34],
  floralwhite: [255, 250, 240],
  forestgreen: [34, 139, 34],
  fuchsia: [255, 0, 255],
  gainsboro: [220, 220, 220],
  ghostwhite: [248, 248, 255],
  gold: [255, 215, 0],
  goldenrod: [218, 165, 32],
  gray: [128, 128, 128],
  green: [0, 128, 0],
  greenyellow: [173, 255, 47],
  grey: [128, 128, 128],
  honeydew: [240, 255, 240],
  hotpink: [255, 105, 180],
  indianred: [205, 92, 92],
  indigo: [75, 0, 130],
  ivory: [255, 255, 240],
  khaki: [240, 230, 140],
  lavender: [230, 230, 250],
  lavenderblush: [255, 240, 245],
  lawngreen: [124, 252, 0],
  lemonchiffon: [255, 250, 205],
  lightblue: [173, 216, 230],
  lightcoral: [240, 128, 128],
  lightcyan: [224, 255, 255],
  lightgoldenrodyellow: [250, 250, 210],
  lightgray: [211, 211, 211],
  lightgreen: [144, 238, 144],
  lightgrey: [211, 211, 211],
  lightpink: [255, 182, 193],
  lightsalmon: [255, 160, 122],
  lightseagreen: [32, 178, 170],
  lightskyblue: [135, 206, 250],
  lightslategray: [119, 136, 153],
  lightslategrey: [119, 136, 153],
  lightsteelblue: [176, 196, 222],
  lightyellow: [255, 255, 224],
  lime: [0, 255, 0],
  limegreen: [50, 205, 50],
  linen: [250, 240, 230],
  magenta: [255, 0, 255],
  maroon: [128, 0, 0],
  mediumaquamarine: [102, 205, 170],
  mediumblue: [0, 0, 205],
  mediumorchid: [186, 85, 211],
  mediumpurple: [147, 112, 219],
  mediumseagreen: [60, 179, 113],
  mediumslateblue: [123, 104, 238],
  mediumspringgreen: [0, 250, 154],
  mediumturquoise: [72, 209, 204],
  mediumvioletred: [199, 21, 133],
  midnightblue: [25, 25, 112],
  mintcream: [245, 255, 250],
  mistyrose: [255, 228, 225],
  moccasin: [255, 228, 181],
  navajowhite: [255, 222, 173],
  navy: [0, 0, 128],
  oldlace: [253, 245, 230],
  olive: [128, 128, 0],
  olivedrab: [107, 142, 35],
  orange: [255, 165, 0],
  orangered: [255, 69, 0],
  orchid: [218, 112, 214],
  palegoldenrod: [238, 232, 170],
  palegreen: [152, 251, 152],
  paleturquoise: [175, 238, 238],
  palevioletred: [219, 112, 147],
  papayawhip: [255, 239, 213],
  peachpuff: [255, 218, 185],
  peru: [205, 133, 63],
  pink: [255, 192, 203],
  plum: [221, 160, 221],
  powderblue: [176, 224, 230],
  purple: [128, 0, 128],
  rebeccapurple: [102, 51, 153],
  red: [255, 0, 0],
  rosybrown: [188, 143, 143],
  royalblue: [65, 105, 225],
  saddlebrown: [139, 69, 19],
  salmon: [250, 128, 114],
  sandybrown: [244, 164, 96],
  seagreen: [46, 139, 87],
  seashell: [255, 245, 238],
  sienna: [160, 82, 45],
  silver: [192, 192, 192],
  skyblue: [135, 206, 235],
  slateblue: [106, 90, 205],
  slategray: [112, 128, 144],
  slategrey: [112, 128, 144],
  snow: [255, 250, 250],
  springgreen: [0, 255, 127],
  steelblue: [70, 130, 180],
  tan: [210, 180, 140],
  teal: [0, 128, 128],
  thistle: [216, 191, 216],
  tomato: [255, 99, 71],
  turquoise: [64, 224, 208],
  violet: [238, 130, 238],
  wheat: [245, 222, 179],
  white: [255, 255, 255],
  whitesmoke: [245, 245, 245],
  yellow: [255, 255, 0],
  yellowgreen: [154, 205, 50],
};

export interface OklchMatch {
  startOffset: number;
  endOffset: number;
  L: number;
  C: number;
  H: number;
  alpha: number;
}

const OKLCH_REGEX = /oklch\(\s*([^)]*)\s*\)/gi;
const NUM_RE = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn|%)?$/i;

export function findOklchColors(text: string): OklchMatch[] {
  const results: OklchMatch[] = [];
  let match: RegExpExecArray | null;

  OKLCH_REGEX.lastIndex = 0;
  while ((match = OKLCH_REGEX.exec(text)) !== null) {
    const interior = match[1].trim();

    // Skip relative color syntax: oklch(from ...)
    if (interior.startsWith("from")) {
      continue;
    }

    const parsed = parseInterior(interior);
    if (parsed) {
      results.push({
        startOffset: match.index,
        endOffset: match.index + match[0].length,
        ...parsed,
      });
    }
  }

  return results;
}

function parseInterior(
  interior: string
): { L: number; C: number; H: number; alpha: number } | null {
  // Split on "/" to separate color components from alpha
  const slashParts = interior.split("/");
  if (slashParts.length > 2) {
    return null;
  }

  const colorPart = slashParts[0].trim();
  const alphaPart = slashParts.length === 2 ? slashParts[1].trim() : null;

  // Tokenize the color part
  const colorTokens = colorPart.split(/\s+/).filter((t) => t.length > 0);
  if (colorTokens.length !== 3) {
    return null;
  }

  const L = parseL(colorTokens[0]);
  const C = parseC(colorTokens[1]);
  const H = parseH(colorTokens[2]);

  if (L === null || C === null || H === null) {
    return null;
  }

  let alpha = 1;
  if (alphaPart !== null) {
    const a = parseAlpha(alphaPart);
    if (a === null) {
      return null;
    }
    alpha = a;
  }

  return { L, C, H, alpha };
}

function parseL(token: string): number | null {
  if (token === "none") {
    return 0;
  }
  const m = token.match(NUM_RE);
  if (!m) {
    return null;
  }
  const value = parseFloat(m[1]);
  const unit = m[2]?.toLowerCase();
  if (unit === "%") {
    return value / 100;
  }
  // No unit: raw number in 0-1 range
  return value;
}

function parseC(token: string): number | null {
  if (token === "none") {
    return 0;
  }
  const m = token.match(NUM_RE);
  if (!m) {
    return null;
  }
  const value = parseFloat(m[1]);
  const unit = m[2]?.toLowerCase();
  if (unit === "%") {
    // 100% = 0.4
    return (value / 100) * 0.4;
  }
  return value;
}

function parseH(token: string): number | null {
  if (token === "none") {
    return 0;
  }
  const m = token.match(NUM_RE);
  if (!m) {
    return null;
  }
  const value = parseFloat(m[1]);
  const unit = m[2]?.toLowerCase();
  switch (unit) {
    case "grad":
      return value * (360 / 400);
    case "rad":
      return value * (180 / Math.PI);
    case "turn":
      return value * 360;
    case "deg":
    case "%":
      // "%" doesn't make sense for hue but treat deg and bare number the same
      return value;
    default:
      // No unit: degrees
      return value;
  }
}

export function findOklchAtOffset(
  text: string,
  offset: number
): OklchMatch | null {
  const matches = findOklchColors(text);
  for (const m of matches) {
    if (offset >= m.startOffset && offset <= m.endOffset) {
      return m;
    }
  }
  return null;
}

function parseAlpha(token: string): number | null {
  if (token === "none") {
    return 0;
  }
  const m = token.match(NUM_RE);
  if (!m) {
    return null;
  }
  const value = parseFloat(m[1]);
  const unit = m[2]?.toLowerCase();
  if (unit === "%") {
    return value / 100;
  }
  return value;
}

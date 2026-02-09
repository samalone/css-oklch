// OKLCH <-> sRGB conversion
// Based on Bjorn Ottosson's OKLab reference: https://bottosson.github.io/posts/oklab/

export function oklchToSrgb(
  L: number,
  C: number,
  H: number
): { r: number; g: number; b: number } {
  // OKLCH -> OKLab (polar to cartesian)
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  // OKLab -> Linear sRGB
  const lin = oklabToLinearSrgb(L, a, b);

  // Linear sRGB -> sRGB (gamma correction)
  return {
    r: linearToSrgb(lin.r),
    g: linearToSrgb(lin.g),
    b: linearToSrgb(lin.b),
  };
}

export function srgbToOklch(
  r: number,
  g: number,
  b: number
): { L: number; C: number; H: number } {
  // sRGB -> Linear sRGB
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  // Linear sRGB -> OKLab
  const lab = linearSrgbToOklab(lr, lg, lb);

  // OKLab -> OKLCH (cartesian to polar)
  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let H = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (H < 0) {
    H += 360;
  }

  return { L: lab.L, C, H };
}

function oklabToLinearSrgb(
  L: number,
  a: number,
  b: number
): { r: number; g: number; b: number } {
  // OKLab -> LMS (cube root domain)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  // Cube to get LMS
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS -> Linear sRGB
  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

function linearSrgbToOklab(
  r: number,
  g: number,
  b: number
): { L: number; a: number; b: number } {
  // Linear sRGB -> LMS
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  // Cube root
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  // LMS (cube root) -> OKLab
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export function oklchToHex(L: number, C: number, H: number): string {
  const { r, g, b } = oklchToSrgb(L, C, H);
  const clamp = (x: number) => Math.min(255, Math.max(0, Math.round(x * 255)));
  const toHex = (x: number) => clamp(x).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function isInSrgbGamut(L: number, C: number, H: number): boolean {
  const { r, g, b } = oklchToSrgb(L, C, H);
  return r >= -0.001 && r <= 1.001 && g >= -0.001 && g <= 1.001 && b >= -0.001 && b <= 1.001;
}

function linearToSrgb(x: number): number {
  if (x <= 0.0031308) {
    return 12.92 * x;
  }
  return 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

function srgbToLinear(x: number): number {
  if (x <= 0.04045) {
    return x / 12.92;
  }
  return Math.pow((x + 0.055) / 1.055, 2.4);
}

export function hslToSrgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c; g = x;
  } else if (h < 120) {
    r = x; g = c;
  } else if (h < 180) {
    g = c; b = x;
  } else if (h < 240) {
    g = x; b = c;
  } else if (h < 300) {
    r = x; b = c;
  } else {
    r = c; b = x;
  }
  return { r: r + m, g: g + m, b: b + m };
}

export function oklabToOklch(
  L: number,
  a: number,
  b: number
): { L: number; C: number; H: number } {
  const C = Math.sqrt(a * a + b * b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) {
    H += 360;
  }
  return { L, C, H };
}

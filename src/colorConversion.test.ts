import { describe, it, expect } from "vitest";
import {
  oklchToSrgb,
  srgbToOklch,
  oklchToHex,
  isInSrgbGamut,
  hslToSrgb,
  oklabToOklch,
} from "./colorConversion";

const EPSILON = 0.005;

function closeTo(actual: number, expected: number, epsilon = EPSILON) {
  expect(actual).toBeCloseTo(expected, -Math.log10(epsilon));
}

describe("oklchToSrgb", () => {
  it("converts black (L=0)", () => {
    const { r, g, b } = oklchToSrgb(0, 0, 0);
    closeTo(r, 0);
    closeTo(g, 0);
    closeTo(b, 0);
  });

  it("converts white (L=1)", () => {
    const { r, g, b } = oklchToSrgb(1, 0, 0);
    closeTo(r, 1);
    closeTo(g, 1);
    closeTo(b, 1);
  });

  it("converts a mid-gray", () => {
    const { r, g, b } = oklchToSrgb(0.5, 0, 0);
    // Gray: r === g === b
    closeTo(r, g, 0.001);
    closeTo(g, b, 0.001);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(1);
  });

  it("converts a known red-ish color", () => {
    // Pure sRGB red (#ff0000) is approximately oklch(0.6279, 0.2577, 29.23)
    const { r, g, b } = oklchToSrgb(0.6279, 0.2577, 29.23);
    closeTo(r, 1, 0.02);
    closeTo(g, 0, 0.02);
    closeTo(b, 0, 0.02);
  });

  it("converts a known blue color", () => {
    // Pure sRGB blue (#0000ff) is approximately oklch(0.4520, 0.3132, 264.05)
    const { r, g, b } = oklchToSrgb(0.452, 0.3132, 264.05);
    closeTo(r, 0, 0.02);
    closeTo(g, 0, 0.02);
    closeTo(b, 1, 0.02);
  });

  it("handles zero chroma at any hue (achromatic)", () => {
    const { r: r1, g: g1, b: b1 } = oklchToSrgb(0.7, 0, 0);
    const { r: r2, g: g2, b: b2 } = oklchToSrgb(0.7, 0, 180);
    closeTo(r1, r2, 0.001);
    closeTo(g1, g2, 0.001);
    closeTo(b1, b2, 0.001);
  });
});

describe("srgbToOklch", () => {
  it("converts black", () => {
    const { L, C } = srgbToOklch(0, 0, 0);
    closeTo(L, 0);
    closeTo(C, 0);
  });

  it("converts white", () => {
    const { L, C } = srgbToOklch(1, 1, 1);
    closeTo(L, 1);
    closeTo(C, 0, 0.001);
  });

  it("converts pure red", () => {
    const { L, C, H } = srgbToOklch(1, 0, 0);
    closeTo(L, 0.6279, 0.01);
    closeTo(C, 0.2577, 0.01);
    closeTo(H, 29.23, 1);
  });

  it("converts pure green", () => {
    const { L, C, H } = srgbToOklch(0, 1, 0);
    closeTo(L, 0.8664, 0.01);
    expect(C).toBeGreaterThan(0.15);
    closeTo(H, 142.5, 2);
  });

  it("converts pure blue", () => {
    const { L, C, H } = srgbToOklch(0, 0, 1);
    closeTo(L, 0.452, 0.01);
    closeTo(C, 0.3132, 0.01);
    closeTo(H, 264.05, 1);
  });

  it("produces non-negative hue", () => {
    const { H } = srgbToOklch(0.2, 0.3, 0.8);
    expect(H).toBeGreaterThanOrEqual(0);
    expect(H).toBeLessThan(360);
  });
});

describe("oklch round-trip", () => {
  const testColors = [
    [0, 0, 0],
    [1, 1, 1],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [0.5, 0.5, 0.5],
    [0.2, 0.8, 0.4],
    [1, 0.75, 0.5],
  ] as const;

  for (const [r, g, b] of testColors) {
    it(`round-trips sRGB (${r}, ${g}, ${b})`, () => {
      const oklch = srgbToOklch(r, g, b);
      const back = oklchToSrgb(oklch.L, oklch.C, oklch.H);
      closeTo(back.r, r, 0.01);
      closeTo(back.g, g, 0.01);
      closeTo(back.b, b, 0.01);
    });
  }
});

describe("oklchToHex", () => {
  it("converts black to #000000", () => {
    expect(oklchToHex(0, 0, 0)).toBe("#000000");
  });

  it("converts white to #ffffff", () => {
    expect(oklchToHex(1, 0, 0)).toBe("#ffffff");
  });

  it("converts known red", () => {
    const hex = oklchToHex(0.6279, 0.2577, 29.23);
    // Should be close to #ff0000
    expect(hex).toMatch(/^#f[ef]\d{2}\d{2}$/);
  });

  it("clamps out-of-gamut values", () => {
    const hex = oklchToHex(1, 0.4, 150);
    // Should still be a valid 6-digit hex
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("isInSrgbGamut", () => {
  it("returns true for black", () => {
    expect(isInSrgbGamut(0, 0, 0)).toBe(true);
  });

  it("returns true for white", () => {
    expect(isInSrgbGamut(1, 0, 0)).toBe(true);
  });

  it("returns true for mid-gray", () => {
    expect(isInSrgbGamut(0.5, 0, 0)).toBe(true);
  });

  it("returns true for in-gamut color", () => {
    // oklch values for #808080
    const { L, C, H } = srgbToOklch(0.5, 0.5, 0.5);
    expect(isInSrgbGamut(L, C, H)).toBe(true);
  });

  it("returns false for out-of-gamut color", () => {
    // Very high chroma at medium lightness
    expect(isInSrgbGamut(0.5, 0.4, 150)).toBe(false);
  });
});

describe("hslToSrgb", () => {
  it("converts pure red (0, 1, 0.5)", () => {
    const { r, g, b } = hslToSrgb(0, 1, 0.5);
    closeTo(r, 1);
    closeTo(g, 0);
    closeTo(b, 0);
  });

  it("converts pure green (120, 1, 0.5)", () => {
    const { r, g, b } = hslToSrgb(120, 1, 0.5);
    closeTo(r, 0);
    closeTo(g, 1);
    closeTo(b, 0);
  });

  it("converts pure blue (240, 1, 0.5)", () => {
    const { r, g, b } = hslToSrgb(240, 1, 0.5);
    closeTo(r, 0);
    closeTo(g, 0);
    closeTo(b, 1);
  });

  it("converts black (0, 0, 0)", () => {
    const { r, g, b } = hslToSrgb(0, 0, 0);
    closeTo(r, 0);
    closeTo(g, 0);
    closeTo(b, 0);
  });

  it("converts white (0, 0, 1)", () => {
    const { r, g, b } = hslToSrgb(0, 0, 1);
    closeTo(r, 1);
    closeTo(g, 1);
    closeTo(b, 1);
  });

  it("converts gray (0, 0, 0.5)", () => {
    const { r, g, b } = hslToSrgb(0, 0, 0.5);
    closeTo(r, 0.5);
    closeTo(g, 0.5);
    closeTo(b, 0.5);
  });

  it("handles negative hue (wrapping)", () => {
    const { r, g, b } = hslToSrgb(-120, 1, 0.5);
    // -120 degrees = 240 degrees = blue
    closeTo(r, 0);
    closeTo(g, 0);
    closeTo(b, 1);
  });

  it("handles hue > 360 (wrapping)", () => {
    const { r, g, b } = hslToSrgb(480, 1, 0.5);
    // 480 = 120 degrees = green
    closeTo(r, 0);
    closeTo(g, 1);
    closeTo(b, 0);
  });

  it("converts yellow (60, 1, 0.5)", () => {
    const { r, g, b } = hslToSrgb(60, 1, 0.5);
    closeTo(r, 1);
    closeTo(g, 1);
    closeTo(b, 0);
  });

  it("converts cyan (180, 1, 0.5)", () => {
    const { r, g, b } = hslToSrgb(180, 1, 0.5);
    closeTo(r, 0);
    closeTo(g, 1);
    closeTo(b, 1);
  });

  it("converts magenta (300, 1, 0.5)", () => {
    const { r, g, b } = hslToSrgb(300, 1, 0.5);
    closeTo(r, 1);
    closeTo(g, 0);
    closeTo(b, 1);
  });
});

describe("oklabToOklch", () => {
  it("converts zero a,b to zero chroma", () => {
    const { L, C, H } = oklabToOklch(0.5, 0, 0);
    closeTo(L, 0.5);
    closeTo(C, 0);
  });

  it("converts positive a-axis to hue 0", () => {
    const { C, H } = oklabToOklch(0.5, 0.1, 0);
    closeTo(C, 0.1);
    closeTo(H, 0, 0.1);
  });

  it("converts positive b-axis to hue 90", () => {
    const { C, H } = oklabToOklch(0.5, 0, 0.1);
    closeTo(C, 0.1);
    closeTo(H, 90);
  });

  it("converts negative a-axis to hue 180", () => {
    const { C, H } = oklabToOklch(0.5, -0.1, 0);
    closeTo(C, 0.1);
    closeTo(H, 180);
  });

  it("converts negative b-axis to hue 270", () => {
    const { C, H } = oklabToOklch(0.5, 0, -0.1);
    closeTo(C, 0.1);
    closeTo(H, 270);
  });

  it("always produces non-negative hue", () => {
    const { H } = oklabToOklch(0.5, -0.05, -0.05);
    expect(H).toBeGreaterThanOrEqual(0);
    expect(H).toBeLessThan(360);
  });

  it("preserves L value", () => {
    const { L } = oklabToOklch(0.75, 0.1, -0.2);
    closeTo(L, 0.75);
  });
});

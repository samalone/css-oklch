import { describe, it, expect } from "vitest";
import { findOklchColors, findOklchAtOffset } from "./oklchParser";

describe("findOklchColors", () => {
  it("parses basic oklch with numbers", () => {
    const text = "color: oklch(0.7 0.15 180);";
    const results = findOklchColors(text);
    expect(results).toHaveLength(1);
    expect(results[0].L).toBeCloseTo(0.7);
    expect(results[0].C).toBeCloseTo(0.15);
    expect(results[0].H).toBeCloseTo(180);
    expect(results[0].alpha).toBe(1);
  });

  it("parses oklch with percentage lightness", () => {
    const results = findOklchColors("oklch(70% 0.15 180)");
    expect(results).toHaveLength(1);
    expect(results[0].L).toBeCloseTo(0.7);
  });

  it("parses oklch with percentage chroma", () => {
    const results = findOklchColors("oklch(0.7 37.5% 180)");
    expect(results).toHaveLength(1);
    // 37.5% of 0.4 = 0.15
    expect(results[0].C).toBeCloseTo(0.15);
  });

  it("parses oklch with deg hue", () => {
    const results = findOklchColors("oklch(0.7 0.15 180deg)");
    expect(results).toHaveLength(1);
    expect(results[0].H).toBeCloseTo(180);
  });

  it("parses oklch with grad hue", () => {
    const results = findOklchColors("oklch(0.7 0.15 200grad)");
    expect(results).toHaveLength(1);
    // 200grad = 180deg
    expect(results[0].H).toBeCloseTo(180);
  });

  it("parses oklch with rad hue", () => {
    const results = findOklchColors(`oklch(0.7 0.15 ${Math.PI}rad)`);
    expect(results).toHaveLength(1);
    expect(results[0].H).toBeCloseTo(180);
  });

  it("parses oklch with turn hue", () => {
    const results = findOklchColors("oklch(0.7 0.15 0.5turn)");
    expect(results).toHaveLength(1);
    expect(results[0].H).toBeCloseTo(180);
  });

  it("parses oklch with alpha", () => {
    const results = findOklchColors("oklch(0.7 0.15 180 / 0.5)");
    expect(results).toHaveLength(1);
    expect(results[0].alpha).toBeCloseTo(0.5);
  });

  it("parses oklch with percentage alpha", () => {
    const results = findOklchColors("oklch(0.7 0.15 180 / 50%)");
    expect(results).toHaveLength(1);
    expect(results[0].alpha).toBeCloseTo(0.5);
  });

  it("handles none keyword for L", () => {
    const results = findOklchColors("oklch(none 0.15 180)");
    expect(results).toHaveLength(1);
    expect(results[0].L).toBe(0);
  });

  it("handles none keyword for C", () => {
    const results = findOklchColors("oklch(0.7 none 180)");
    expect(results).toHaveLength(1);
    expect(results[0].C).toBe(0);
  });

  it("handles none keyword for H", () => {
    const results = findOklchColors("oklch(0.7 0.15 none)");
    expect(results).toHaveLength(1);
    expect(results[0].H).toBe(0);
  });

  it("handles none keyword for alpha", () => {
    const results = findOklchColors("oklch(0.7 0.15 180 / none)");
    expect(results).toHaveLength(1);
    expect(results[0].alpha).toBe(0);
  });

  it("skips relative color syntax (oklch(from ...))", () => {
    const text = "oklch(from red l c h)";
    const results = findOklchColors(text);
    expect(results).toHaveLength(0);
  });

  it("finds multiple oklch values", () => {
    const text =
      "color: oklch(0.7 0.15 180); background: oklch(0.9 0.1 90);";
    const results = findOklchColors(text);
    expect(results).toHaveLength(2);
    expect(results[0].H).toBeCloseTo(180);
    expect(results[1].H).toBeCloseTo(90);
  });

  it("tracks correct offsets", () => {
    const text = "color: oklch(0.7 0.15 180);";
    const results = findOklchColors(text);
    expect(results[0].startOffset).toBe(7);
    expect(results[0].endOffset).toBe(26);
    expect(text.slice(results[0].startOffset, results[0].endOffset)).toBe(
      "oklch(0.7 0.15 180)"
    );
  });

  it("is case-insensitive", () => {
    const results = findOklchColors("OKLCH(0.7 0.15 180)");
    expect(results).toHaveLength(1);
  });

  it("rejects invalid input (too few tokens)", () => {
    expect(findOklchColors("oklch(0.7 0.15)")).toHaveLength(0);
  });

  it("rejects invalid input (too many tokens)", () => {
    expect(findOklchColors("oklch(0.7 0.15 180 0.5)")).toHaveLength(0);
  });

  it("rejects invalid input (multiple slashes)", () => {
    expect(findOklchColors("oklch(0.7 / 0.15 / 180)")).toHaveLength(0);
  });

  it("handles scientific notation", () => {
    const results = findOklchColors("oklch(7e-1 1.5e-1 1.8e2)");
    expect(results).toHaveLength(1);
    expect(results[0].L).toBeCloseTo(0.7);
    expect(results[0].C).toBeCloseTo(0.15);
    expect(results[0].H).toBeCloseTo(180);
  });

  it("handles extra whitespace", () => {
    const results = findOklchColors("oklch(  0.7   0.15   180  )");
    expect(results).toHaveLength(1);
    expect(results[0].L).toBeCloseTo(0.7);
  });
});

describe("findOklchAtOffset", () => {
  it("returns match when offset is inside oklch()", () => {
    const text = "color: oklch(0.7 0.15 180);";
    const match = findOklchAtOffset(text, 15);
    expect(match).not.toBeNull();
    expect(match!.L).toBeCloseTo(0.7);
  });

  it("returns match at the start boundary", () => {
    const text = "color: oklch(0.7 0.15 180);";
    const match = findOklchAtOffset(text, 7); // 'o' of oklch
    expect(match).not.toBeNull();
  });

  it("returns match at the end boundary", () => {
    const text = "color: oklch(0.7 0.15 180);";
    const match = findOklchAtOffset(text, 26); // endOffset (one past closing paren)
    expect(match).not.toBeNull();
  });

  it("returns null when offset is outside oklch()", () => {
    const text = "color: oklch(0.7 0.15 180);";
    expect(findOklchAtOffset(text, 0)).toBeNull();
    expect(findOklchAtOffset(text, 5)).toBeNull();
  });

  it("returns correct match among multiple", () => {
    const text =
      "color: oklch(0.7 0.15 180); background: oklch(0.9 0.1 90);";
    const match = findOklchAtOffset(text, 50);
    expect(match).not.toBeNull();
    expect(match!.L).toBeCloseTo(0.9);
  });

  it("returns null for empty text", () => {
    expect(findOklchAtOffset("", 0)).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import {
  findCssColorAtOffset,
  findAllCssColors,
  findPropertyContext,
} from "./cssColorParser";

describe("findCssColorAtOffset", () => {
  describe("oklch colors", () => {
    it("detects oklch at cursor", () => {
      const text = "color: oklch(0.7 0.15 180);";
      const match = findCssColorAtOffset(text, 15);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("oklch");
      expect(match!.L).toBeCloseTo(0.7);
    });
  });

  describe("hex colors", () => {
    it("detects 6-digit hex", () => {
      const text = "color: #ff6600;";
      const match = findCssColorAtOffset(text, 9);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("hex");
      expect(match!.alpha).toBe(1);
    });

    it("detects 3-digit hex", () => {
      const text = "color: #f60;";
      const match = findCssColorAtOffset(text, 9);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("hex");
    });

    it("detects 8-digit hex (with alpha)", () => {
      const text = "color: #ff660080;";
      const match = findCssColorAtOffset(text, 9);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("hex");
      expect(match!.alpha).toBeCloseTo(128 / 255, 2);
    });

    it("detects 4-digit hex (with alpha)", () => {
      const text = "color: #f608;";
      const match = findCssColorAtOffset(text, 9);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("hex");
      expect(match!.alpha).toBeCloseTo(0x88 / 255, 2);
    });

    it("does not match hex inside identifiers", () => {
      const text = "content: abc#ff6600;";
      const match = findCssColorAtOffset(text, 14);
      expect(match).toBeNull();
    });
  });

  describe("rgb/rgba colors", () => {
    it("detects rgb() with 0-255 values", () => {
      const text = "color: rgb(255, 102, 0);";
      const match = findCssColorAtOffset(text, 12);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("rgb");
      expect(match!.alpha).toBe(1);
    });

    it("detects rgba() with alpha", () => {
      const text = "color: rgba(255, 102, 0, 0.5);";
      const match = findCssColorAtOffset(text, 15);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("rgb");
      expect(match!.alpha).toBeCloseTo(0.5);
    });

    it("detects rgb() with space-separated syntax", () => {
      const text = "color: rgb(255 102 0);";
      const match = findCssColorAtOffset(text, 12);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("rgb");
    });

    it("detects rgb() with space-separated syntax and alpha", () => {
      const text = "color: rgb(255 102 0 / 0.5);";
      const match = findCssColorAtOffset(text, 12);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("rgb");
      expect(match!.alpha).toBeCloseTo(0.5);
    });

    it("detects rgb() with percentage values", () => {
      const text = "color: rgb(100%, 40%, 0%);";
      const match = findCssColorAtOffset(text, 12);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("rgb");
    });

    it("skips relative color syntax", () => {
      const text = "color: rgb(from red r g b);";
      const match = findCssColorAtOffset(text, 15);
      expect(match).toBeNull();
    });
  });

  describe("hsl/hsla colors", () => {
    it("detects hsl()", () => {
      const text = "color: hsl(0, 100%, 50%);";
      const match = findCssColorAtOffset(text, 12);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("hsl");
    });

    it("detects hsla() with alpha", () => {
      const text = "color: hsla(0, 100%, 50%, 0.5);";
      const match = findCssColorAtOffset(text, 15);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("hsl");
      expect(match!.alpha).toBeCloseTo(0.5);
    });

    it("detects hsl() space-separated with slash alpha", () => {
      const text = "color: hsl(120 100% 50% / 0.8);";
      const match = findCssColorAtOffset(text, 12);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("hsl");
      expect(match!.alpha).toBeCloseTo(0.8);
    });

    it("detects hsl() with angle units", () => {
      const text = "color: hsl(0.5turn, 100%, 50%);";
      const match = findCssColorAtOffset(text, 12);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("hsl");
    });
  });

  describe("oklab colors", () => {
    it("detects oklab()", () => {
      const text = "color: oklab(0.5 0.1 -0.1);";
      const match = findCssColorAtOffset(text, 12);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("oklab");
    });

    it("detects oklab() with alpha", () => {
      const text = "color: oklab(0.5 0.1 -0.1 / 0.8);";
      const match = findCssColorAtOffset(text, 12);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("oklab");
      expect(match!.alpha).toBeCloseTo(0.8);
    });

    it("detects oklab() with percentage values", () => {
      const text = "color: oklab(50% 25% -25%);";
      const match = findCssColorAtOffset(text, 12);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("oklab");
    });
  });

  describe("named colors", () => {
    it("detects a named color", () => {
      const text = "color: red;";
      const match = findCssColorAtOffset(text, 8);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("named");
    });

    it("detects longer named colors", () => {
      const text = "color: cornflowerblue;";
      const match = findCssColorAtOffset(text, 10);
      expect(match).not.toBeNull();
      expect(match!.originalFormat).toBe("named");
    });

    it("does not match inside custom properties", () => {
      const text = "var(--red)";
      const match = findCssColorAtOffset(text, 6);
      expect(match).toBeNull();
    });

    it("returns null for non-color words", () => {
      const text = "display: block;";
      const match = findCssColorAtOffset(text, 11);
      expect(match).toBeNull();
    });
  });

  describe("priority", () => {
    it("prefers oklch over other formats", () => {
      const text = "color: oklch(0.7 0.15 180);";
      const match = findCssColorAtOffset(text, 15);
      expect(match!.originalFormat).toBe("oklch");
    });
  });

  it("returns null when cursor is not on any color", () => {
    const text = "display: block;";
    const match = findCssColorAtOffset(text, 5);
    expect(match).toBeNull();
  });
});

describe("findAllCssColors", () => {
  it("finds oklch colors", () => {
    const text = "color: oklch(0.7 0.15 180);";
    const results = findAllCssColors(text);
    expect(results.some((r) => r.originalFormat === "oklch")).toBe(true);
  });

  it("finds hex colors", () => {
    const text = "color: #ff6600;";
    const results = findAllCssColors(text);
    expect(results.some((r) => r.originalFormat === "hex")).toBe(true);
  });

  it("finds rgb colors", () => {
    const text = "color: rgb(255, 0, 0);";
    const results = findAllCssColors(text);
    expect(results.some((r) => r.originalFormat === "rgb")).toBe(true);
  });

  it("finds hsl colors", () => {
    const text = "color: hsl(0, 100%, 50%);";
    const results = findAllCssColors(text);
    expect(results.some((r) => r.originalFormat === "hsl")).toBe(true);
  });

  it("finds oklab colors", () => {
    const text = "color: oklab(0.5 0.1 -0.1);";
    const results = findAllCssColors(text);
    expect(results.some((r) => r.originalFormat === "oklab")).toBe(true);
  });

  it("finds named colors", () => {
    const text = "color: red;";
    const results = findAllCssColors(text);
    expect(results.some((r) => r.originalFormat === "named")).toBe(true);
  });

  it("finds multiple mixed colors sorted by offset", () => {
    const text =
      "color: #ff0000; background: oklch(0.7 0.15 180); border: rgb(0, 128, 0);";
    const results = findAllCssColors(text);
    expect(results.length).toBeGreaterThanOrEqual(3);
    // Verify sorted by startOffset
    for (let i = 1; i < results.length; i++) {
      expect(results[i].startOffset).toBeGreaterThanOrEqual(
        results[i - 1].startOffset
      );
    }
  });

  it("returns empty array for text with no colors", () => {
    const text = "display: block; margin: 10px;";
    const results = findAllCssColors(text);
    expect(results).toHaveLength(0);
  });

  it("does not match hex in identifiers", () => {
    const text = "content: abc#ffffff;";
    const results = findAllCssColors(text);
    const hexResults = results.filter((r) => r.originalFormat === "hex");
    expect(hexResults).toHaveLength(0);
  });

  it("does not match named colors in custom properties", () => {
    const text = "color: var(--red);";
    const results = findAllCssColors(text);
    const namedResults = results.filter((r) => r.originalFormat === "named");
    expect(namedResults).toHaveLength(0);
  });
});

describe("findPropertyContext", () => {
  it("detects custom property name", () => {
    const text = "--brand-primary: oklch(0.7 0.15 180);";
    // offset of 'o' in oklch
    expect(findPropertyContext(text, 17)).toBe("--brand-primary");
  });

  it("detects standard property name", () => {
    const text = "color: oklch(0.7 0.15 180);";
    expect(findPropertyContext(text, 7)).toBe("color");
  });

  it("detects property with multi-value context", () => {
    const text = "border: 1px solid oklch(0.7 0.15 180);";
    expect(findPropertyContext(text, 18)).toBe("border");
  });

  it("detects property when color is inside a function", () => {
    const text = "--bg: linear-gradient(oklch(0.7 0.15 180), white);";
    expect(findPropertyContext(text, 22)).toBe("--bg");
  });

  it("does not cross semicolon boundary", () => {
    const text = "color: red; --text: oklch(0.7 0.15 180);";
    expect(findPropertyContext(text, 20)).toBe("--text");
  });

  it("does not cross opening brace boundary", () => {
    const text = ".foo { --text: oklch(0.7 0.15 180);";
    expect(findPropertyContext(text, 15)).toBe("--text");
  });

  it("returns null when no property context", () => {
    const text = "oklch(0.7 0.15 180)";
    expect(findPropertyContext(text, 0)).toBeNull();
  });

  it("handles extra whitespace around colon", () => {
    const text = "--brand  :  oklch(0.7 0.15 180);";
    expect(findPropertyContext(text, 12)).toBe("--brand");
  });
});

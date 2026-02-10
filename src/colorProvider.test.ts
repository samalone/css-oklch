import { describe, it, expect } from "vitest";
import { OklchColorProvider } from "./colorProvider";
import {
  createMockDocument,
  Color,
  CancellationToken,
} from "./__mocks__/vscode";

const token = { isCancellationRequested: false } as CancellationToken;

function provider() {
  return new OklchColorProvider();
}

describe("OklchColorProvider", () => {
  describe("provideDocumentColors", () => {
    it("returns empty array for text with no oklch colors", () => {
      const doc = createMockDocument("body { color: red; }");
      const results = provider().provideDocumentColors(doc as any, token as any);
      expect(results).toHaveLength(0);
    });

    it("finds a single oklch color", () => {
      const doc = createMockDocument("body { color: oklch(0.7 0.15 180); }");
      const results = provider().provideDocumentColors(doc as any, token as any);
      expect(results).toHaveLength(1);
    });

    it("returns correct range for oklch color", () => {
      const text = "body { color: oklch(0.7 0.15 180); }";
      const doc = createMockDocument(text);
      const results = provider().provideDocumentColors(doc as any, token as any);
      const range = results[0].range;
      // "oklch(0.7 0.15 180)" starts at index 14
      expect(range.start.line).toBe(0);
      expect(range.start.character).toBe(14);
      expect(range.end.line).toBe(0);
      expect(range.end.character).toBe(33);
    });

    it("returns sRGB color values clamped to 0-1", () => {
      const doc = createMockDocument("color: oklch(0.7 0.15 180);");
      const results = provider().provideDocumentColors(doc as any, token as any);
      const color = results[0].color;
      expect(color.red).toBeGreaterThanOrEqual(0);
      expect(color.red).toBeLessThanOrEqual(1);
      expect(color.green).toBeGreaterThanOrEqual(0);
      expect(color.green).toBeLessThanOrEqual(1);
      expect(color.blue).toBeGreaterThanOrEqual(0);
      expect(color.blue).toBeLessThanOrEqual(1);
    });

    it("preserves alpha value", () => {
      const doc = createMockDocument("color: oklch(0.7 0.15 180 / 0.5);");
      const results = provider().provideDocumentColors(doc as any, token as any);
      expect(results[0].color.alpha).toBeCloseTo(0.5);
    });

    it("sets alpha to 1 when not specified", () => {
      const doc = createMockDocument("color: oklch(0.7 0.15 180);");
      const results = provider().provideDocumentColors(doc as any, token as any);
      expect(results[0].color.alpha).toBe(1);
    });

    it("finds multiple oklch colors", () => {
      const text = `
        .a { color: oklch(0.7 0.15 180); }
        .b { color: oklch(0.9 0.1 90); }
        .c { background: oklch(0.3 0.2 270 / 0.8); }
      `;
      const doc = createMockDocument(text);
      const results = provider().provideDocumentColors(doc as any, token as any);
      expect(results).toHaveLength(3);
    });

    it("handles multiline document with correct positions", () => {
      const text = "body {\n  color: oklch(0.5 0.1 200);\n}";
      const doc = createMockDocument(text);
      const results = provider().provideDocumentColors(doc as any, token as any);
      expect(results).toHaveLength(1);
      // oklch starts on line 1, character 9
      expect(results[0].range.start.line).toBe(1);
      expect(results[0].range.start.character).toBe(9);
    });

    it("converts black correctly (L=0)", () => {
      const doc = createMockDocument("color: oklch(0 0 0);");
      const results = provider().provideDocumentColors(doc as any, token as any);
      const c = results[0].color;
      expect(c.red).toBeCloseTo(0, 2);
      expect(c.green).toBeCloseTo(0, 2);
      expect(c.blue).toBeCloseTo(0, 2);
    });

    it("converts white correctly (L=1)", () => {
      const doc = createMockDocument("color: oklch(1 0 0);");
      const results = provider().provideDocumentColors(doc as any, token as any);
      const c = results[0].color;
      expect(c.red).toBeCloseTo(1, 2);
      expect(c.green).toBeCloseTo(1, 2);
      expect(c.blue).toBeCloseTo(1, 2);
    });

    it("skips relative color syntax", () => {
      const doc = createMockDocument("color: oklch(from red l c h);");
      const results = provider().provideDocumentColors(doc as any, token as any);
      expect(results).toHaveLength(0);
    });

    it("clamps out-of-gamut colors to valid sRGB range", () => {
      // High chroma that would produce out-of-gamut sRGB
      const doc = createMockDocument("color: oklch(0.5 0.4 150);");
      const results = provider().provideDocumentColors(doc as any, token as any);
      const c = results[0].color;
      expect(c.red).toBeGreaterThanOrEqual(0);
      expect(c.red).toBeLessThanOrEqual(1);
      expect(c.green).toBeGreaterThanOrEqual(0);
      expect(c.green).toBeLessThanOrEqual(1);
      expect(c.blue).toBeGreaterThanOrEqual(0);
      expect(c.blue).toBeLessThanOrEqual(1);
    });
  });

  describe("provideColorPresentations", () => {
    it("returns a single presentation", () => {
      const doc = createMockDocument("");
      const color = new Color(1, 0, 0, 1);
      const context = { document: doc as any, range: null as any };
      const results = provider().provideColorPresentations(
        color as any, context as any, token as any
      );
      expect(results).toHaveLength(1);
    });

    it("formats as oklch() string", () => {
      const color = new Color(1, 0, 0, 1);
      const context = { document: null as any, range: null as any };
      const results = provider().provideColorPresentations(
        color as any, context as any, token as any
      );
      expect(results[0].label).toMatch(/^oklch\(.+\)$/);
    });

    it("omits alpha when alpha = 1", () => {
      const color = new Color(0.5, 0.5, 0.5, 1);
      const context = { document: null as any, range: null as any };
      const results = provider().provideColorPresentations(
        color as any, context as any, token as any
      );
      expect(results[0].label).not.toContain("/");
    });

    it("includes alpha when alpha < 1", () => {
      const color = new Color(0.5, 0.5, 0.5, 0.5);
      const context = { document: null as any, range: null as any };
      const results = provider().provideColorPresentations(
        color as any, context as any, token as any
      );
      expect(results[0].label).toContain("/");
      expect(results[0].label).toContain("0.5");
    });

    it("produces valid oklch values for pure red", () => {
      const color = new Color(1, 0, 0, 1);
      const context = { document: null as any, range: null as any };
      const results = provider().provideColorPresentations(
        color as any, context as any, token as any
      );
      const label = results[0].label;
      // Should contain L ~0.6279, C ~0.2577, H ~29.23
      const match = label.match(/oklch\(([^ ]+) ([^ ]+) ([^)]+)\)/);
      expect(match).not.toBeNull();
      const L = parseFloat(match![1]);
      const C = parseFloat(match![2]);
      const H = parseFloat(match![3]);
      expect(L).toBeCloseTo(0.6279, 1);
      expect(C).toBeCloseTo(0.2577, 1);
      expect(H).toBeCloseTo(29.23, 0);
    });

    it("produces valid oklch values for black", () => {
      const color = new Color(0, 0, 0, 1);
      const context = { document: null as any, range: null as any };
      const results = provider().provideColorPresentations(
        color as any, context as any, token as any
      );
      expect(results[0].label).toMatch(/oklch\(0 0 /);
    });

    it("produces valid oklch values for white", () => {
      const color = new Color(1, 1, 1, 1);
      const context = { document: null as any, range: null as any };
      const results = provider().provideColorPresentations(
        color as any, context as any, token as any
      );
      const label = results[0].label;
      const match = label.match(/oklch\(([^ ]+)/);
      expect(match).not.toBeNull();
      expect(parseFloat(match![1])).toBeCloseTo(1, 1);
    });

    it("round-trips: provideDocumentColors → provideColorPresentations → parseable", () => {
      const original = "color: oklch(0.7 0.15 180);";
      const doc = createMockDocument(original);
      const p = provider();

      // Get the Color from the document
      const colors = p.provideDocumentColors(doc as any, token as any);
      expect(colors).toHaveLength(1);

      // Get the presentation string from that Color
      const presentations = p.provideColorPresentations(
        colors[0].color as any,
        { document: doc as any, range: colors[0].range } as any,
        token as any
      );
      const label = presentations[0].label;

      // Parse the presentation to verify it produces similar values
      const match = label.match(
        /oklch\(([^ ]+) ([^ ]+) ([^)/]+)\)/
      );
      expect(match).not.toBeNull();
      expect(parseFloat(match![1])).toBeCloseTo(0.7, 1);
      expect(parseFloat(match![2])).toBeCloseTo(0.15, 1);
      // Hue drifts slightly through OKLCH→sRGB→OKLCH round-trip
      expect(Math.abs(parseFloat(match![3]) - 180)).toBeLessThan(3);
    });
  });
});

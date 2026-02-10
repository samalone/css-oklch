import { describe, it, expect } from "vitest";
import { formatOklchWithOptions, OklchFormatOptions } from "./formatOklch";

const defaults: OklchFormatOptions = {
  lightnessFormat: "number",
  chromaFormat: "number",
  hueFormat: "number",
  alphaFormat: "number",
};

describe("formatOklchWithOptions", () => {
  describe("default number format", () => {
    it("formats basic oklch without alpha", () => {
      const result = formatOklchWithOptions(0.7, 0.15, 180, 1, defaults);
      expect(result).toBe("oklch(0.7 0.15 180)");
    });

    it("formats oklch with alpha", () => {
      const result = formatOklchWithOptions(0.7, 0.15, 180, 0.5, defaults);
      expect(result).toBe("oklch(0.7 0.15 180 / 0.5)");
    });

    it("omits alpha when alpha = 1", () => {
      const result = formatOklchWithOptions(0.7, 0.15, 180, 1, defaults);
      expect(result).not.toContain("/");
    });

    it("trims trailing zeros in L", () => {
      const result = formatOklchWithOptions(0.7, 0.15, 180, 1, defaults);
      expect(result).toContain("0.7 ");
    });

    it("trims trailing zeros in C", () => {
      const result = formatOklchWithOptions(0.7, 0.15, 180, 1, defaults);
      expect(result).toContain(" 0.15 ");
    });

    it("trims trailing zeros in H", () => {
      const result = formatOklchWithOptions(0.7, 0.15, 180, 1, defaults);
      expect(result).toContain(" 180)");
    });

    it("formats zero values", () => {
      const result = formatOklchWithOptions(0, 0, 0, 1, defaults);
      expect(result).toBe("oklch(0 0 0)");
    });
  });

  describe("percentage lightness", () => {
    it("formats L as percentage", () => {
      const opts: OklchFormatOptions = { ...defaults, lightnessFormat: "percentage" };
      const result = formatOklchWithOptions(0.7, 0.15, 180, 1, opts);
      expect(result).toContain("70%");
    });

    it("formats L=0 as 0%", () => {
      const opts: OklchFormatOptions = { ...defaults, lightnessFormat: "percentage" };
      const result = formatOklchWithOptions(0, 0.15, 180, 1, opts);
      expect(result).toContain("0%");
    });

    it("formats L=1 as 100%", () => {
      const opts: OklchFormatOptions = { ...defaults, lightnessFormat: "percentage" };
      const result = formatOklchWithOptions(1, 0.15, 180, 1, opts);
      expect(result).toContain("100%");
    });
  });

  describe("percentage chroma", () => {
    it("formats C as percentage (C/0.4*100)", () => {
      const opts: OklchFormatOptions = { ...defaults, chromaFormat: "percentage" };
      const result = formatOklchWithOptions(0.7, 0.15, 180, 1, opts);
      // 0.15 / 0.4 * 100 = 37.5
      expect(result).toContain("37.5%");
    });

    it("formats C=0 as 0%", () => {
      const opts: OklchFormatOptions = { ...defaults, chromaFormat: "percentage" };
      const result = formatOklchWithOptions(0.7, 0, 180, 1, opts);
      expect(result).toContain("0%");
    });
  });

  describe("deg hue", () => {
    it("formats H with deg suffix", () => {
      const opts: OklchFormatOptions = { ...defaults, hueFormat: "deg" };
      const result = formatOklchWithOptions(0.7, 0.15, 180, 1, opts);
      expect(result).toContain("180deg");
    });

    it("formats H=0 with deg suffix", () => {
      const opts: OklchFormatOptions = { ...defaults, hueFormat: "deg" };
      const result = formatOklchWithOptions(0.7, 0.15, 0, 1, opts);
      expect(result).toContain("0deg");
    });
  });

  describe("percentage alpha", () => {
    it("formats alpha as percentage", () => {
      const opts: OklchFormatOptions = { ...defaults, alphaFormat: "percentage" };
      const result = formatOklchWithOptions(0.7, 0.15, 180, 0.5, opts);
      expect(result).toContain("/ 50%");
    });

    it("formats alpha=0 as 0%", () => {
      const opts: OklchFormatOptions = { ...defaults, alphaFormat: "percentage" };
      const result = formatOklchWithOptions(0.7, 0.15, 180, 0, opts);
      expect(result).toContain("/ 0%");
    });

    it("still omits alpha when alpha = 1", () => {
      const opts: OklchFormatOptions = { ...defaults, alphaFormat: "percentage" };
      const result = formatOklchWithOptions(0.7, 0.15, 180, 1, opts);
      expect(result).not.toContain("/");
    });
  });

  describe("all percentage format", () => {
    it("formats everything as percentages", () => {
      const opts: OklchFormatOptions = {
        lightnessFormat: "percentage",
        chromaFormat: "percentage",
        hueFormat: "deg",
        alphaFormat: "percentage",
      };
      const result = formatOklchWithOptions(0.7, 0.15, 180, 0.5, opts);
      expect(result).toBe("oklch(70% 37.5% 180deg / 50%)");
    });
  });

  describe("precision", () => {
    it("rounds L to 4 decimal places", () => {
      const result = formatOklchWithOptions(0.123456789, 0.15, 180, 1, defaults);
      expect(result).toContain("0.1235 ");
    });

    it("rounds C to 4 decimal places", () => {
      const result = formatOklchWithOptions(0.7, 0.123456789, 180, 1, defaults);
      expect(result).toContain(" 0.1235 ");
    });

    it("rounds H to 2 decimal places", () => {
      const result = formatOklchWithOptions(0.7, 0.15, 123.456, 1, defaults);
      expect(result).toContain("123.46)");
    });

    it("rounds alpha to 2 decimal places", () => {
      const result = formatOklchWithOptions(0.7, 0.15, 180, 0.456, defaults);
      expect(result).toContain("/ 0.46");
    });

    it("rounds percentage L to 2 decimal places", () => {
      const opts: OklchFormatOptions = { ...defaults, lightnessFormat: "percentage" };
      const result = formatOklchWithOptions(0.123456789, 0.15, 180, 1, opts);
      expect(result).toContain("12.35%");
    });
  });
});

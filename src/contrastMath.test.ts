import { describe, it, expect } from "vitest";
import {
  computeAPCA,
  apcaDescription,
  APCA_THRESHOLDS,
  computeWCAG,
  wcagLevel,
} from "./contrastMath";

const black = { r: 0, g: 0, b: 0 };
const white = { r: 1, g: 1, b: 1 };
const midGray = { r: 0.5, g: 0.5, b: 0.5 };

describe("computeAPCA", () => {
  it("returns high positive Lc for black text on white background", () => {
    const lc = computeAPCA(black, white);
    expect(lc).toBeGreaterThan(100);
  });

  it("returns high negative Lc for white text on black background", () => {
    const lc = computeAPCA(white, black);
    expect(lc).toBeLessThan(-100);
  });

  it("returns 0 for identical colors", () => {
    expect(computeAPCA(midGray, midGray)).toBe(0);
  });

  it("returns 0 for black on black", () => {
    expect(computeAPCA(black, black)).toBe(0);
  });

  it("returns 0 for white on white", () => {
    expect(computeAPCA(white, white)).toBe(0);
  });

  it("is polarity-aware (dark on light vs light on dark)", () => {
    const darkOnLight = computeAPCA(black, white);
    const lightOnDark = computeAPCA(white, black);
    expect(darkOnLight).toBeGreaterThan(0);
    expect(lightOnDark).toBeLessThan(0);
    // Absolute values should differ (asymmetric by design)
    expect(Math.abs(darkOnLight)).not.toBeCloseTo(Math.abs(lightOnDark), 0);
  });

  it("produces moderate contrast for gray on white", () => {
    const lc = computeAPCA(midGray, white);
    expect(lc).toBeGreaterThan(0);
    expect(lc).toBeLessThan(100);
  });

  it("handles near-black colors (soft clamp)", () => {
    const veryDark = { r: 0.01, g: 0.01, b: 0.01 };
    const lc = computeAPCA(veryDark, white);
    expect(Number.isFinite(lc)).toBe(true);
    expect(lc).toBeGreaterThan(100);
  });

  it("clamps negative channel values to 0", () => {
    const negativeColor = { r: -0.1, g: -0.1, b: -0.1 };
    const lc = computeAPCA(negativeColor, white);
    expect(Number.isFinite(lc)).toBe(true);
  });
});

describe("apcaDescription", () => {
  it("returns 'Preferred body text' for Lc >= 90", () => {
    expect(apcaDescription(95)).toBe("Preferred body text");
    expect(apcaDescription(90)).toBe("Preferred body text");
  });

  it("returns 'Body text (18px+)' for Lc 75-89", () => {
    expect(apcaDescription(80)).toBe("Body text (18px+)");
    expect(apcaDescription(75)).toBe("Body text (18px+)");
  });

  it("returns 'Content text / 16px bold' for Lc 60-74", () => {
    expect(apcaDescription(65)).toBe("Content text / 16px bold");
  });

  it("returns 'Headlines / large text' for Lc 45-59", () => {
    expect(apcaDescription(50)).toBe("Headlines / large text");
  });

  it("returns 'Spot text / minimum' for Lc 30-44", () => {
    expect(apcaDescription(35)).toBe("Spot text / minimum");
  });

  it("returns 'Non-text only' for Lc 15-29", () => {
    expect(apcaDescription(20)).toBe("Non-text only");
  });

  it("returns 'Not readable' for Lc < 15", () => {
    expect(apcaDescription(10)).toBe("Not readable");
    expect(apcaDescription(0)).toBe("Not readable");
  });

  it("works with negative Lc values (uses absolute value)", () => {
    expect(apcaDescription(-95)).toBe("Preferred body text");
    expect(apcaDescription(-50)).toBe("Headlines / large text");
    expect(apcaDescription(-5)).toBe("Not readable");
  });
});

describe("APCA_THRESHOLDS", () => {
  it("has 6 threshold levels", () => {
    expect(APCA_THRESHOLDS).toHaveLength(6);
  });

  it("is sorted by Lc descending", () => {
    for (let i = 1; i < APCA_THRESHOLDS.length; i++) {
      expect(APCA_THRESHOLDS[i].lc).toBeLessThan(APCA_THRESHOLDS[i - 1].lc);
    }
  });
});

describe("computeWCAG", () => {
  it("returns 21:1 for black on white", () => {
    const ratio = computeWCAG(black, white);
    expect(ratio).toBeCloseTo(21, 0);
  });

  it("returns 1:1 for identical colors", () => {
    expect(computeWCAG(midGray, midGray)).toBeCloseTo(1, 5);
  });

  it("returns 1:1 for black on black", () => {
    expect(computeWCAG(black, black)).toBeCloseTo(1, 5);
  });

  it("returns 1:1 for white on white", () => {
    expect(computeWCAG(white, white)).toBeCloseTo(1, 5);
  });

  it("is symmetric (order-independent)", () => {
    const ratio1 = computeWCAG(black, white);
    const ratio2 = computeWCAG(white, black);
    expect(ratio1).toBeCloseTo(ratio2, 5);
  });

  it("returns a ratio between 1 and 21", () => {
    const colors = [
      { r: 0.2, g: 0.3, b: 0.8 },
      { r: 0.9, g: 0.1, b: 0.5 },
    ];
    const ratio = computeWCAG(colors[0], colors[1]);
    expect(ratio).toBeGreaterThanOrEqual(1);
    expect(ratio).toBeLessThanOrEqual(21);
  });

  it("produces moderate contrast for gray on white", () => {
    const ratio = computeWCAG(midGray, white);
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(21);
  });
});

describe("wcagLevel", () => {
  it("normal text: AAA requires 7:1", () => {
    expect(wcagLevel(7, false)).toEqual({ aa: true, aaa: true });
    expect(wcagLevel(6.9, false)).toEqual({ aa: true, aaa: false });
  });

  it("normal text: AA requires 4.5:1", () => {
    expect(wcagLevel(4.5, false)).toEqual({ aa: true, aaa: false });
    expect(wcagLevel(4.4, false)).toEqual({ aa: false, aaa: false });
  });

  it("large text: AAA requires 4.5:1", () => {
    expect(wcagLevel(4.5, true)).toEqual({ aa: true, aaa: true });
    expect(wcagLevel(4.4, true)).toEqual({ aa: true, aaa: false });
  });

  it("large text: AA requires 3:1", () => {
    expect(wcagLevel(3, true)).toEqual({ aa: true, aaa: false });
    expect(wcagLevel(2.9, true)).toEqual({ aa: false, aaa: false });
  });

  it("fails both levels for very low contrast", () => {
    expect(wcagLevel(1.5, false)).toEqual({ aa: false, aaa: false });
    expect(wcagLevel(1.5, true)).toEqual({ aa: false, aaa: false });
  });
});

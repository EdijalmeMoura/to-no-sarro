import { describe, it, expect } from "vitest";

describe("Taxa de serviço", () => {
  function calculateServiceCharge(subtotal, percent, enabled) {
    if (!enabled) return 0;
    return subtotal * (percent / 100);
  }

  it("calcula 10% corretamente", () => {
    expect(calculateServiceCharge(100, 10, true)).toBe(10);
    expect(calculateServiceCharge(55, 10, true)).toBe(5.5);
    expect(calculateServiceCharge(100, 10, false)).toBe(0);
  });

  it("calcula percentuais customizados", () => {
    expect(calculateServiceCharge(100, 5, true)).toBe(5);
    expect(calculateServiceCharge(100, 15, true)).toBe(15);
    expect(calculateServiceCharge(100, 0, true)).toBe(0);
  });

  it("valida range 0-30", () => {
    const isValid = (p) => p >= 0 && p <= 30;
    expect(isValid(10)).toBe(true);
    expect(isValid(0)).toBe(true);
    expect(isValid(30)).toBe(true);
    expect(isValid(31)).toBe(false);
    expect(isValid(-1)).toBe(false);
  });
});

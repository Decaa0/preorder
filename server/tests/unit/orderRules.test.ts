import { describe, it, expect } from "vitest";
import { computeTotal, validateOrderLines, canAccept } from "../../src/domain/orderRules";

describe("orderRules (unit)", () => {
  it("TEST-U01 computeTotal sums unit price x quantity", () => {
    expect(computeTotal([{ unitPriceCents: 6000, quantity: 2 }, { unitPriceCents: 7000, quantity: 1 }])).toBe(19000);
  });

  it("TEST-U02 validateOrderLines accepts valid and rejects invalid lines", () => {
    expect(validateOrderLines([{ menuItemId: "a", quantity: 1 }, { menuItemId: "b", quantity: 10 }]).ok).toBe(true);
    for (const bad of [
      [], "x", null,
      [{ menuItemId: "a", quantity: 0 }],
      [{ menuItemId: "a", quantity: 11 }],
      [{ menuItemId: "a", quantity: 1.5 }],
      [{ menuItemId: "a", quantity: "2" }],
      [{ menuItemId: "a", quantity: -1 }],
      [{ menuItemId: "a", quantity: 1 }, { menuItemId: "a", quantity: 2 }],
      Array.from({ length: 11 }, (_, i) => ({ menuItemId: "m" + i, quantity: 1 })),
    ]) {
      const r = validateOrderLines(bad);
      expect(r.ok, JSON.stringify(bad)).toBe(false);
      expect(r.code).toBe("VALIDATION_ERROR");
    }
  });

  it("TEST-U03 canAccept is true only for PLACED", () => {
    expect(canAccept("PLACED")).toBe(true);
    for (const s of ["ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED"]) expect(canAccept(s)).toBe(false);
  });
});

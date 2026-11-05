export const MAX_QTY = 10;
export const MAX_LINES = 10;

export function computeTotal(lines: { unitPriceCents: number; quantity: number }[]): number {
  return lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
}

export type Validation = { ok: true } | { ok: false; code: "VALIDATION_ERROR"; message: string };

/** BR-02 (qty 1..10 integer) and BR-03 (1..10 lines, no duplicate menu item). */
export function validateOrderLines(items: unknown): Validation {
  const bad = (message: string): Validation => ({ ok: false, code: "VALIDATION_ERROR", message });
  if (!Array.isArray(items) || items.length === 0) return bad("items must be a non-empty array");
  if (items.length > MAX_LINES) return bad(`an order may have at most ${MAX_LINES} lines`);
  const seen = new Set<string>();
  for (const it of items) {
    if (!it || typeof it !== "object") return bad("each item must be an object");
    const { menuItemId, quantity } = it as { menuItemId?: unknown; quantity?: unknown };
    if (typeof menuItemId !== "string" || menuItemId === "") return bad("menuItemId is required");
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY)
      return bad(`quantity must be an integer from 1 to ${MAX_QTY}`);
    if (seen.has(menuItemId)) return bad("a menu item may appear only once per order");
    seen.add(menuItemId);
  }
  return { ok: true };
}

/** BR-09: only PLACED orders can be accepted. */
export function canAccept(status: string): boolean {
  return status === "PLACED";
}

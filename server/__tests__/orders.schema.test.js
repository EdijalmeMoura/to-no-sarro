import { describe, it, expect } from "vitest";
import { validateOrder } from "../schemas/orders.js";

describe("validateOrder zod", () => {
  it("aceita pedido mesa com tableNumber", () => {
    const body = {
      customer: { name: "Mesa 01 · João", phone: "81999999999", addr: "Mesa 01" },
      items: [{ productId: "p1", qty: 1 }],
      type: "dine_in",
      payment: "No fechamento da mesa",
      tableNumber: 1,
      tableName: "Mesa 01",
    };
    const parsed = validateOrder(body);
    expect(parsed.tableNumber).toBe(1);
    expect(parsed.type).toBe("dine_in");
  });

  it("rejeita nome curto", () => {
    expect(() => validateOrder({
      customer: { name: "Jo", phone: "81999999999", addr: "Rua A, 123" },
      items: [{ productId: "p1", qty: 1 }],
      type: "delivery",
      payment: "PIX"
    })).toThrow();
  });

  it("rejeita qty zero", () => {
    expect(() => validateOrder({
      customer: { name: "João Silva", phone: "81999999999", addr: "Rua A" },
      items: [{ productId: "p1", qty: 0 }],
      type: "delivery",
      payment: "PIX"
    })).toThrow();
  });

  it("aceita payment Cartão e Mesa", () => {
    for (const pm of ["Cartão", "Mesa", "Balcão", "No fechamento da mesa"]) {
      const parsed = validateOrder({
        customer: { name: "João Silva", phone: "81999999999", addr: "Mesa 02" },
        items: [{ productId: "p1", qty: 1 }],
        type: "mesa",
        payment: pm,
        tableNumber: 2,
      });
      expect(parsed.payment).toBe(pm);
    }
  });

  it("rejeita tableNumber fora do range", () => {
    expect(() => validateOrder({
      customer: { name: "João", phone: "81999999999", addr: "Mesa 99" },
      items: [{ productId: "p1", qty: 1 }],
      type: "mesa",
      payment: "Mesa",
      tableNumber: 99
    })).toThrow();
  });
});

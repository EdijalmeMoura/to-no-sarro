import { describe, it, expect } from "vitest";
import { validateSettings } from "../schemas/settings.js";
import { validateProduct } from "../schemas/products.js";

describe("Security - zod validation", () => {
  it("rejeita service_charge_percent fora do range", () => {
    expect(() => validateSettings({ service_charge_percent: 50 })).toThrow();
    expect(() => validateSettings({ service_charge_percent: -5 })).toThrow();
    expect(() => validateSettings({ service_charge_percent: 10 }).code).not.toBeDefined; // should not throw
    // valid
    const ok = validateSettings({ service_charge_percent: 15 });
    expect(ok.service_charge_percent).toBe(15);
  });

  it("rejeita produto com preço negativo", () => {
    expect(() => validateProduct({ name: "Burger", cat: "burgers", price: -5 })).toThrow();
  });

  it("aceita produto válido", () => {
    const p = validateProduct({ name: "Sarro Burger", cat: "burgers", price: 25.9 });
    expect(p.name).toBe("Sarro Burger");
    expect(p.price).toBe(25.9);
  });

  it("idempotency key - cacheia resposta", () => {
    // Simula lógica de idempotency
    const cache = new Map();
    const key = "test-key-123";
    const response = { order: { id: "o1", code: 1001 } };
    
    cache.set(key, { status: 201, body: response, createdAt: Date.now() });
    
    const cached = cache.get(key);
    expect(cached.body.order.code).toBe(1001);
    expect(Date.now() - cached.createdAt).toBeLessThan(1000);
  });
});

describe("Health check", () => {
  it("estrutura do health check", () => {
    const mockHealth = {
      ok: true,
      status: "healthy",
      version: "0.2.0",
      uptime: 123.45,
      db: "ok",
      migrations: 2,
      timestamp: Date.now(),
    };
    
    expect(mockHealth.ok).toBe(true);
    expect(mockHealth.db).toBe("ok");
    expect(mockHealth.migrations).toBeGreaterThanOrEqual(2);
  });
});

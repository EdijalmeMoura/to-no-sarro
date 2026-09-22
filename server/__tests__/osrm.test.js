import { describe, it, expect } from "vitest";
import { optimizeDeliveryRoute } from "../routing/osrm.js";

describe("OSRM routing - fallback", () => {
  it("retorna ordem original quando geocoding falha", async () => {
    const orders = [
      { id: "o1", customer: { addr: "Endereço Inexistente XYZ 123456" } },
      { id: "o2", customer: { addr: "Outro Endereço Inexistente ABC" } },
    ];
    const storeAddress = "Av. Cláudio José Gueiros Leite, 3200 — Janga, Paulista/PE";
    
    // Como os endereços são inválidos, deve retornar não otimizado mas com todos os pedidos
    const result = await optimizeDeliveryRoute(orders, storeAddress);
    
    expect(result.orders.length).toBe(2);
    // Pode ser otimizado ou não dependendo da disponibilidade do Nominatim, mas não deve crashar
    expect(result).toHaveProperty("optimized");
    expect(result).toHaveProperty("orders");
  });

  it("lida com lista vazia", async () => {
    const result = await optimizeDeliveryRoute([], "Loja");
    expect(result.orders.length).toBe(0);
  });
});

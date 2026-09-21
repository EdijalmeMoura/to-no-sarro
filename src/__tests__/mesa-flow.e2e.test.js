import { describe, it, expect } from "vitest";
import { buildMesaIndex, getOrderTableNumber, isTableOccupied } from "../utils/mesa.js";
import { getOrderModality } from "../utils/orderModality.js";

describe("Fluxo completo mesa - E2E", () => {
  it("abre mesa, adiciona itens, calcula taxa serviço", () => {
    const tableNum = 5;
    const tableName = `Mesa ${String(tableNum).padStart(2, "0")}`;
    
    let orders = [];
    
    const order1 = {
      id: "o1",
      code: 1001,
      status: "NOVO",
      type: "dine_in",
      tableNumber: tableNum,
      tableName,
      payment: "No fechamento da mesa",
      customer: { name: `${tableName} · João`, addr: tableName },
      items: [{ id: "i1", name: "Sarro Burger", qty: 2, unit: 20 }],
      total: 40,
      createdAt: Date.now() - 1000*60*10,
    };
    orders.push(order1);
    
    let byMesa = buildMesaIndex(orders);
    expect(byMesa.get(tableNum).length).toBe(1);
    expect(getOrderTableNumber(order1)).toBe(5);
    expect(isTableOccupied(order1)).toBe(true);
    
    const order2 = {
      id: "o2",
      code: 1002,
      status: "NOVO",
      type: "dine_in",
      tableNumber: tableNum,
      tableName,
      payment: "No fechamento da mesa",
      customer: { name: `${tableName} · João`, addr: tableName },
      items: [{ id: "i2", name: "Batata Frita", qty: 1, unit: 15 }],
      total: 15,
      createdAt: Date.now() - 1000*60*5,
    };
    orders.push(order2);
    
    byMesa = buildMesaIndex(orders);
    expect(byMesa.get(tableNum).length).toBe(2);
    
    const tableTotal = byMesa.get(tableNum).reduce((acc, o) => acc + o.total, 0);
    expect(tableTotal).toBe(55);
    
    const servicePercent = 10;
    const serviceValue = tableTotal * (servicePercent/100);
    expect(serviceValue).toBe(5.5);
    
    const totalWithService = tableTotal + serviceValue;
    expect(totalWithService).toBe(60.5);
  });

  it("mesa só libera quando paga (regra nova)", () => {
    const tableNum = 3;
    const orderPending = {
      id: "o3",
      status: "PRONTO",
      type: "dine_in",
      tableNumber: tableNum,
      payment: "No fechamento da mesa",
      customer: { addr: "Mesa 03" },
      total: 50,
    };
    // Mesmo se tentar ENTREGUE com pagamento pendente, continua ocupada
    const orderTryingToCloseWithoutPay = {
      ...orderPending,
      status: "ENTREGUE",
      payment: "No fechamento da mesa",
    };
    expect(isTableOccupied(orderPending)).toBe(true);
    expect(isTableOccupied(orderTryingToCloseWithoutPay)).toBe(true); // bloqueia baixa
    
    const byMesaPending = buildMesaIndex([orderPending]);
    expect(byMesaPending.get(tableNum).length).toBe(1);
    
    const byMesaTrying = buildMesaIndex([orderTryingToCloseWithoutPay]);
    expect(byMesaTrying.get(tableNum).length).toBe(1); // ainda ocupada
    
    // Quando paga, libera
    const orderPaid = {
      ...orderPending,
      status: "ENTREGUE",
      payment: "PIX",
    };
    expect(isTableOccupied(orderPaid)).toBe(false);
    const byMesaPaid = buildMesaIndex([orderPaid]);
    expect(byMesaPaid.get(tableNum)).toBeUndefined();
  });

  it("divide conta igualmente", () => {
    const subtotal = 100;
    const servicePercent = 10;
    const service = subtotal * (servicePercent/100);
    const total = subtotal + service;
    
    const people = 4;
    const perPerson = total / people;
    
    expect(perPerson).toBe(27.5);
    expect(perPerson * people).toBe(total);
  });

  it("divide conta por itens", () => {
    const items = [
      { id: "i1", name: "Burger", qty: 1, unit: 25, person: 0 },
      { id: "i2", name: "Burger", qty: 1, unit: 25, person: 1 },
      { id: "i3", name: "Refri", qty: 2, unit: 5, person: 0 },
    ];
    
    const people = 2;
    const totals = Array(people).fill(0);
    items.forEach(it => {
      totals[it.person] += it.unit * it.qty;
    });
    
    expect(totals[0]).toBe(35);
    expect(totals[1]).toBe(25);
    
    const subtotal = 60;
    const service = 6;
    const withService = totals.map(t => t + (service * (t/subtotal)));
    
    expect(withService[0]).toBeCloseTo(38.5);
    expect(withService[1]).toBeCloseTo(27.5);
    expect(withService[0] + withService[1]).toBeCloseTo(66);
  });

  it("getOrderModality detecta mesa corretamente", () => {
    const mesaOrder = {
      type: "dine_in",
      tableNumber: 3,
      customer: { addr: "Mesa 03", name: "Mesa 03 · Maria" }
    };
    const mod = getOrderModality(mesaOrder);
    expect(mod.isMesa).toBe(true);
    expect(mod.badge).toContain("MESA");
    
    const deliveryOrder = {
      type: "delivery",
      customer: { addr: "Rua das Flores, 123" }
    };
    const mod2 = getOrderModality(deliveryOrder);
    expect(mod2.isMesa).toBe(false);
    expect(mod2.id).toBe("delivery");
  });

  it("transferência de mesa", () => {
    const orders = [
      { id: "o1", status: "NOVO", tableNumber: 1, payment: "No fechamento da mesa", customer: { addr: "Mesa 01" } },
      { id: "o2", status: "NOVO", tableNumber: 2, payment: "No fechamento da mesa", customer: { addr: "Mesa 02" } },
    ];
    
    const targetTable = 3;
    const transferred = orders.map(o => {
      if (o.tableNumber === 1) return { ...o, tableNumber: targetTable, tableName: `Mesa ${String(targetTable).padStart(2,"0")}` };
      return o;
    });
    
    const byMesa = buildMesaIndex(transferred);
    expect(byMesa.get(1)).toBeUndefined();
    expect(byMesa.get(3).length).toBe(1);
    expect(byMesa.get(2).length).toBe(1);
  });
});

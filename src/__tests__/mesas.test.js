import { describe, it, expect } from "vitest";

// Funções extraídas de App.jsx para teste isolado - agora com regra de pagamento
function extractNum(s) {
  const m = String(s || "").match(/Mesa\s*0?(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function isTableOccupied(o) {
  if (!o) return false;
  if (o.status === "CANCELADO") return false;
  const payment = o.payment || "";
  if (payment === "No fechamento da mesa") return true;
  if (o.status === "ENTREGUE") return false;
  return true;
}

function filterByMesa(orders, targetNum) {
  const byMesa = new Map();
  for (const o of orders) {
    if (!isTableOccupied(o)) continue;
    let n = o.tableNumber ?? o.table_number ?? null;
    if (n == null) {
      n = extractNum(o.tableName || o.table_name) ?? extractNum(o.customer?.addr) ?? extractNum(o.customer?.name);
    }
    if (n != null) {
      const key = parseInt(n,10);
      if (!byMesa.has(key)) byMesa.set(key, []);
      byMesa.get(key).push(o);
    }
  }
  return byMesa.get(targetNum) || [];
}

describe("filtro de mesas - bug todas ocupadas", () => {
  it("isola mesas corretamente", () => {
    const orders = [
      { id: '1', status: 'NOVO', payment: "No fechamento da mesa", type: 'dine_in', customer: { addr: 'Mesa 01', name: 'Mesa 01 · João' }, tableNumber: 1 },
      { id: '2', status: 'NOVO', payment: "No fechamento da mesa", type: 'dine_in', customer: { addr: 'Mesa 02', name: 'Mesa 02 · Maria' }, tableNumber: 2 },
    ];
    expect(filterByMesa(orders, 1).length).toBe(1);
    expect(filterByMesa(orders, 2).length).toBe(1);
    expect(filterByMesa(orders, 3).length).toBe(0);
  });

  it("não confunde Mesa 1 com Mesa 10", () => {
    const orders = [
      { id: '10', status: 'NOVO', payment: "No fechamento da mesa", customer: { addr: 'Mesa 01' }, tableNumber: 1 },
      { id: '11', status: 'NOVO', payment: "No fechamento da mesa", customer: { addr: 'Mesa 10' }, tableNumber: 10 },
    ];
    expect(filterByMesa(orders, 1).map(o=>o.id)).toEqual(['10']);
    expect(filterByMesa(orders, 10).map(o=>o.id)).toEqual(['11']);
  });

  it("suporta variações de nome", () => {
    expect(extractNum('Mesa 01')).toBe(1);
    expect(extractNum('Mesa 1')).toBe(1);
    expect(extractNum('Mesa 01 · João Silva')).toBe(1);
    expect(extractNum('Mesa 10')).toBe(10);
    expect(extractNum('Rua das Palmeiras')).toBe(null);
  });

  it("20 mesas isoladas", () => {
    const orders = Array.from({length:20}, (_,i)=>({
      id: `o${i+1}`, status:'NOVO', payment: "No fechamento da mesa", tableNumber: i+1, customer:{addr:`Mesa ${String(i+1).padStart(2,'0')}`}
    }));
    for (let n=1;n<=20;n++) {
      expect(filterByMesa(orders, n).length).toBe(1);
    }
  });

  it("mesa só libera quando paga", () => {
    const pending = { id: '1', status: 'ENTREGUE', payment: "No fechamento da mesa", tableNumber: 1, customer: { addr: 'Mesa 01' } };
    const paid = { id: '2', status: 'ENTREGUE', payment: "PIX", tableNumber: 2, customer: { addr: 'Mesa 02' } };
    expect(isTableOccupied(pending)).toBe(true);
    expect(isTableOccupied(paid)).toBe(false);
    expect(filterByMesa([pending], 1).length).toBe(1);
    expect(filterByMesa([paid], 2).length).toBe(0);
  });
});

describe("getOrderModality", () => {
  function getModality(o) {
    const hasTableNum = o.tableNumber != null || o.table_number != null;
    const hasTableName = o.tableName || o.table_name;
    const isMesa = hasTableNum || hasTableName || o.type==="dine_in" || o.type==="mesa" || /^Mesa \d+/i.test(o.customer?.addr||"");
    return { isMesa };
  }
  it("detecta mesa por tableNumber", () => {
    expect(getModality({ tableNumber: 5, type:'dine_in', customer:{}}).isMesa).toBe(true);
    expect(getModality({ type:'delivery', customer:{addr:'Rua A'}}).isMesa).toBe(false);
  });
});

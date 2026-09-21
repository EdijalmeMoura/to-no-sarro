export function extractTableNumber(s) {
  const m = String(s || "").match(/Mesa\s*0?(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

export function getOrderTableNumber(order) {
  if (!order) return null;
  let n = order.tableNumber ?? order.table_number ?? null;
  if (n != null) return parseInt(n,10);
  n = extractTableNumber(order.tableName || order.table_name);
  if (n != null) return n;
  n = extractTableNumber(order.customer?.addr);
  if (n != null) return n;
  n = extractTableNumber(order.customer?.name);
  return n;
}

export function buildMesaIndex(orders) {
  const byMesa = new Map();
  for (const o of orders) {
    if (["ENTREGUE","CANCELADO"].includes(o.status)) continue;
    const n = getOrderTableNumber(o);
    if (n != null) {
      const key = parseInt(n,10);
      if (!byMesa.has(key)) byMesa.set(key, []);
      byMesa.get(key).push(o);
    }
  }
  return byMesa;
}

export function filterOrdersByMesa(orders, tableNum) {
  const idx = buildMesaIndex(orders);
  return idx.get(parseInt(tableNum,10)) || [];
}

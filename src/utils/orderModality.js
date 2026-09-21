export function getOrderModality(o) {
  if (!o) return { id: "delivery", label: "DELIVERY", badge: "DELIVERY", color: "#f58200", bg: "#ea580c22", border: "#f58200", icon: "🛵", isMesa: false, isPickup: false, instruction: "EMBALAGEM DE VIAGEM" };
  const hasTableNum = o.tableNumber != null || o.table_number != null;
  const hasTableName = o.tableName || o.table_name;
  const isMesa = hasTableNum || hasTableName || o.type === "dine_in" || o.type === "mesa" || /^Mesa \d+/i.test(o.customer?.addr || "") || /^Mesa \d+/i.test(o.customer?.name || "");
  if (isMesa) {
    const num = o.tableNumber ?? o.table_number;
    let mesaTag = hasTableName ? (o.tableName || o.table_name).toUpperCase() : null;
    if (!mesaTag) {
      const match = (o.customer?.addr || o.customer?.name || "").match(/Mesa \d+/i);
      mesaTag = match ? match[0].toUpperCase() : (num ? `MESA ${String(num).padStart(2, "0")}` : "SALÃO");
    }
    return {
      id: "mesa",
      label: `SALÃO · ${mesaTag}`,
      badge: mesaTag,
      color: "#10b981",
      bg: "#064e3b33",
      border: "#10b981",
      icon: "🍽️",
      isMesa: true,
      isPickup: false,
      instruction: "SERVIÇO NO SALÃO (NÃO EMBALAR)",
      tableNumber: num ?? null,
    };
  }
  const isPickup = o.type === "pickup" || /Retirada/i.test(o.customer?.addr || "");
  if (isPickup) {
    return {
      id: "pickup",
      label: "BALCÃO · RETIRADA",
      badge: "BALCÃO",
      color: "#3b82f6",
      bg: "#1d4ed833",
      border: "#3b82f6",
      icon: "🏪",
      isMesa: false,
      isPickup: true,
      instruction: "RETIRADA NO BALCÃO",
    };
  }
  return {
    id: "delivery",
    label: "DELIVERY",
    badge: "DELIVERY",
    color: "#f58200",
    bg: "#ea580c22",
    border: "#f58200",
    icon: "🛵",
    isMesa: false,
    isPickup: false,
    instruction: "EMBALAGEM DE VIAGEM",
  };
}

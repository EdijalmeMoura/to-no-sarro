import React from "react";
import { C, brl, Card } from "./_shared.jsx";
import { Table } from "./_shared.jsx";

export default function AdminCustomers({ store }) {
  const tierColor = { VIP: C.yellowLight, Recorrente: C.green, Novo: C.blue, Inativo: "#7a7a7a" };
  return (
    <Card className="p-1">
      <Table cols={["Cliente", "WhatsApp", "Pedidos", "Gasto", "Ticket médio", "Último", "Classificação"]} rows={store.customers.map((c) => [c.name, c.phone, c.orders, brl(c.spent), brl(c.spent / c.orders), c.last, <span key="t" style={{ color: tierColor[c.tier], fontWeight: 800, fontSize: 11.5 }}>{c.tier.toUpperCase()}</span>])} />
    </Card>
  );
}

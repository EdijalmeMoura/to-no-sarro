import React, { useState, useEffect, useMemo, useRef } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";
import ServiceChargeCard from "./ServiceChargeCard.jsx";
import WaiterReport from "./WaiterReport.jsx";
import LowStockAlerts from "./LowStockAlerts.jsx";

function AdminReports({ store, now }) {
  const [range, setRange] = useState("7");
  const from = rangeStart(range, now);
  const orders = store.orders.filter((o) => o.createdAt >= from);

  const dayMap = new Map();
  orders.forEach((o) => {
    const k = new Date(o.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const cur = dayMap.get(k) || { n: 0, total: 0 };
    cur.n += 1;
    if (o.status !== "CANCELADO") cur.total += o.total;
    dayMap.set(k, cur);
  });
  const salesRows = [...dayMap.entries()]
    .sort((a, b) => (a[0].split("/").reverse().join("") > b[0].split("/").reverse().join("") ? 1 : -1))
    .map(([d, v]) => [d, v.n, brl(v.total), brl(v.n ? v.total / v.n : 0)]);

  const prodMap = new Map();
  orders.filter((o) => o.status !== "CANCELADO").forEach((o) =>
    o.items.forEach((i) => {
      const cur = prodMap.get(i.name) || { qty: 0, total: 0 };
      cur.qty += i.qty;
      cur.total += i.unit * i.qty;
      prodMap.set(i.name, cur);
    })
  );
  const productRows = [...prodMap.entries()].sort((a, b) => b[1].qty - a[1].qty)
    .map(([name, v]) => [name, v.qty, brl(v.total)]);

  const paySet = [...new Set(orders.filter((o) => o.status !== "CANCELADO").map((o) => o.payment))];
  const payRows = paySet.map((pay) => {
    const list = orders.filter((o) => o.payment === pay && o.status !== "CANCELADO");
    return [pay, list.length, brl(list.reduce((s, o) => s + o.total, 0))];
  });
  const channelRows = Object.keys(CHANNELS).map((k) => {
    const list = orders.filter((o) => o.channel === k && o.status !== "CANCELADO");
    return [CHANNELS[k].label, list.length, brl(list.reduce((s, o) => s + o.total, 0))];
  });

  const driverRows = store.drivers.map((d) => {
    const done = orders.filter((o) => o.driverId === d.id && o.status === "ENTREGUE");
    return [d.name, d.vehicle, done.length, brl(done.reduce((s, o) => s + o.total, 0))];
  });

  const customerRows = store.customers.slice(0, 10).map((c) => [
    c.name, c.phone, c.orders, brl(c.spent), c.tier,
  ]);

  const canceledRows = orders.filter((o) => o.status === "CANCELADO")
    .map((o) => [`#${o.code}`, o.customer.name, brl(o.total), fmtDT(o.createdAt), CHANNELS[o.channel]?.short || o.channel]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span style={{ color: "#8a8a8a", fontSize: 12 }}>Período:</span>
        {RANGES.map(([id, lbl]) => (
          <Btn key={id} small variant={range === id ? "primary" : "dark"} onClick={() => setRange(id)}>{lbl}</Btn>
        ))}
      </div>

      <ReportCard title="Vendas por dia" cols={["Dia", "Pedidos", "Faturamento", "Ticket médio"]} rows={salesRows} csvName="sarro-vendas.csv" />
      <ReportCard title="Produtos vendidos" cols={["Produto", "Qtd", "Receita"]} rows={productRows} csvName="sarro-produtos.csv" />
      <div className="grid lg:grid-cols-2 gap-3">
        <ReportCard title="Formas de pagamento" cols={["Pagamento", "Pedidos", "Total"]} rows={payRows} csvName="sarro-pagamentos.csv" />
        <ReportCard title="Canais de venda" cols={["Canal", "Pedidos", "Total"]} rows={channelRows} csvName="sarro-canais.csv" />
        <ReportCard title="Entregadores" cols={["Entregador", "Veículo", "Entregas", "Valor entregue"]} rows={driverRows} csvName="sarro-entregadores.csv" />
        <ReportCard title="Top clientes" cols={["Cliente", "WhatsApp", "Pedidos", "Gasto", "Classe"]} rows={customerRows} csvName="sarro-clientes.csv" />
      </div>
      <ReportCard title="Cancelamentos" cols={["Pedido", "Cliente", "Valor", "Quando", "Canal"]} rows={canceledRows} csvName="sarro-cancelamentos.csv" />
    </div>
  );
}

// Interruptor pequeno de ativar/pausar (cupons, promos, usuários)

export default AdminReports;

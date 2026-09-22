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

function AdminFinance({ store, now }) {
  const [range, setRange] = useState("hoje");
  const from = rangeStart(range, now);

  const valid = store.orders.filter((o) => o.createdAt >= from && o.status !== "CANCELADO");
  const canceled = store.orders.filter((o) => o.createdAt >= from && o.status === "CANCELADO");
  const revenue = valid.reduce((s, o) => s + o.total, 0);
  const discounts = valid.reduce((s, o) => s + o.discount, 0);
  const fees = valid.reduce((s, o) => s + o.fee, 0);
  const ticket = valid.length ? revenue / valid.length : 0;
  const canceledValue = canceled.reduce((s, o) => s + o.total, 0);

  const byDay = {};
  valid.forEach((o) => {
    const k = new Date(o.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    byDay[k] = (byDay[k] || 0) + o.total;
  });
  const dayData = Object.entries(byDay)
    .sort((a, b) => (a[0].split("/").reverse().join("") > b[0].split("/").reverse().join("") ? 1 : -1))
    .slice(-14)
    .map(([d, v]) => ({ d, v: Math.round(v) }));

  const groupSum = (keyFn) => {
    const m = new Map();
    valid.forEach((o) => {
      const k = keyFn(o);
      m.set(k, (m.get(k) || 0) + o.total);
    });
    const total = [...m.values()].reduce((s, v) => s + v, 0) || 1;
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v, pct: Math.round((v / total) * 100) }));
  };
  const payments = groupSum((o) => o.payment.replace(/\s*\(.*\)/, ""));
  const channels = groupSum((o) => CHANNELS[o.channel]?.label || o.channel);
  const types = groupSum((o) => (o.type === "pickup" ? "Retirada" : "Delivery"));

  const exportCSV = () => {
    downloadCSV(`financeiro-sarro-${range}.csv`, [
      ["TÔ NO SARRO! — Financeiro"],
      ["Período", RANGES.find((r) => r[0] === range)?.[1] || range],
      [],
      ["Indicador", "Valor"],
      ["Faturamento", revenue.toFixed(2)],
      ["Pedidos válidos", valid.length],
      ["Ticket médio", ticket.toFixed(2)],
      ["Descontos concedidos", discounts.toFixed(2)],
      ["Taxas de entrega", fees.toFixed(2)],
      ["Cancelados", `${canceled.length} (${canceledValue.toFixed(2)})`],
      [],
      ["Dia", "Faturamento"],
      ...dayData.map((d) => [d.d, d.v.toFixed(2)]),
      [],
      ["Forma de pagamento", "Total", "%"],
      ...payments.map((p) => [p.k, p.v.toFixed(2), `${p.pct}%`]),
      [],
      ["Canal", "Total", "%"],
      ...channels.map((p) => [p.k, p.v.toFixed(2), `${p.pct}%`]),
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map(([id, lbl]) => (
          <Btn key={id} small variant={range === id ? "primary" : "dark"} onClick={() => setRange(id)}>{lbl}</Btn>
        ))}
        <div className="flex-1" />
        <Btn small variant="dark" onClick={exportCSV}>⬇ Exportar CSV/Excel</Btn>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KPI icon="💰" label={`Faturamento (${RANGES.find((r) => r[0] === range)?.[1]})`} value={brl(revenue)} accent={C.yellowLight} />
        <KPI icon="🧾" label="Pedidos válidos" value={valid.length} />
        <KPI icon="📦" label="Ticket médio" value={brl(ticket)} />
        <KPI icon="🎟" label="Descontos concedidos" value={brl(discounts)} accent={C.orange} />
        <KPI icon="🛵" label="Taxas de entrega" value={brl(fees)} />
        <KPI icon="❌" label={`Cancelados · ${brl(canceledValue)}`} value={canceled.length} accent={canceled.length ? C.red : C.white} />
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Faturamento por dia</div>
          {dayData.length ? <BarChart data={dayData} xKey="d" vKey="v" /> : <div style={{ color: "#6a6a6a", fontSize: 12 }}>Sem vendas no período.</div>}
        </Card>
        <Card className="p-4">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Formas de pagamento</div>
          {payments.length ? payments.map((p) => (
            <div key={p.k} className="mb-2.5">
              <div className="flex justify-between" style={{ fontSize: 12 }}>
                <span style={{ color: "#d0d0d0" }}>{p.k}</span>
                <span style={{ color: C.yellowLight, fontWeight: 800 }}>{brl(p.v)} · {p.pct}%</span>
              </div>
              <div style={{ height: 6, background: C.gray800, borderRadius: 9, marginTop: 4 }}>
                <div style={{ width: `${p.pct}%`, height: "100%", borderRadius: 9, background: `linear-gradient(90deg, ${C.orange}, ${C.yellow})` }} />
              </div>
            </div>
          )) : <div style={{ color: "#6a6a6a", fontSize: 12 }}>Sem dados.</div>}
        </Card>
        <Card className="p-4">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Por canal</div>
          {channels.length ? <Donut slices={channels.map((c, i) => ({ label: c.k, v: c.v, color: [C.orange, C.yellow, "#25D366", C.blue][i % 4] }))} size={130} /> : <div style={{ color: "#6a6a6a", fontSize: 12 }}>Sem dados.</div>}
        </Card>
        <Card className="p-4">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Delivery x Retirada</div>
          {types.length ? <Donut slices={types.map((t, i) => ({ label: t.k, v: t.v, color: i ? C.blue : C.orange }))} size={130} /> : <div style={{ color: "#6a6a6a", fontSize: 12 }}>Sem dados.</div>}
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// RELATÓRIOS — tabelas com exportação CSV e impressão A4
// ============================================================


export default AdminFinance;

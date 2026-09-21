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

function AdminDashboard({ store, now, setSec }) {
  const today = store.orders.filter((o) => o.status !== "CANCELADO");
  const revenue = today.reduce((s, o) => s + o.total, 0);
  const avg = today.length ? revenue / today.length : 0;
  const counts = (st) => store.orders.filter((o) => o.status === st).length;

  const byChannel = Object.keys(CHANNELS).map((k) => ({
    label: CHANNELS[k].label, color: CHANNELS[k].color,
    v: store.orders.filter((o) => o.channel === k).length || 0.001,
  }));

  const sold = {};
  store.orders.forEach((o) => o.items.forEach((i) => { sold[i.name] = (sold[i.name] || 0) + i.qty; }));
  const top = Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const live = [
    { label: "Aguardando", v: counts("NOVO"), color: C.yellowLight },
    { label: "Na cozinha", v: counts("CONFIRMADO") + counts("PREPARO"), color: C.orange },
    { label: "Prontos", v: counts("PRONTO") + counts("EMBALADO"), color: C.green },
    { label: "Aguardando entregador", v: counts("AGUARDANDO"), color: C.blue },
    { label: "Em entrega", v: counts("ROTA"), color: "#7C5CFF" },
  ];

  return (
    <div className="space-y-4">
      {/* Status da Frente de Caixa */}
      <div className="flex items-center justify-between p-3.5 rounded-xl text-xs transition" style={{ background: C.gray900, border: `1px solid ${C.gray800}` }}>
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{store.cashRegister?.status === "OPEN" ? "💵" : "🔒"}</span>
          <div>
            <div className="text-white font-bold">
              {store.cashRegister?.status === "OPEN" ? "Frente de Caixa: TURNO EM ANDAMENTO" : "Frente de Caixa: FECHADO"}
            </div>
            <div className="text-gray-400 text-[11px]">
              {store.cashRegister?.status === "OPEN"
                ? `Operador: ${store.cashRegister.openedBy} · Esperado na gaveta: ${brl(store.cashRegister.summary?.expectedCash || 0)}`
                : "Abra o caixa para iniciar o turno de recebimento no balcão"}
            </div>
          </div>
        </div>
        {setSec && (
          <Btn small variant={store.cashRegister?.status === "OPEN" ? "dark" : "primary"} onClick={() => setSec("caixa")}>
            {store.cashRegister?.status === "OPEN" ? "Ver Caixa ➔" : "Abrir Caixa ➔"}
          </Btn>
        )}
      </div>

      <Card className="p-4" style={{ borderColor: `${C.orange}55`, background: `linear-gradient(120deg, ${C.orange}14, ${C.gray850})` }}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ width: 8, height: 8, borderRadius: 99, background: C.green, display: "inline-block", animation: "sarropulse 1.6s infinite" }} />
          <span style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Operação agora</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {live.map((l) => (
            <div key={l.label} className="rounded-xl p-3" style={{ background: C.black, border: `1px solid ${l.color}33` }}>
              <div style={{ color: l.color, fontWeight: 900, fontSize: 25 }}>{String(l.v).padStart(2, "0")}</div>
              <div style={{ color: "#8a8a8a", fontSize: 10.5, marginTop: 2 }}>{l.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KPI icon="💰" label="Vendas hoje" value={brl(revenue)} sub="+18%" accent={C.yellowLight} />
        <KPI icon="🍔" label="Pedidos hoje" value={today.length} sub="+6%" />
        <KPI icon="📦" label="Ticket médio" value={brl(avg)} />
        <KPI icon="👥" label="Clientes na base" value={store.customers.length} />
        <KPI icon="🛵" label="Entregas em rota" value={counts("ROTA")} />
        <KPI icon="⏱" label="Tempo médio de preparo" value="18 min" />
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Vendas por hora</div>
          <BarChart data={SALES_BY_HOUR} xKey="h" vKey="v" />
        </Card>
        <Card className="p-4">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Vendas na semana</div>
          <BarChart data={SALES_BY_DAY} xKey="d" vKey="v" />
        </Card>
        <Card className="p-4">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Pedidos por canal</div>
          <Donut slices={byChannel} />
        </Card>
        <Card className="p-4">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Produtos mais vendidos</div>
          <div className="space-y-2.5">
            {top.map(([name, qty], i) => (
              <div key={name}>
                <div className="flex justify-between" style={{ fontSize: 12 }}>
                  <span style={{ color: "#d0d0d0" }}>{name}</span>
                  <span style={{ color: C.yellowLight, fontWeight: 800 }}>{qty}</span>
                </div>
                <div style={{ height: 6, background: C.gray800, borderRadius: 9, marginTop: 4 }}>
                  <div style={{ width: `${(qty / top[0][1]) * 100}%`, height: "100%", borderRadius: 9, background: `linear-gradient(90deg, ${C.orange}, ${C.yellow})` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <WaiterReport store={store} now={now} />
        <LowStockAlerts store={store} />
      </div>
    </div>
  );
}


export default AdminDashboard;

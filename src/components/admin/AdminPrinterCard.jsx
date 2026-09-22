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

function AdminPrinterCard({ store }) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("9100");
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api("/api/settings/printer").then((d) => { setInfo(d); setHost(d.host || ""); setPort(d.port || "9100"); }).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async (extra = {}) => {
    setBusy(true);
    try {
      await api("/api/settings", { method: "PATCH", body: { printer_host: host, printer_port: port, ...extra } });
      await load();
      store.toast("Impressora salva ✓");
    } catch (e) { store.toast(e.message); }
    setBusy(false);
  };

  const test = async () => {
    setBusy(true);
    try {
      await api("/api/print/test", { method: "POST" });
      store.toast("Página de teste enviada ✓");
    } catch (e) { store.toast(e.message); }
    setBusy(false);
  };

  const enabled = info?.enabled;
  return (
    <Card className="p-4" style={{ borderColor: `${C.orange}44` }}>
      <div className="flex items-center justify-between">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>🖨 Impressora térmica</div>
        <span
          className="rounded-full px-2.5 py-1 font-bold"
          style={{
            fontSize: 10,
            background: info?.configured ? `${C.green}1f` : `${C.yellow}1f`,
            color: info?.configured ? C.green : C.yellow,
            border: `1px solid ${info?.configured ? C.green : C.yellow}44`,
          }}
        >
          {info?.configured ? "CONECTADA" : "NÃO CONFIGURADA"}
        </span>
      </div>
      <div style={{ color: "#8a8a8a", fontSize: 11.5, marginTop: 6, lineHeight: 1.5 }}>
        Imprime comandas direto na térmica ESC/POS de rede (80mm, porta 9100) —
        sem diálogo do navegador. Sem impressora, os botões usam a impressão do navegador.
      </div>
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-2 block">
            <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>IP da impressora</span>
            <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="ex.: 192.168.0.110"
              className="w-full rounded-lg px-2.5 py-2 mt-1 outline-none"
              style={{ background: C.black, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12.5 }} />
          </label>
          <label className="block">
            <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Porta</span>
            <input value={port} onChange={(e) => setPort(e.target.value)}
              className="w-full rounded-lg px-2.5 py-2 mt-1 outline-none"
              style={{ background: C.black, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12.5 }} />
          </label>
        </div>
        {host.trim() && (
          <div className="flex gap-2 flex-wrap">
            <Btn small variant={enabled ? "dark" : "green"} disabled={busy} onClick={() => save({ printer_enabled: !enabled })}>
              {enabled ? "⏸ Desativar" : "▶ Ativar"}
            </Btn>
            <Btn small variant={info?.auto ? "dark" : "primary"} disabled={busy} onClick={() => save({ printer_auto: !info?.auto })}>
              {info?.auto ? "Auto-print ON (clique p/ desligar)" : "Auto-print OFF (clique p/ ligar)"}
            </Btn>
          </div>
        )}
        <div className="flex gap-2">
          <Btn small disabled={busy} onClick={() => save()}>Salvar</Btn>
          <Btn small variant="dark" disabled={busy || !host.trim()} onClick={test}>Testar impressão</Btn>
        </div>
      </div>
    </Card>
  );
}

export default AdminPrinterCard;

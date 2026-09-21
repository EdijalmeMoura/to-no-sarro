import React, { useState, useEffect, useMemo, useRef } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";
import ServiceChargeCard from "./ServiceChargeCard.jsx";

function AdminModalitiesCard({ store }) {
  const [busy, setBusy] = useState(false);
  const tablesOn = !!store.settings?.tablesEnabled;
  const count = store.settings?.tablesCount || 10;
  const [tablesCount, setTablesCount] = useState(count);

  useEffect(() => {
    if (store.settings?.tablesCount) setTablesCount(store.settings.tablesCount);
  }, [store.settings?.tablesCount]);

  const toggle = async () => {
    setBusy(true);
    try {
      const next = !tablesOn;
      await api("/api/settings", { method: "PATCH", body: { tables_enabled: next } });
      store.toast(next ? "🍽️ Módulo de Mesas ATIVADO! Visível no menu lateral." : "Módulo de Mesas desativado.");
    } catch (e) {
      store.toast(e.message);
    }
    setBusy(false);
  };

  const saveCount = async () => {
    setBusy(true);
    try {
      const val = parseInt(tablesCount, 10) || 10;
      await api("/api/settings", { method: "PATCH", body: { tables_count: val } });
      store.toast(`Capacidade atualizada: ${val} mesas no salão.`);
    } catch (e) {
      store.toast(e.message);
    }
    setBusy(false);
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>
          🍽️ Modalidades de Atendimento
        </div>
        <span
          className="rounded-full px-2.5 py-1 font-bold text-xs"
          style={{
            background: tablesOn ? "#16653433" : C.gray800,
            color: tablesOn ? C.green : "#888",
            border: `1px solid ${tablesOn ? C.green : C.gray700}`,
          }}
        >
          {tablesOn ? "MESAS ATIVAS" : "MESAS DESATIVADAS"}
        </span>
      </div>

      <p style={{ color: "#8a8a8a", fontSize: 11.5, lineHeight: 1.5 }}>
        Controle se o seu estabelecimento atende mesas / salão presencial.
        Quando ativado, a opção <strong>🍽️ Mesas / Salão</strong> fica visível no menu lateral do Admin.
      </p>

      <div className="p-3.5 rounded-xl flex items-center justify-between" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
        <div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>
            Atendimento em Mesas / Salão
          </div>
          <div style={{ color: "#7a7a7a", fontSize: 11, marginTop: 2 }}>
            {tablesOn ? "Habilitado — exibindo no menu lateral com comandas e KDS" : "Desabilitado — oculto no menu lateral"}
          </div>
        </div>

        <button
          onClick={toggle}
          disabled={busy}
          className="rounded-full transition active:scale-95 shrink-0 ml-3"
          style={{
            width: 48,
            height: 26,
            background: tablesOn ? C.green : C.gray700,
            position: "relative",
          }}
          title={tablesOn ? "Clique para desativar modalidade de mesas" : "Clique para ativar modalidade de mesas"}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: tablesOn ? 25 : 3,
              width: 20,
              height: 20,
              borderRadius: 99,
              background: C.white,
              transition: "left .2s",
            }}
          />
        </button>
      </div>

      {tablesOn && (
        <div className="p-3.5 rounded-xl flex items-center justify-between gap-3" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
          <div>
            <div style={{ color: C.white, fontWeight: 700, fontSize: 12.5 }}>Número total de mesas</div>
            <div style={{ color: "#7a7a7a", fontSize: 11 }}>Capacidade do salão (1 a 50 mesas)</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="50"
              value={tablesCount}
              onChange={(e) => setTablesCount(e.target.value)}
              className="rounded-lg px-2 py-1 text-center outline-none font-bold text-white text-xs"
              style={{ width: 55, background: C.black, border: `1px solid ${C.gray700}` }}
            />
            <Btn small variant="dark" disabled={busy} onClick={saveCount}>Salvar</Btn>
          </div>
        </div>
      )}
    </Card>
  );
}


export default AdminModalitiesCard;

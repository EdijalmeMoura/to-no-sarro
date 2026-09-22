import React, { useState, useEffect } from "react";
import { C } from "../../constants/theme.js";
import { api } from "../../utils/api.js";
import { Card, Btn } from "../ui/index.jsx";

export default function AdminModalitiesCard({ store }) {
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
      store.toast(next ? "🍽️ Módulo de Mesas ATIVADO! Agora visível no menu lateral." : "🍽️ Módulo de Mesas desativado.");
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
    <Card className="p-4 sm:p-5 space-y-4" style={{ borderColor: tablesOn ? `${C.green}55` : `${C.gray700}`, borderWidth: 2 }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: tablesOn ? `${C.green}22` : C.gray850, border: `1px solid ${tablesOn ? C.green : C.gray800}` }}>🍽️</div>
          <div>
            <div style={{ color: C.white, fontWeight: 900, fontSize: 16 }} className="flex items-center gap-2">
              Modalidades de Atendimento
              <span className="rounded-full px-2.5 py-0.5 font-bold text-[10px]" style={{ background: tablesOn ? "#16653433" : C.gray800, color: tablesOn ? C.green : "#888", border: `1px solid ${tablesOn ? C.green : C.gray700}` }}>
                {tablesOn ? "● MESAS ATIVAS" : "○ MESAS DESATIVADAS"}
              </span>
            </div>
            <div style={{ color: "#8a8a8a", fontSize: 11.5, marginTop: 2 }}>Ative ou desative o atendimento em mesas / salão presencial</div>
          </div>
        </div>
        <Btn variant={tablesOn ? "dark" : "primary"} small onClick={toggle} disabled={busy} className="w-full sm:w-auto">
          {busy ? "..." : tablesOn ? "⏸ Desativar Mesas" : "▶ Ativar Mesas"}
        </Btn>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="p-3.5 sm:p-4 rounded-xl flex items-center justify-between gap-3" style={{ background: C.black, border: `1px solid ${C.gray800}` }}>
          <div className="min-w-0">
            <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }} className="truncate">Atendimento em Mesas / Salão</div>
            <div style={{ color: "#7a7a7a", fontSize: 11, marginTop: 2 }} className="leading-snug">
              {tablesOn ? "Habilitado — visível no menu lateral com comandas, KDS e comandas" : "Desabilitado — oculto no menu lateral"}
            </div>
          </div>
          <button
            onClick={toggle}
            disabled={busy}
            className="rounded-full transition active:scale-95 shrink-0"
            style={{ width: 52, height: 28, background: tablesOn ? C.green : C.gray700, position: "relative" }}
            title={tablesOn ? "Desativar mesas" : "Ativar mesas"}
          >
            <span style={{ position: "absolute", top: 3, left: tablesOn ? 27 : 3, width: 22, height: 22, borderRadius: 99, background: C.white, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
          </button>
        </div>

        <div className="p-3.5 sm:p-4 rounded-xl flex flex-col justify-center gap-2" style={{ background: C.gray850, border: `1px solid ${C.gray800}`, opacity: tablesOn ? 1 : 0.5 }}>
          <div style={{ color: C.white, fontWeight: 700, fontSize: 12.5 }}>Número total de mesas</div>
          <div style={{ color: "#7a7a7a", fontSize: 11 }}>Capacidade do salão (1 a 50)</div>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              min="1"
              max="50"
              disabled={!tablesOn}
              value={tablesCount}
              onChange={(e) => setTablesCount(e.target.value)}
              className="rounded-lg px-2 py-1.5 text-center outline-none font-bold text-white text-sm"
              style={{ width: 70, background: C.black, border: `1px solid ${C.gray700}` }}
            />
            <Btn small variant="dark" disabled={busy || !tablesOn} onClick={saveCount}>Salvar</Btn>
            {tablesOn && <span style={{ color: "#666", fontSize: 10 }}>{tablesCount} mesas</span>}
          </div>
        </div>
      </div>

      {!tablesOn && (
        <div className="rounded-lg px-3 py-2.5 text-xs" style={{ background: `${C.yellow}12`, border: `1px solid ${C.yellow}33`, color: C.yellow }}>
          💡 Dica: quando desativado, o item “Mesas / Salão” fica oculto no menu lateral, mas você pode reativar a qualquer momento aqui.
        </div>
      )}
    </Card>
  );
}

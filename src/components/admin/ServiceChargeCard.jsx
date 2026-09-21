import React, { useState, useEffect } from "react";
import { C } from "../../constants/theme.js";
import { Card, Btn } from "../ui/index.jsx";
import { api } from "../../utils/api.js";

export default function ServiceChargeCard({ store }) {
  const [enabled, setEnabled] = useState(store.settings?.serviceChargeEnabled || false);
  const [percent, setPercent] = useState(String(store.settings?.serviceChargePercent || 10));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (store.settings) {
      setEnabled(!!store.settings.serviceChargeEnabled);
      if (store.settings.serviceChargePercent) setPercent(String(store.settings.serviceChargePercent));
    }
  }, [store.settings?.serviceChargeEnabled, store.settings?.serviceChargePercent]);

  const save = async () => {
    setBusy(true);
    try {
      const p = parseFloat(String(percent).replace(",", ".")) || 10;
      if (p < 0 || p > 30) throw new Error("Percentual deve ser entre 0 e 30%");
      await api("/api/settings", {
        method: "PATCH",
        body: {
          service_charge_enabled: enabled,
          service_charge_percent: p,
        },
      });
      store.toast(`Taxa de serviço ${enabled ? `ativada (${p}%)` : "desativada"} ✓`);
      await store.refreshSettings?.();
    } catch (e) {
      store.toast(e.message);
    }
    setBusy(false);
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>💰 Taxa de Serviço</div>
        <span className="rounded-full px-2.5 py-1 font-bold text-xs" style={{ background: enabled ? "#16653433" : C.gray800, color: enabled ? C.green : "#888", border: `1px solid ${enabled ? C.green : C.gray700}` }}>
          {enabled ? `ATIVA ${percent}%` : "DESATIVADA"}
        </span>
      </div>

      <p style={{ color: "#8a8a8a", fontSize: 11.5, lineHeight: 1.5 }}>
        Quando ativada, a taxa de serviço é sugerida automaticamente nas mesas e na impressão da pré-conta. O cliente pode optar por não pagar (conforme lei). Valor vai para garçons.
      </p>

      <div className="p-3.5 rounded-xl flex items-center justify-between" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
        <div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>Cobrar taxa de serviço nas mesas</div>
          <div style={{ color: "#7a7a7a", fontSize: 11, marginTop: 2 }}>{enabled ? `Sugerir ${percent}% sobre consumo` : "Desativada — sem sugestão"}</div>
        </div>
        <button onClick={() => setEnabled(!enabled)} disabled={busy} className="rounded-full transition active:scale-95 shrink-0 ml-3" style={{ width: 48, height: 26, background: enabled ? C.green : C.gray700, position: "relative" }}>
          <span style={{ position: "absolute", top: 3, left: enabled ? 25 : 3, width: 20, height: 20, borderRadius: 99, background: C.white, transition: "left .2s" }} />
        </button>
      </div>

      {enabled && (
        <div className="p-3.5 rounded-xl flex items-center justify-between gap-3" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
          <div>
            <div style={{ color: C.white, fontWeight: 700, fontSize: 12.5 }}>Percentual da taxa</div>
            <div style={{ color: "#7a7a7a", fontSize: 11 }}>Padrão 10% — até 30%</div>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min="0" max="30" value={percent} onChange={e => setPercent(e.target.value)} className="rounded-lg px-2 py-1 text-center outline-none font-bold text-white text-xs" style={{ width: 60, background: C.black, border: `1px solid ${C.gray700}` }} />
            <span style={{ color: "#888", fontSize: 12 }}>%</span>
          </div>
        </div>
      )}

      <Btn full small disabled={busy} onClick={save}>{busy ? "Salvando..." : "💾 Salvar taxa de serviço"}</Btn>
    </Card>
  );
}

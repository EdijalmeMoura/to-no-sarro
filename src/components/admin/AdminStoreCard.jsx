import React, { useState, useEffect } from "react";
import { C } from "../../constants/theme.js";
import { api } from "../../utils/api.js";
import { Card, Btn } from "../ui/index.jsx";
import { Row } from "./_shared.jsx";
import {
  DAY_ORDER, DAY_LABELS, normalizeWeekSchedule, summarizeWeek, isScheduleOpenNow,
} from "../../utils/storeHours.js";

export default function AdminStoreCard({ store }) {
  const st = store.settings || {};
  const [name, setName] = useState(st.storeName || "TÔ NO SARRO! Burgers & Açaí");
  const [wa, setWa] = useState(st.whatsapp || "(81) 99999-0000");
  const [addr, setAddr] = useState(st.address || "Av. Cláudio José Gueiros Leite, 3200 — Janga, Paulista/PE");
  const [fee, setFee] = useState(String(st.fee ?? 7.9).replace(".", ","));
  const [minOrder, setMinOrder] = useState(String(st.minOrder ?? 25).replace(".", ","));
  const [eta, setEta] = useState(st.eta || "35–45 min");
  const [sched, setSched] = useState(() => normalizeWeekSchedule(st.weekSchedule));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (store.settings) {
      if (store.settings.storeName) setName(store.settings.storeName);
      if (store.settings.whatsapp) setWa(store.settings.whatsapp);
      if (store.settings.address) setAddr(store.settings.address);
      if (store.settings.fee !== undefined) setFee(String(store.settings.fee).replace(".", ","));
      if (store.settings.minOrder !== undefined) setMinOrder(String(store.settings.minOrder).replace(".", ","));
      if (store.settings.eta) setEta(store.settings.eta);
      if (store.settings.weekSchedule) setSched(normalizeWeekSchedule(store.settings.weekSchedule));
    }
  }, [store.settings]);

  const setDay = (key, patch) =>
    setSched((s) => ({ ...s, [key]: { ...s[key], ...patch } }));

  const save = async () => {
    setBusy(true);
    try {
      const numFee = parseFloat(String(fee).replace(",", ".")) || 0;
      const numMin = parseFloat(String(minOrder).replace(",", ".")) || 0;
      await api("/api/settings", {
        method: "PATCH",
        body: {
          store_name: name.trim(),
          whatsapp: wa.trim(),
          address: addr.trim(),
          hours: summarizeWeek(sched),
          fee: numFee,
          min_order: numMin,
          eta: eta.trim(),
          week_schedule: sched,
        },
      });
      store.toast("Loja salva ✓");
    } catch (e) { store.toast(e.message); }
    setBusy(false);
  };

  const inSchedule = isScheduleOpenNow(sched);
  const fieldStyle = { background: C.black, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12.5 };
  const timeStyle = { ...fieldStyle, width: 96, colorScheme: "dark", textAlign: "center", padding: "4px 6px" };

  const dayToggle = (d) => (
    <button
      onClick={() => setDay(d, { enabled: !sched[d].enabled })}
      className="rounded-full shrink-0"
      style={{ width: 34, height: 19, background: sched[d].enabled ? C.green : C.gray700, position: "relative" }}
      aria-label={`${DAY_LABELS[d]} ${sched[d].enabled ? "ativa" : "inativa"}`}
    >
      <span style={{ position: "absolute", top: 2.5, left: sched[d].enabled ? 17.5 : 2.5, width: 14, height: 14, borderRadius: 99, background: C.white, transition: "left .2s" }} />
    </button>
  );

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>🏪 Loja & Operação</div>
        <Btn small disabled={busy} onClick={save}>{busy ? "Salvando…" : "💾 Salvar loja"}</Btn>
      </div>
      <Row label="Nome da Loja"><input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg px-2.5 py-1.5 outline-none text-right" style={{ ...fieldStyle, width: 230 }} /></Row>
      <Row label="WhatsApp"><input value={wa} onChange={(e) => setWa(e.target.value)} className="rounded-lg px-2.5 py-1.5 outline-none text-right" style={{ ...fieldStyle, width: 150 }} /></Row>
      <Row label="Endereço"><input value={addr} onChange={(e) => setAddr(e.target.value)} className="rounded-lg px-2.5 py-1.5 outline-none text-right" style={{ ...fieldStyle, width: 260 }} /></Row>
      <Row label="Taxa entrega"><div className="flex items-center gap-1.5"><span style={{ color: "#777", fontSize: 12 }}>R$</span><input value={fee} onChange={(e) => setFee(e.target.value)} className="rounded-lg px-2.5 py-1.5 outline-none text-right" style={{ ...fieldStyle, width: 75 }} /></div></Row>
      <Row label="Pedido mínimo"><div className="flex items-center gap-1.5"><span style={{ color: "#777", fontSize: 12 }}>R$</span><input value={minOrder} onChange={(e) => setMinOrder(e.target.value)} className="rounded-lg px-2.5 py-1.5 outline-none text-right" style={{ ...fieldStyle, width: 75 }} /></div></Row>
      <Row label="ETA"><input value={eta} onChange={(e) => setEta(e.target.value)} className="rounded-lg px-2.5 py-1.5 outline-none text-right" style={{ ...fieldStyle, width: 120 }} /></Row>
      <Row label="Loja aberta"><button onClick={() => store.setOpen(!store.open)} className="rounded-full" style={{ width: 44, height: 24, background: store.open ? C.green : C.gray700, position: "relative" }}><span style={{ position: "absolute", top: 3, left: store.open ? 23 : 3, width: 18, height: 18, borderRadius: 99, background: C.white }} /></button></Row>

      {/* ---------- Horários da semana ---------- */}
      <div className="pt-2 mt-1" style={{ borderTop: `1px solid ${C.gray800}` }}>
        <div className="flex items-center justify-between mb-1">
          <div style={{ color: C.white, fontWeight: 900, fontSize: 13.5 }}>📅 Horários da semana</div>
          <span
            className="rounded-full px-2 py-0.5 font-bold"
            style={{
              fontSize: 10,
              background: `${inSchedule && store.open ? C.green : C.red}1f`,
              color: inSchedule && store.open ? C.green : C.red,
              border: `1px solid ${inSchedule && store.open ? C.green : C.red}44`,
            }}
          >
            {store.open ? (inSchedule ? "AGORA: ABERTO" : "AGORA: FECHADO") : "MESTRE DESLIGADO"}
          </span>
        </div>
        <div style={{ color: "#8a8a8a", fontSize: 11, marginBottom: 8, lineHeight: 1.4 }}>
          O cardápio só aceita pedidos com o dia <strong style={{ color: "#ccc" }}>ativo</strong> e dentro do horário de abertura → fechamento.
        </div>
        <div className="space-y-1.5">
          {DAY_ORDER.map((d) => (
            <div key={d} className="flex items-center gap-2">
              {dayToggle(d)}
              <span style={{ color: sched[d].enabled ? C.white : "#666", fontWeight: 800, fontSize: 12, width: 62 }}>
                {DAY_LABELS[d]}
              </span>
              <input
                type="time"
                value={sched[d].open}
                disabled={!sched[d].enabled}
                onChange={(e) => setDay(d, { open: e.target.value })}
                className="rounded-lg px-1 py-1 outline-none"
                style={{ ...timeStyle, opacity: sched[d].enabled ? 1 : 0.4 }}
              />
              <span style={{ color: "#777", fontSize: 12 }}>→</span>
              <input
                type="time"
                value={sched[d].close}
                disabled={!sched[d].enabled}
                onChange={(e) => setDay(d, { close: e.target.value })}
                className="rounded-lg px-1 py-1 outline-none"
                style={{ ...timeStyle, opacity: sched[d].enabled ? 1 : 0.4 }}
              />
            </div>
          ))}
        </div>
      </div>

      <Btn full disabled={busy} onClick={save}>{busy ? "Salvando…" : "💾 Salvar"}</Btn>
    </Card>
  );
}

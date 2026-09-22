import React, { useState, useEffect } from "react";
import { C } from "../../constants/theme.js";
import { api } from "../../utils/api.js";
import { Card, Btn } from "../ui/index.jsx";
import { Row } from "./_shared.jsx";

export default function AdminStoreCard({ store }) {
  const st = store.settings || {};
  const [name, setName] = useState(st.storeName || "TÔ NO SARRO! Burgers & Açaí");
  const [wa, setWa] = useState(st.whatsapp || "(81) 99999-0000");
  const [addr, setAddr] = useState(st.address || "Av. Cláudio José Gueiros Leite, 3200 — Janga, Paulista/PE");
  const [hours, setHours] = useState(st.hours || "Ter a Dom · 18:00 – 23:30");
  const [fee, setFee] = useState(String(st.fee ?? 7.9).replace(".", ","));
  const [minOrder, setMinOrder] = useState(String(st.minOrder ?? 25).replace(".", ","));
  const [eta, setEta] = useState(st.eta || "35–45 min");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (store.settings) {
      if (store.settings.storeName) setName(store.settings.storeName);
      if (store.settings.whatsapp) setWa(store.settings.whatsapp);
      if (store.settings.address) setAddr(store.settings.address);
      if (store.settings.hours) setHours(store.settings.hours);
      if (store.settings.fee !== undefined) setFee(String(store.settings.fee).replace(".", ","));
      if (store.settings.minOrder !== undefined) setMinOrder(String(store.settings.minOrder).replace(".", ","));
      if (store.settings.eta) setEta(store.settings.eta);
    }
  }, [store.settings]);

  const save = async () => {
    setBusy(true);
    try {
      const numFee = parseFloat(String(fee).replace(",", ".")) || 0;
      const numMin = parseFloat(String(minOrder).replace(",", ".")) || 0;
      await api("/api/settings", { method: "PATCH", body: { store_name: name.trim(), whatsapp: wa.trim(), address: addr.trim(), hours: hours.trim(), fee: numFee, min_order: numMin, eta: eta.trim() } });
      store.toast("Loja salva ✓");
    } catch (e) { store.toast(e.message); }
    setBusy(false);
  };
  const fieldStyle = { background: C.black, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12.5 };
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>🏪 Loja & Operação</div>
        <Btn small disabled={busy} onClick={save}>{busy ? "Salvando…" : "💾 Salvar loja"}</Btn>
      </div>
      <Row label="Nome da Loja"><input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg px-2.5 py-1.5 outline-none text-right" style={{ ...fieldStyle, width: 230 }} /></Row>
      <Row label="WhatsApp"><input value={wa} onChange={(e) => setWa(e.target.value)} className="rounded-lg px-2.5 py-1.5 outline-none text-right" style={{ ...fieldStyle, width: 150 }} /></Row>
      <Row label="Endereço"><input value={addr} onChange={(e) => setAddr(e.target.value)} className="rounded-lg px-2.5 py-1.5 outline-none text-right" style={{ ...fieldStyle, width: 260 }} /></Row>
      <Row label="Horário"><input value={hours} onChange={(e) => setHours(e.target.value)} className="rounded-lg px-2.5 py-1.5 outline-none text-right" style={{ ...fieldStyle, width: 200 }} /></Row>
      <Row label="Taxa entrega"><div className="flex items-center gap-1.5"><span style={{ color: "#777", fontSize: 12 }}>R$</span><input value={fee} onChange={(e) => setFee(e.target.value)} className="rounded-lg px-2.5 py-1.5 outline-none text-right" style={{ ...fieldStyle, width: 75 }} /></div></Row>
      <Row label="Pedido mínimo"><div className="flex items-center gap-1.5"><span style={{ color: "#777", fontSize: 12 }}>R$</span><input value={minOrder} onChange={(e) => setMinOrder(e.target.value)} className="rounded-lg px-2.5 py-1.5 outline-none text-right" style={{ ...fieldStyle, width: 75 }} /></div></Row>
      <Row label="ETA"><input value={eta} onChange={(e) => setEta(e.target.value)} className="rounded-lg px-2.5 py-1.5 outline-none text-right" style={{ ...fieldStyle, width: 120 }} /></Row>
      <Row label="Loja aberta"><button onClick={() => store.setOpen(!store.open)} className="rounded-full" style={{ width: 44, height: 24, background: store.open ? C.green : C.gray700, position: "relative" }}><span style={{ position: "absolute", top: 3, left: store.open ? 23 : 3, width: 18, height: 18, borderRadius: 99, background: C.white }} /></button></Row>
      <Btn full disabled={busy} onClick={save}>{busy ? "Salvando…" : "💾 Salvar"}</Btn>
    </Card>
  );
}

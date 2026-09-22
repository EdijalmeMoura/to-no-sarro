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

function AdminCategories({ store }) {
  const [cat, setCat] = useState({ label: "", icon: "" });
  const [grp, setGrp] = useState({ name: "", min: "0", max: "1", required: false });
  const [opt, setOpt] = useState({}); // { groupId: {name, price} }
  const [confirm, setConfirm] = useState(null); // {type, id}

  const say = (m) => store.toast(m);

  const addCategory = async () => {
    try {
      await api("/api/categories", { method: "POST", body: { label: cat.label, icon: cat.icon || "🍽" } });
      setCat({ label: "", icon: "" });
      say("Categoria criada ✓");
    } catch (e) { say(e.message); }
  };

  const addGroup = async () => {
    try {
      await api("/api/option-groups", { method: "POST", body: { name: grp.name, min: grp.min, max: grp.max, required: grp.required } });
      setGrp({ name: "", min: "0", max: "1", required: false });
      say("Grupo criado ✓ — agora adicione os itens");
    } catch (e) { say(e.message); }
  };

  const addOption = async (groupId) => {
    const o = opt[groupId] || {};
    try {
      await api(`/api/option-groups/${groupId}/options`, { method: "POST", body: { name: o.name, price: o.price || 0 } });
      setOpt({ ...opt, [groupId]: { name: "", price: "" } });
      say("Item adicionado ✓");
    } catch (e) { say(e.message); }
  };

  const patchGroup = async (g, patch) => {
    try { await api(`/api/option-groups/${g.id}`, { method: "PATCH", body: patch }); say("Grupo atualizado ✓"); }
    catch (e) { say(e.message); }
  };

  const doDelete = async () => {
    const c = confirm;
    setConfirm(null);
    try {
      if (c.type === "cat") await api(`/api/categories/${c.id}`, { method: "DELETE" });
      if (c.type === "grp") await api(`/api/option-groups/${c.id}`, { method: "DELETE" });
      if (c.type === "opt") await api(`/api/options/${c.id}`, { method: "DELETE" });
      say("Excluído ✓");
    } catch (e) { say(e.message); }
  };

  const inField = { background: C.black, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12 };
  const delBtn = (type, id, extra = null) => (
    confirm?.type === type && confirm?.id === id ? (
      <button onClick={doDelete} className="rounded-lg px-2 py-1 font-bold shrink-0"
        style={{ background: C.red, color: C.white, fontSize: 10.5 }}>confirmar?</button>
    ) : (
      <button onClick={() => setConfirm({ type, id })} className="rounded-lg px-2 py-1 font-bold shrink-0"
        style={{ border: `1px solid ${C.red}55`, color: C.red, fontSize: 10.5 }}>
        {extra || "🗑"}
      </button>
    )
  );

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      {/* CATEGORIAS */}
      <Card className="p-4 self-start">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>🗂 Categorias do cardápio</div>
        <div style={{ color: "#8a8a8a", fontSize: 11.5, marginTop: 4 }}>
          A ordem aqui é a ordem do menu do cliente.
        </div>
        <div className="mt-3 space-y-1.5">
          {store.categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-xl px-2.5 py-2" style={{ background: C.black, border: `1px solid ${C.gray800}` }}>
              <input defaultValue={c.icon} key={c.id + c.icon} style={{ ...inField, width: 44, textAlign: "center" }}
                className="rounded-lg px-2 py-1.5 outline-none"
                onBlur={(e) => e.target.value !== c.icon && api(`/api/categories/${c.id}`, { method: "PATCH", body: { icon: e.target.value } }).catch((x) => say(x.message))} />
              <input defaultValue={c.label} key={c.id + c.label} className="flex-1 rounded-lg px-2 py-1.5 outline-none" style={inField}
                onBlur={(e) => e.target.value !== c.label && api(`/api/categories/${c.id}`, { method: "PATCH", body: { label: e.target.value } }).catch((x) => say(x.message))} />
              <span style={{ color: "#5a5a5a", fontSize: 10.5, whiteSpace: "nowrap" }}>
                {store.products.filter((p) => p.cat === c.id).length} 🍔
              </span>
              {delBtn("cat", c.id)}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <input value={cat.icon} onChange={(e) => setCat({ ...cat, icon: e.target.value })} placeholder="🍔"
            style={{ ...inField, width: 44, textAlign: "center" }} className="rounded-lg px-2 py-1.5 outline-none" />
          <input value={cat.label} onChange={(e) => setCat({ ...cat, label: e.target.value })} placeholder="Nova categoria (ex.: Hot dogs)"
            className="flex-1 rounded-lg px-2 py-1.5 outline-none" style={inField}
            onKeyDown={(e) => e.key === "Enter" && cat.label.trim() && addCategory()} />
          <Btn small disabled={!cat.label.trim()} onClick={addCategory}>+ Criar</Btn>
        </div>
      </Card>

      {/* GRUPOS DE OPCIONAIS */}
      <Card className="p-4 self-start">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>➕ Grupos de opcionais</div>
        <div style={{ color: "#8a8a8a", fontSize: 11.5, marginTop: 4 }}>
          Vincule os grupos aos produtos no cardápio (editar produto → grupos).
        </div>
        <div className="mt-3 space-y-3">
          {store.optionGroups.map((g) => (
            <div key={g.id} className="rounded-xl p-3" style={{ background: C.black, border: `1px solid ${C.gray800}` }}>
              <div className="flex items-center gap-2">
                <span style={{ color: C.white, fontWeight: 800, fontSize: 13, flex: 1 }}>{g.name}</span>
                {delBtn("grp", g.id)}
              </div>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <button onClick={() => patchGroup(g, { required: !g.required })} className="rounded-lg px-2 py-1 font-bold"
                  style={{ background: g.required ? `${C.orange}22` : C.gray850, border: `1px solid ${g.required ? C.orange : C.gray800}`, color: g.required ? C.orange : "#9a9a9a", fontSize: 10.5 }}>
                  {g.required ? "obrigatório" : "opcional"}
                </button>
                {["min", "max"].map((k) => (
                  <label key={k} className="flex items-center gap-1" style={{ fontSize: 10.5, color: "#8a8a8a" }}>
                    {k}
                    <input type="number" defaultValue={g[k]} min={0} max={10}
                      onBlur={(e) => Number(e.target.value) !== g[k] && patchGroup(g, { [k]: e.target.value })}
                      className="rounded-lg px-1.5 py-1 outline-none" style={{ ...inField, width: 46 }} />
                  </label>
                ))}
              </div>
              <div className="mt-2 space-y-1">
                {g.options.map((o) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <input defaultValue={o.name} key={o.id + o.name} className="flex-1 rounded-lg px-2 py-1 outline-none" style={inField}
                      onBlur={(e) => e.target.value !== o.name && api(`/api/options/${o.id}`, { method: "PATCH", body: { name: e.target.value } }).catch((x) => say(x.message))} />
                    <input defaultValue={String(o.price).replace(".", ",")} key={o.id + o.price} inputMode="decimal"
                      className="rounded-lg px-2 py-1 outline-none text-right" style={{ ...inField, width: 78 }}
                      onBlur={(e) => {
                        const v = parseFloat(String(e.target.value).replace(",", "."));
                        if (Number.isFinite(v) && v !== o.price) api(`/api/options/${o.id}`, { method: "PATCH", body: { price: v } }).catch((x) => say(x.message));
                      }} />
                    {delBtn("opt", o.id)}
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <input value={opt[g.id]?.name || ""} onChange={(e) => setOpt({ ...opt, [g.id]: { ...opt[g.id], name: e.target.value } })}
                    placeholder="Novo item (ex.: Cheddar)" className="flex-1 rounded-lg px-2 py-1 outline-none"
                    style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12 }}
                    onKeyDown={(e) => e.key === "Enter" && opt[g.id]?.name?.trim() && addOption(g.id)} />
                  <input value={opt[g.id]?.price || ""} onChange={(e) => setOpt({ ...opt, [g.id]: { ...opt[g.id], price: e.target.value } })}
                    placeholder="R$" inputMode="decimal" className="rounded-lg px-2 py-1 outline-none text-right"
                    style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12, width: 78 }} />
                  <Btn small variant="dark" disabled={!opt[g.id]?.name?.trim()} onClick={() => addOption(g.id)}>+</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.gray800}` }}>
          <div style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Novo grupo</div>
          <input value={grp.name} onChange={(e) => setGrp({ ...grp, name: e.target.value })} placeholder="Ex.: Escolha o molho"
            className="w-full rounded-lg px-2 py-1.5 outline-none" style={inField} />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {["min", "max"].map((k) => (
              <label key={k} className="flex items-center gap-1" style={{ fontSize: 10.5, color: "#8a8a8a" }}>
                {k}
                <input value={grp[k]} onChange={(e) => setGrp({ ...grp, [k]: e.target.value })} inputMode="numeric"
                  className="rounded-lg px-1.5 py-1 outline-none" style={{ ...inField, width: 46 }} />
              </label>
            ))}
            <button onClick={() => setGrp({ ...grp, required: !grp.required })} className="rounded-lg px-2 py-1 font-bold"
              style={{ background: grp.required ? `${C.orange}22` : C.gray850, border: `1px solid ${grp.required ? C.orange : C.gray800}`, color: grp.required ? C.orange : "#9a9a9a", fontSize: 10.5 }}>
              {grp.required ? "obrigatório" : "opcional"}
            </button>
            <Btn small disabled={!grp.name.trim()} onClick={addGroup}>+ Criar grupo</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default AdminCategories;

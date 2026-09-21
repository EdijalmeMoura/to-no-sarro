import React, { useState, useEffect, useMemo, useRef } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";
import ServiceChargeCard from "./ServiceChargeCard.jsx";


function FormShell({ title, sub, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,.78)" }}>
      <div
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto p-5"
        style={{ background: C.gray900, borderTop: `3px solid ${C.orange}`, borderRadius: "22px 22px 0 0" }}
      >
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: C.white }}>{title}</h3>
            {sub && <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>{sub}</div>}
          </div>
          <button
            onClick={onClose}
            className="rounded-full flex items-center justify-center shrink-0"
            style={{ width: 32, height: 32, background: C.gray800, color: C.white, fontSize: 15 }}
          >
            ✕
          </button>
        </div>
        <div className="space-y-3 mt-4">{children}</div>
      </div>
    </div>
  );
}


function FSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span style={{ color: "#9a9a9a", fontSize: 11.5, fontWeight: 700 }}>{label}</span>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-3 mt-1.5 outline-none"
        style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 13.5 }}
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

const couponLabel = (c) =>
  c.type === "percent" ? `${c.value}% off` : c.type === "fixed" ? `${brl(c.value)} off` : "Entrega grátis";

// Selo automático da promoção: deriva do relógio — entra e sai do ar
// sozinha, sem ninguém precisar lembrar de ligar/desligar.

function MiniToggle({ on, onClick, title }) {
  return (
    <button
      onClick={onClick} title={title || (on ? "Pausar" : "Ativar")}
      className="rounded-full shrink-0"
      style={{ width: 38, height: 21, background: on ? C.green : C.gray700, position: "relative", transition: "background .2s" }}
    >
      <span
        style={{
          position: "absolute", top: 2.5, left: on ? 20 : 2.5, width: 16, height: 16,
          borderRadius: 99, background: C.white, transition: "left .2s",
        }}
      />
    </button>
  );
}

// Molde dos modais de gestão (cupom, promoção, usuário)

function Field({ label, value, onChange, ph, type = "text" }) {
  return (
    <label className="block">
      <span style={{ color: "#9a9a9a", fontSize: 11.5, fontWeight: 700 }}>{label}</span>
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} type={type}
        className="w-full rounded-xl px-3 py-3 mt-1.5 outline-none"
        style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 13.5 }}
      />
    </label>
  );
}



function AdminPromos({ store, now }) {
  return <AdminPromosModular store={store} now={now} />;
}

function UserForm({ initial, roles, drivers, onClose, onSaved }) {
  const [f, setF] = useState({
    name: initial?.name || "",
    username: initial?.username || "",
    password: "",
    role: initial?.role || "ATENDIMENTO",
    driverId: initial?.driverId || "",
    active: initial ? !!initial.active : true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const body = {
        name: f.name.trim(),
        role: f.role,
        driver_id: f.role === "ENTREGADOR" ? (f.driverId || null) : null,
        active: f.active,
      };
      if (!initial || f.password) body.password = f.password;
      if (initial) {
        await api(`/api/users/${initial.id}`, { method: "PATCH", body });
      } else {
        await api("/api/users", { method: "POST", body: { ...body, username: f.username } });
      }
      onSaved(initial ? `“${f.name}” atualizado ✓` : `Usuário ${f.username.toLowerCase()} criado ✓`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell title={initial ? "EDITAR USUÁRIO" : "NOVO USUÁRIO"} sub={initial?.username} onClose={onClose}>
      <Field label="Nome" value={f.name} onChange={(v) => set("name", v)} ph="Ex: Maria da Chapa" />
      {!initial && <Field label="Usuário (login)" value={f.username} onChange={(v) => set("username", v.toLowerCase())} ph="Ex: maria" />}
      <Field
        label={initial ? "Nova senha (vazio = manter)" : "Senha (mín. 6 caracteres)"}
        value={f.password} onChange={(v) => set("password", v)} ph={initial ? "••••••" : "mínimo 6 caracteres"} type="password"
      />
      <FSelect label="Perfil" value={f.role} onChange={(v) => set("role", v)}
        options={roles.map((r) => [r, ROLE_LABELS[r] || r])} />
      {f.role === "ENTREGADOR" && (
        <FSelect label="Entregador vinculado" value={f.driverId} onChange={(v) => set("driverId", v)}
          options={[["", "— escolher —"], ...drivers.map((d) => [d.id, `${d.name} · ${d.vehicle}`])]} />
      )}
      <button onClick={() => set("active", !f.active)} className="flex items-center gap-2.5">
        <MiniToggle on={f.active} onClick={() => set("active", !f.active)} />
        <span style={{ color: f.active ? C.green : "#7a7a7a", fontSize: 12.5, fontWeight: 800 }}>
          {f.active ? "Conta ativa" : "Conta desativada"}
        </span>
      </button>
      {err && <div className="rounded-lg px-3 py-2" style={{ background: `${C.red}18`, color: C.red, fontSize: 12, fontWeight: 700 }}>{err}</div>}
      <Btn full disabled={busy} onClick={save}>{busy ? "SALVANDO…" : initial ? "SALVAR ALTERAÇÕES" : "CRIAR USUÁRIO"}</Btn>
    </FormShell>
  );
}


export default AdminPromos;

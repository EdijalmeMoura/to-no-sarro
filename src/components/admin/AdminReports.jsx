import React, { useState, useEffect, useMemo, useRef } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";
import ServiceChargeCard from "./ServiceChargeCard.jsx";


function Input({ v, w = 220 }) {
  return (
    <input defaultValue={v} className="rounded-lg px-2.5 py-1.5 outline-none text-right"
      style={{ background: C.black, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12.5, width: w }} />
  );
}


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



function AdminReports({ store, now }) {
  return <AdminReportsModular store={store} now={now} />;
}

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
function promoStatus(p, now) {
  if (!p.active) return { label: "PAUSADA", color: "#7a7a7a" };
  if (p.startsAt && now < p.startsAt) return { label: "PROGRAMADA", color: C.blue };
  if (p.endsAt && now > p.endsAt) return { label: "EXPIRADA", color: C.red };
  return { label: "ATIVA AGORA", color: C.green };
}

const fmtShort = (ts) =>
  new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// datetime-local ⟷ timestamp (hora local)
const toLocalInput = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  const p2 = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
const fromLocalInput = (v) => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};

// "Último acesso" da equipe
function lastSeen(ts, now) {
  if (!ts) return "nunca";
  const m = Math.floor((now - ts) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return fmtShort(ts);
}

function CouponForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState({
    code: initial?.code || "",
    type: initial?.type || "percent",
    value: initial ? String(initial.value) : "10",
    min: initial ? String(initial.min) : "0",
    max_uses: initial?.limit ? String(initial.limit) : "",
    note: initial?.note || "",
    active: initial ? !!initial.active : true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const num = (s) => parseFloat(String(s).replace(",", "."));

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const body = {
        type: f.type,
        value: f.type === "freeship" ? 0 : num(f.value),
        min: num(f.min) || 0,
        max_uses: f.max_uses.trim() === "" ? null : Math.floor(num(f.max_uses)),
        note: f.note.trim(),
        active: f.active,
      };
      if (initial) {
        await api(`/api/coupons/${initial.code}`, { method: "PATCH", body });
      } else {
        await api("/api/coupons", { method: "POST", body: { ...body, code: f.code } });
      }
      onSaved(initial ? `Cupom ${initial.code} atualizado ✓` : `Cupom ${f.code.toUpperCase()} criado ✓`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell title={initial ? "EDITAR CUPOM" : "NOVO CUPOM"} sub={initial?.code} onClose={onClose}>
      {!initial && <Field label="Código (sem espaços)" value={f.code} onChange={(v) => set("code", v.toUpperCase())} ph="EX: SARRO15" />}
      <FSelect label="Tipo de desconto" value={f.type} onChange={(v) => set("type", v)}
        options={[["percent", "% sobre o subtotal"], ["fixed", "R$ fixo de desconto"], ["freeship", "Entrega grátis"]]} />
      {f.type !== "freeship" && (
        <Field label={f.type === "percent" ? "Porcentagem (1 a 90)" : "Valor em R$"} value={f.value} onChange={(v) => set("value", v)} ph="10" type="number" />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pedido mínimo (R$)" value={f.min} onChange={(v) => set("min", v)} ph="0" type="number" />
        <Field label="Limite de usos (vazio = ∞)" value={f.max_uses} onChange={(v) => set("max_uses", v)} ph="500" type="number" />
      </div>
      <Field label="Descrição curta" value={f.note} onChange={(v) => set("note", v)} ph="Ex: 10% acima de R$ 40" />
      <button onClick={() => set("active", !f.active)} className="flex items-center gap-2.5">
        <MiniToggle on={f.active} onClick={() => set("active", !f.active)} />
        <span style={{ color: f.active ? C.green : "#7a7a7a", fontSize: 12.5, fontWeight: 800 }}>
          {f.active ? "Cupom ativo" : "Cupom pausado"}
        </span>
      </button>
      {err && <div className="rounded-lg px-3 py-2" style={{ background: `${C.red}18`, color: C.red, fontSize: 12, fontWeight: 700 }}>{err}</div>}
      <Btn full disabled={busy} onClick={save}>{busy ? "SALVANDO…" : initial ? "SALVAR ALTERAÇÕES" : "CRIAR CUPOM"}</Btn>
    </FormShell>
  );
}

function PromoForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState({
    name: initial?.name || "",
    rule: initial?.rule || "",
    window: initial?.window || "",
    starts: toLocalInput(initial?.startsAt),
    ends: toLocalInput(initial?.endsAt),
    active: initial ? !!initial.active : true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const body = {
        name: f.name.trim(), rule: f.rule.trim(), window: f.window.trim(),
        starts_at: fromLocalInput(f.starts), ends_at: fromLocalInput(f.ends),
        active: f.active,
      };
      if (initial) {
        await api(`/api/promos/${initial.id}`, { method: "PATCH", body });
      } else {
        await api("/api/promos", { method: "POST", body });
      }
      onSaved(initial ? "Promoção atualizada ✓" : "Promoção criada ✓");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell title={initial ? "EDITAR PROMOÇÃO" : "NOVA PROMOÇÃO"} onClose={onClose}>
      <Field label="Nome" value={f.name} onChange={(v) => set("name", v)} ph="Ex: Happy Hour do Sarro" />
      <Field label="Regra" value={f.rule} onChange={(v) => set("rule", v)} ph="Ex: 18h às 20h — 15% off em combos" />
      <Field label="Quando vale (texto)" value={f.window} onChange={(v) => set("window", v)} ph="Ex: Terças · 18h às 20h" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Início (vazio = já)" value={f.starts} onChange={(v) => set("starts", v)} type="datetime-local" />
        <Field label="Fim (vazio = sem fim)" value={f.ends} onChange={(v) => set("ends", v)} type="datetime-local" />
      </div>
      <button onClick={() => set("active", !f.active)} className="flex items-center gap-2.5">
        <MiniToggle on={f.active} onClick={() => set("active", !f.active)} />
        <span style={{ color: f.active ? C.green : "#7a7a7a", fontSize: 12.5, fontWeight: 800 }}>
          {f.active ? "Promoção ativa" : "Promoção pausada"}
        </span>
      </button>
      {err && <div className="rounded-lg px-3 py-2" style={{ background: `${C.red}18`, color: C.red, fontSize: 12, fontWeight: 700 }}>{err}</div>}
      <Btn full disabled={busy} onClick={save}>{busy ? "SALVANDO…" : initial ? "SALVAR ALTERAÇÕES" : "CRIAR PROMOÇÃO"}</Btn>
    </FormShell>
  );
}


export default AdminReports;

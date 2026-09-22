import React, { useState } from "react";
import { C, font } from "../../constants/theme.js";
import { brl } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { Card, Btn, Logo, SmartImg, Badge } from "../ui/index.jsx";

export const BADGE_OPTS = [
  ["maisvendido", "Mais vendido", C.yellow],
  ["novidade", "Novidade", C.white],
  ["promocao", "Promoção", C.red],
];

export function Table({ cols, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 560 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} className="text-left px-3 py-2.5" style={{ color: "#7a7a7a", fontSize: 10.5, fontWeight: 800, borderBottom: `1px solid ${C.gray800}` }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className="px-3 py-3" style={{ color: j === 0 ? C.white : "#a5a5a5", fontSize: 12.5, borderBottom: `1px solid ${C.gray850}`, fontWeight: j === 0 ? 700 : 400 }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MiniToggle({ on, onClick, title }) {
  return (
    <button onClick={onClick} title={title || (on ? "Pausar" : "Ativar")} className="rounded-full shrink-0" style={{ width: 38, height: 21, background: on ? C.green : C.gray700, position: "relative", transition: "background .2s" }}>
      <span style={{ position: "absolute", top: 2.5, left: on ? 20 : 2.5, width: 16, height: 16, borderRadius: 99, background: C.white, transition: "left .2s" }} />
    </button>
  );
}

export function FormShell({ title, sub, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,.78)" }}>
      <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto p-5" style={{ background: C.gray900, borderTop: `3px solid ${C.orange}`, borderRadius: "22px 22px 0 0" }}>
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: C.white }}>{title}</h3>
            {sub && <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>{sub}</div>}
          </div>
          <button onClick={onClose} className="rounded-full flex items-center justify-center shrink-0" style={{ width: 32, height: 32, background: C.gray800, color: C.white, fontSize: 15 }}>✕</button>
        </div>
        <div className="space-y-3 mt-4">{children}</div>
      </div>
    </div>
  );
}

export function FSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span style={{ color: "#9a9a9a", fontSize: 11.5, fontWeight: 700 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl px-3 py-3 mt-1.5 outline-none" style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 13.5 }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${C.gray850}` }}>
      <span style={{ color: "#c0c0c0", fontSize: 13 }}>{label}</span>
      {children}
    </div>
  );
}

export function Input({ v, w = 220 }) {
  return <input defaultValue={v} className="rounded-lg px-2.5 py-1.5 outline-none text-right" style={{ background: C.black, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12.5, width: w }} />;
}

export function Field({ label, value, onChange, ph, type = "text" }) {
  return (
    <label className="block">
      <span style={{ color: "#9a9a9a", fontSize: 11.5, fontWeight: 700 }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} type={type} className="w-full rounded-xl px-3 py-3 mt-1.5 outline-none" style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 13.5 }} />
    </label>
  );
}

export const couponLabel = (c) => c.type === "percent" ? `${c.value}% off` : c.type === "fixed" ? `${brl(c.value)} off` : "Entrega grátis";

export function promoStatus(p, now) {
  if (!p.active) return { label: "PAUSADA", color: "#7a7a7a" };
  if (p.startsAt && now < p.startsAt) return { label: "PROGRAMADA", color: C.blue };
  if (p.endsAt && now > p.endsAt) return { label: "EXPIRADA", color: C.red };
  return { label: "ATIVA AGORA", color: C.green };
}

export const fmtShort = (ts) => new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export const toLocalInput = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  const p2 = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
export const fromLocalInput = (v) => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};

export const ROLE_LABELS = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  ATENDIMENTO: "Atendimento",
  COZINHA: "Cozinha",
  EXPEDICAO: "Expedição",
  ENTREGADOR: "Entregador",
};

export function ProductForm({ initial, store, onClose }) {
  const [f, setF] = useState(() => (initial ? {
    name: initial.name, cat: initial.cat, emoji: initial.emoji || "🍔",
    description: initial.desc || "",
    ingredients: (initial.ingredients || []).join("\n"),
    price: String(initial.price).replace(".", ","),
    promoOn: initial.promo != null,
    promo: initial.promo != null ? String(initial.promo).replace(".", ",") : "",
    time: String(initial.time ?? 15), stock: String(initial.stock ?? 0),
    badges: initial.badges || [], groups: initial.groups || [],
    available: initial.available, builder: initial.builder,
  } : {
    name: "", cat: "burgers", emoji: "🍔", description: "", ingredients: "",
    price: "", promoOn: false, promo: "", time: "15", stock: "0",
    badges: [], groups: [], available: true, builder: false,
  }));
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleIn = (k, id) => setF((p) => ({ ...p, [k]: p[k].includes(id) ? p[k].filter((x) => x !== id) : [...p[k], id] }));

  const pickFile = (fl) => {
    if (!fl) return;
    setFile(fl);
    setPreview(URL.createObjectURL(fl));
  };

  const num = (s) => parseFloat(String(s).replace(",", "."));
  const save = async () => {
    if (busy) return;
    setErr("");
    const price = num(f.price);
    const promo = f.promoOn ? num(f.promo) : null;
    if (f.name.trim().length < 3) return setErr("Dê um nome com pelo menos 3 letras.");
    if (!Number.isFinite(price) || price <= 0) return setErr("Informe um preço válido.");
    if (f.promoOn && (!Number.isFinite(promo) || promo <= 0)) return setErr("Informe o preço promocional.");
    if (f.promoOn && promo >= price) return setErr("A promoção precisa ser menor que o preço normal.");
    setBusy(true);
    try {
      await store.saveProduct(initial?.id, {
        name: f.name.trim(), cat: f.cat, emoji: f.emoji || "🍔",
        description: f.description.trim(),
        ingredients: f.ingredients.split("\n").map((s) => s.trim()).filter(Boolean),
        price, promo: f.promoOn ? promo : null,
        time: Math.max(1, parseInt(f.time) || 15),
        stock: Math.max(0, parseInt(f.stock) || 0),
        badges: f.badges, groups: f.groups,
        available: f.available, builder: f.builder,
      }, file);
      store.toast(initial ? "Produto atualizado ✓" : "Produto criado ✓");
      onClose();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const inField = { background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 13 };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,.8)" }}>
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto" style={{ background: C.gray900, borderTop: `3px solid ${C.orange}`, borderRadius: "20px 20px 0 0" }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: `1px solid ${C.gray800}` }}>
          <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: C.white }}>{initial ? "EDITAR PRODUTO" : "NOVO PRODUTO"}</h3>
          <button onClick={onClose} className="rounded-full flex items-center justify-center" style={{ width: 32, height: 32, background: C.gray850, color: C.white }}>✕</button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-4">
            <div>
              <div className="rounded-xl overflow-hidden" style={{ width: 96, height: 96, border: `1px solid ${C.gray800}`, background: C.gray850 }}>
                {preview ? <img src={preview} alt="Prévia" className="sarro-img" /> : <SmartImg id={initial?.id} emoji={f.emoji} file={initial?.img} v={initial?.updatedAt} fs={40} />}
              </div>
              <label className="block text-center mt-2 cursor-pointer rounded-lg px-2 py-1.5" style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.yellowLight, fontSize: 11, fontWeight: 800 }}>
                📷 {initial?.img || preview ? "Trocar foto" : "Enviar foto"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
            </div>
            <div className="flex-1 space-y-3">
              <Field label="Nome *" value={f.name} onChange={(v) => set("name", v)} ph="Ex.: Sarro Burger Vegano" />
              <div className="grid grid-cols-2 gap-3">
                <FSelect label="Categoria" value={f.cat} onChange={(v) => set("cat", v)} options={store.categories.map((c) => [c.id, `${c.icon} ${c.label}`])} />
                <Field label="Emoji (fallback)" value={f.emoji} onChange={(v) => set("emoji", v)} ph="🍔" />
              </div>
            </div>
          </div>
          <Field label="Descrição" value={f.description} onChange={(v) => set("description", v)} ph="Uma frase que dá água na boca" />
          <label className="block">
            <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Ingredientes (um por linha)</span>
            <textarea value={f.ingredients} onChange={(e) => set("ingredients", e.target.value)} rows={4} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none resize-y" style={inField} placeholder={"Pão brioche\nBlend 180g\nCheddar"} />
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Preço R$ *" value={f.price} onChange={(v) => set("price", v)} ph="29,90" />
            <label className="block">
              <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Promoção?</span>
              <button type="button" onClick={() => set("promoOn", !f.promoOn)} className="w-full rounded-xl px-3 py-2.5 mt-1 font-bold" style={{ background: f.promoOn ? `${C.orange}26` : C.gray850, border: `1px solid ${f.promoOn ? C.orange : C.gray800}`, color: f.promoOn ? C.orange : "#9a9a9a", fontSize: 12.5 }}>{f.promoOn ? "✓ Com promo" : "Sem promo"}</button>
            </label>
            {f.promoOn && <Field label="Preço promo R$" value={f.promo} onChange={(v) => set("promo", v)} ph="24,90" />}
            <Field label="Preparo (min)" value={f.time} onChange={(v) => set("time", v)} ph="15" />
            <Field label="Estoque" value={f.stock} onChange={(v) => set("stock", v)} ph="0" />
          </div>
          <div>
            <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Selos</span>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {BADGE_OPTS.map(([id, lbl, color]) => {
                const on = f.badges.includes(id);
                return <button key={id} type="button" onClick={() => toggleIn("badges", id)} className="rounded-full px-3 py-1.5 font-bold" style={{ background: on ? `${color}26` : C.gray850, border: `1px solid ${on ? color : C.gray800}`, color: on ? color : "#9a9a9a", fontSize: 11.5 }}>{on ? "✓" : "+"} {lbl}</button>;
              })}
            </div>
          </div>
          <div>
            <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Grupos de opcionais</span>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {store.optionGroups.map((g) => {
                const on = f.groups.includes(g.id);
                return <button key={g.id} type="button" onClick={() => toggleIn("groups", g.id)} className="rounded-full px-3 py-1.5 font-bold" style={{ background: on ? `${C.orange}22` : C.gray850, border: `1px solid ${on ? C.orange : C.gray800}`, color: on ? C.orange : "#9a9a9a", fontSize: 11.5 }}>{on ? "✓" : "+"} {g.name}</button>;
              })}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => set("available", !f.available)} className="rounded-xl px-3 py-2 font-bold" style={{ background: f.available ? `${C.green}1e` : C.gray850, border: `1px solid ${f.available ? C.green : C.gray800}`, color: f.available ? C.green : "#9a9a9a", fontSize: 12 }}>{f.available ? "🟢 Disponível" : "🔴 Indisponível"}</button>
            <button type="button" onClick={() => set("builder", !f.builder)} className="rounded-xl px-3 py-2 font-bold" style={{ background: f.builder ? `${C.orange}1e` : C.gray850, border: `1px solid ${f.builder ? C.orange : C.gray800}`, color: f.builder ? C.orange : "#9a9a9a", fontSize: 12 }}>🛠️ Monte seu Sarro {f.builder ? "✓" : ""}</button>
          </div>
          {err && <div className="rounded-lg px-3 py-2" style={{ background: `${C.red}18`, color: C.red, fontSize: 12, fontWeight: 700 }}>{err}</div>}
        </div>
        <div className="sticky bottom-0 p-4 flex gap-3" style={{ background: C.black, borderTop: `1px solid ${C.gray800}` }}>
          <Btn variant="dark" onClick={onClose}>Cancelar</Btn>
          <Btn full disabled={busy} onClick={save}>{busy ? "SALVANDO…" : initial ? "SALVAR ALTERAÇÕES" : "CRIAR PRODUTO"}</Btn>
        </div>
      </div>
    </div>
  );
}

export function CouponForm({ initial, onClose, onSaved }) {
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
      <FSelect label="Tipo de desconto" value={f.type} onChange={(v) => set("type", v)} options={[["percent", "% sobre o subtotal"], ["fixed", "R$ fixo de desconto"], ["freeship", "Entrega grátis"]]} />
      {f.type !== "freeship" && <Field label={f.type === "percent" ? "Porcentagem (1 a 90)" : "Valor em R$"} value={f.value} onChange={(v) => set("value", v)} ph="10" type="number" />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pedido mínimo (R$)" value={f.min} onChange={(v) => set("min", v)} ph="0" type="number" />
        <Field label="Limite de usos (vazio = ∞)" value={f.max_uses} onChange={(v) => set("max_uses", v)} ph="500" type="number" />
      </div>
      <Field label="Descrição curta" value={f.note} onChange={(v) => set("note", v)} ph="Ex: 10% acima de R$ 40" />
      <button onClick={() => set("active", !f.active)} className="flex items-center gap-2.5">
        <MiniToggle on={f.active} onClick={() => set("active", !f.active)} />
        <span style={{ color: f.active ? C.green : "#7a7a7a", fontSize: 12.5, fontWeight: 800 }}>{f.active ? "Cupom ativo" : "Cupom pausado"}</span>
      </button>
      {err && <div className="rounded-lg px-3 py-2" style={{ background: `${C.red}18`, color: C.red, fontSize: 12, fontWeight: 700 }}>{err}</div>}
      <Btn full disabled={busy} onClick={save}>{busy ? "SALVANDO…" : initial ? "SALVAR ALTERAÇÕES" : "CRIAR CUPOM"}</Btn>
    </FormShell>
  );
}

export function PromoForm({ initial, onClose, onSaved }) {
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
        <span style={{ color: f.active ? C.green : "#7a7a7a", fontSize: 12.5, fontWeight: 800 }}>{f.active ? "Promoção ativa" : "Promoção pausada"}</span>
      </button>
      {err && <div className="rounded-lg px-3 py-2" style={{ background: `${C.red}18`, color: C.red, fontSize: 12, fontWeight: 700 }}>{err}</div>}
      <Btn full disabled={busy} onClick={save}>{busy ? "SALVANDO…" : initial ? "SALVAR ALTERAÇÕES" : "CRIAR PROMOÇÃO"}</Btn>
    </FormShell>
  );
}

export function UserForm({ initial, roles, drivers, onClose, onSaved }) {
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
      <Field label={initial ? "Nova senha (vazio = manter)" : "Senha (mín. 6 caracteres)"} value={f.password} onChange={(v) => set("password", v)} ph={initial ? "••••••" : "mínimo 6 caracteres"} type="password" />
      <FSelect label="Perfil" value={f.role} onChange={(v) => set("role", v)} options={roles.map((r) => [r, ROLE_LABELS[r] || r])} />
      {f.role === "ENTREGADOR" && <FSelect label="Entregador vinculado" value={f.driverId} onChange={(v) => set("driverId", v)} options={[["", "— escolher —"], ...drivers.map((d) => [d.id, `${d.name} · ${d.vehicle}`])]} />}
      <button onClick={() => set("active", !f.active)} className="flex items-center gap-2.5">
        <MiniToggle on={f.active} onClick={() => set("active", !f.active)} />
        <span style={{ color: f.active ? C.green : "#7a7a7a", fontSize: 12.5, fontWeight: 800 }}>{f.active ? "Conta ativa" : "Conta desativada"}</span>
      </button>
      {err && <div className="rounded-lg px-3 py-2" style={{ background: `${C.red}18`, color: C.red, fontSize: 12, fontWeight: 700 }}>{err}</div>}
      <Btn full disabled={busy} onClick={save}>{busy ? "SALVANDO…" : initial ? "SALVAR ALTERAÇÕES" : "CRIAR USUÁRIO"}</Btn>
    </FormShell>
  );
}

export { C, font, brl, Card, Btn, Logo, SmartImg, Badge };

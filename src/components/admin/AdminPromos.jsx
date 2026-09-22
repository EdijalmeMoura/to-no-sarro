import React, { useState } from "react";
import { C, brl, Card, Btn } from "./_shared.jsx";
import { Table, MiniToggle, couponLabel, promoStatus, fmtShort, CouponForm, PromoForm } from "./_shared.jsx";
import { api } from "../../utils/api.js";

export default function AdminPromos({ store, now }) {
  const [couponForm, setCouponForm] = useState(null);
  const [promoForm, setPromoForm] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [msg, setMsg] = useState("");
  const say = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const toggleCoupon = async (c) => {
    try { await api(`/api/coupons/${c.code}`, { method: "PATCH", body: { active: !c.active } }); say(`Cupom ${c.code} ${!c.active ? "ativado" : "pausado"}`); } catch (e) { say(e.message); }
  };
  const togglePromo = async (p) => {
    try { await api(`/api/promos/${p.id}`, { method: "PATCH", body: { active: !p.active } }); say(`Promoção ${!p.active ? "ativada" : "pausada"}`); } catch (e) { say(e.message); }
  };
  const doDelete = async () => {
    if (!confirmDel) return;
    try {
      if (confirmDel.type === "coupon") await api(`/api/coupons/${confirmDel.code}`, { method: "DELETE" });
      else await api(`/api/promos/${confirmDel.id}`, { method: "DELETE" });
      say("Excluído ✓");
      setConfirmDel(null);
    } catch (e) { say(e.message); }
  };

  return (
    <div className="space-y-4">
      {msg && <div className="rounded-xl px-3 py-2.5" style={{ background: `${C.orange}18`, color: C.orange, fontSize: 12.5, fontWeight: 700 }}>{msg}</div>}
      {confirmDel && (
        <Card className="p-4 mb-4" style={{ borderColor: `${C.red}66`, background: `${C.red}12` }}>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>Excluir “{confirmDel.code || confirmDel.name}”?</div>
          <div className="flex gap-2 mt-3">
            <Btn small variant="danger" onClick={doDelete}>Excluir</Btn>
            <Btn small variant="dark" onClick={() => setConfirmDel(null)}>Cancelar</Btn>
          </div>
        </Card>
      )}
      <div className="flex items-center justify-between">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Cupons ({store.coupons.length})</div>
        <Btn small onClick={() => setCouponForm("new")}>+ Novo cupom</Btn>
      </div>
      <Card className="p-1">
        <Table cols={["Código", "Desconto", "Mínimo", "Usos", "Status", "Ações"]} rows={store.coupons.map((c) => [c.code, couponLabel(c), brl(c.min), `${c.uses || 0}/${c.limit || "∞"}`, <MiniToggle key="t" on={c.active} onClick={() => toggleCoupon(c)} />, <button key="e" onClick={() => setCouponForm(c)} className="rounded-lg px-2 py-1 font-bold" style={{ background: C.gray800, color: C.white, fontSize: 11 }}>✎</button>])} />
      </Card>
      <div className="flex items-center justify-between">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Promoções ({store.promos.length})</div>
        <Btn small onClick={() => setPromoForm("new")}>+ Nova promoção</Btn>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {store.promos.map((p) => {
          const st = promoStatus(p, now || Date.now());
          return (
            <Card key={p.id} className="p-4" style={{ opacity: p.active ? 1 : 0.6 }}>
              <div className="flex justify-between">
                <div style={{ color: C.white, fontWeight: 800 }}>{p.name}</div>
                <MiniToggle on={p.active} onClick={() => togglePromo(p)} />
              </div>
              <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 4 }}>{p.rule} · {p.window}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="rounded-full px-2 py-0.5 font-bold" style={{ background: `${st.color}22`, color: st.color, fontSize: 10 }}>{st.label}</span>
                <span style={{ color: "#6a6a6a", fontSize: 10 }}>{p.startsAt ? fmtShort(p.startsAt) : ""} {p.endsAt ? `→ ${fmtShort(p.endsAt)}` : ""}</span>
              </div>
            </Card>
          );
        })}
      </div>
      {couponForm && <CouponForm initial={couponForm === "new" ? null : couponForm} onClose={() => setCouponForm(null)} onSaved={(m) => { setCouponForm(null); say(m); }} />}
      {promoForm && <PromoForm initial={promoForm === "new" ? null : promoForm} onClose={() => setPromoForm(null)} onSaved={(m) => { setPromoForm(null); say(m); }} />}
    </div>
  );
}

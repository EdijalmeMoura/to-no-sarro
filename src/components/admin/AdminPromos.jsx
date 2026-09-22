import React, { useState } from "react";
import { C, brl, Card, Btn } from "./_shared.jsx";
import { Table, MiniToggle, couponLabel, promoStatus, fmtShort, CouponForm, PromoForm } from "./_shared.jsx";
import { api } from "../../utils/api.js";

export default function AdminPromos({ store, now }) {
  const [couponForm, setCouponForm] = useState(null);
  const [promoForm, setPromoForm] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [msg, setMsg] = useState("");
  const say = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  const toggleCoupon = async (c) => {
    try {
      await api(`/api/coupons/${c.code}`, { method: "PATCH", body: { active: !c.active } });
      say(`Cupom ${c.code} ${!c.active ? "ativado ✓" : "pausado"}`);
    } catch (e) { say(e.message); }
  };
  const togglePromo = async (p) => {
    try {
      await api(`/api/promos/${p.id}`, { method: "PATCH", body: { active: !p.active } });
      say(`Promoção "${p.name}" ${!p.active ? "ativada ✓" : "pausada"}`);
    } catch (e) { say(e.message); }
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
    <div className="space-y-5">
      {msg && (
        <div className="rounded-xl px-3 py-2.5" style={{ background: `${C.orange}18`, color: C.orange, fontSize: 12.5, fontWeight: 700 }}>
          {msg}
        </div>
      )}
      {confirmDel && (
        <Card className="p-4" style={{ borderColor: `${C.red}66`, background: `${C.red}12` }}>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>
            Excluir “{confirmDel.code || confirmDel.name}” definitivamente?
          </div>
          <div style={{ color: "#9a9a9a", fontSize: 11.5, marginTop: 4 }}>
            Essa ação não pode ser desfeita.
          </div>
          <div className="flex gap-2 mt-3">
            <Btn small variant="danger" onClick={doDelete}>Excluir de vez</Btn>
            <Btn small variant="dark" onClick={() => setConfirmDel(null)}>Cancelar</Btn>
          </div>
        </Card>
      )}

      {/* CUPONS */}
      <div className="flex items-center justify-between gap-2">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>🏷️ Cupons ({store.coupons.length})</div>
        <Btn small onClick={() => setCouponForm("new")}>+ Novo cupom</Btn>
      </div>
      <Card className="p-1">
        <Table
          cols={["Código", "Desconto", "Mínimo", "Usos", "Status", "Ações"]}
          rows={store.coupons.map((c) => [
            <span key="code" style={{ fontWeight: 900, color: C.yellowLight }}>{c.code}</span>,
            couponLabel(c),
            brl(c.min),
            `${c.uses || 0}/${c.limit || "∞"}`,
            <span key="tog" className="flex items-center gap-2">
              <MiniToggle on={c.active} onClick={() => toggleCoupon(c)} title={c.active ? "Pausar cupom" : "Ativar cupom"} />
              <span style={{ color: c.active ? C.green : "#7a7a7a", fontSize: 10, fontWeight: 800 }}>{c.active ? "ATIVO" : "PAUSADO"}</span>
            </span>,
            <span key="act" className="flex items-center gap-1">
              <button onClick={() => setCouponForm(c)} className="rounded-lg px-2 py-1 font-bold" style={{ background: C.gray800, color: C.white, fontSize: 11 }} title="Editar">✎</button>
              <button onClick={() => setConfirmDel({ type: "coupon", code: c.code })} className="rounded-lg px-2 py-1 font-bold" style={{ border: `1px solid ${C.red}55`, color: C.red, fontSize: 11 }} title="Excluir">🗑</button>
            </span>,
          ])}
        />
        {store.coupons.length === 0 && (
          <div className="p-6 text-center" style={{ color: "#6a6a6a", fontSize: 12 }}>Nenhum cupom cadastrado. Crie o primeiro!</div>
        )}
      </Card>

      {/* PROMOÇÕES */}
      <div className="flex items-center justify-between gap-2">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>🔥 Promoções ({store.promos.length})</div>
        <Btn small onClick={() => setPromoForm("new")}>+ Nova promoção</Btn>
      </div>

      {store.promos.length === 0 && (
        <Card className="p-6 text-center">
          <div style={{ fontSize: 32 }}>🎉</div>
          <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 6 }}>Nenhuma promoção. Crie Happy Hour, combos, etc.</div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {store.promos.map((p) => {
          const st = promoStatus(p, now || Date.now());
          return (
            <Card key={p.id} className="p-4 flex flex-col" style={{ opacity: p.active ? 1 : 0.65, borderColor: p.active ? `${st.color}44` : C.gray800 }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }} className="truncate">{p.name}</div>
                  <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 4, lineHeight: 1.4 }} className="line-clamp-2">
                    {p.rule}
                  </div>
                  <div style={{ color: C.yellowLight, fontSize: 11, marginTop: 4, fontWeight: 700 }}>⏰ {p.window}</div>
                </div>
                <MiniToggle on={p.active} onClick={() => togglePromo(p)} title={p.active ? "Pausar promoção" : "Ativar promoção"} />
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="rounded-full px-2.5 py-1 font-bold" style={{ background: `${st.color}22`, color: st.color, border: `1px solid ${st.color}44`, fontSize: 10 }}>
                  {st.label}
                </span>
                {(p.startsAt || p.endsAt) && (
                  <span style={{ color: "#6a6a6a", fontSize: 10 }}>
                    {p.startsAt ? fmtShort(p.startsAt) : "agora"} {p.endsAt ? `→ ${fmtShort(p.endsAt)}` : "→ sem fim"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 mt-4 pt-3" style={{ borderTop: `1px solid ${C.gray850}` }}>
                <button
                  onClick={() => togglePromo(p)}
                  className="rounded-lg px-2.5 py-1.5 font-bold flex-1"
                  style={{ background: p.active ? `${C.green}18` : `${C.yellow}18`, color: p.active ? C.green : C.yellow, border: `1px solid ${p.active ? `${C.green}44` : `${C.yellow}44`}`, fontSize: 11 }}
                >
                  {p.active ? "⏸ Pausar" : "▶ Ativar"}
                </button>
                <button
                  onClick={() => setPromoForm(p)}
                  className="rounded-lg px-3 py-1.5 font-bold"
                  style={{ background: C.gray800, color: C.white, fontSize: 11, border: `1px solid ${C.gray700}` }}
                  title="Editar promoção"
                >
                  ✎ Editar
                </button>
                <button
                  onClick={() => setConfirmDel({ type: "promo", id: p.id, name: p.name })}
                  className="rounded-lg px-2.5 py-1.5 font-bold"
                  style={{ background: "transparent", border: `1px solid ${C.red}55`, color: C.red, fontSize: 11 }}
                  title="Excluir promoção"
                >
                  🗑
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {couponForm && (
        <CouponForm
          initial={couponForm === "new" ? null : couponForm}
          onClose={() => setCouponForm(null)}
          onSaved={(m) => { setCouponForm(null); say(m); }}
        />
      )}
      {promoForm && (
        <PromoForm
          initial={promoForm === "new" ? null : promoForm}
          onClose={() => setPromoForm(null)}
          onSaved={(m) => { setPromoForm(null); say(m); }}
        />
      )}
    </div>
  );
}

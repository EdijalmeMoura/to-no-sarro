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

function AdminPromos({ store, now }) {
  const [couponForm, setCouponForm] = useState(null); // null | "new" | cupom
  const [promoForm, setPromoForm] = useState(null); // null | "new" | promo
  const [confirmDel, setConfirmDel] = useState(null); // { kind: "coupon"|"promo", ref }
  const say = (m) => store.toast(m);

  const toggleCoupon = (c) =>
    api(`/api/coupons/${c.code}`, { method: "PATCH", body: { active: !c.active } })
      .then(() => say(c.active ? `Cupom ${c.code} pausado` : `Cupom ${c.code} ativado ✓`))
      .catch((e) => say(e.message));

  const togglePromo = (p) =>
    api(`/api/promos/${p.id}`, { method: "PATCH", body: { active: !p.active } })
      .then(() => say(p.active ? `“${p.name}” pausada` : `“${p.name}” ativada ✓`))
      .catch((e) => say(e.message));

  const doDelete = async () => {
    try {
      if (confirmDel.kind === "coupon") await api(`/api/coupons/${confirmDel.ref.code}`, { method: "DELETE" });
      else await api(`/api/promos/${confirmDel.ref.id}`, { method: "DELETE" });
      say("Excluído");
    } catch (e) {
      say(e.message);
    }
    setConfirmDel(null);
  };

  return (
    <div className="space-y-5">
      {confirmDel && (
        <Card className="p-4" style={{ borderColor: `${C.red}66`, background: `${C.red}12` }}>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>
            Excluir {confirmDel.kind === "coupon" ? `o cupom ${confirmDel.ref.code}` : `a promoção “${confirmDel.ref.name}”`}?
          </div>
          <div className="flex gap-2 mt-3">
            <Btn small variant="danger" onClick={doDelete}>Excluir de vez</Btn>
            <Btn small variant="dark" onClick={() => setConfirmDel(null)}>Cancelar</Btn>
          </div>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Cupons de desconto</div>
          <Btn small onClick={() => setCouponForm("new")}>+ Novo cupom</Btn>
        </div>
        <Card className="p-1">
          <Table
            cols={["Cupom", "Desconto", "Mínimo", "Usos", "Status", ""]}
            rows={store.coupons.map((c) => [
              <span key="c">
                <span style={{ fontWeight: 800 }}>{c.code}</span>
                {c.note && <span className="block" style={{ color: "#7a7a7a", fontSize: 10.5, fontWeight: 400 }}>{c.note}</span>}
              </span>,
              couponLabel(c),
              brl(c.min),
              `${c.uses}/${c.limit || "∞"}`,
              <span key="s" className="flex items-center gap-2">
                <MiniToggle on={c.active} onClick={() => toggleCoupon(c)} />
                <span style={{ color: c.active ? C.green : "#7a7a7a", fontSize: 10.5, fontWeight: 800 }}>
                  {c.active ? "ATIVO" : "PAUSADO"}
                </span>
              </span>,
              <span key="a" className="flex items-center gap-1.5">
                <button onClick={() => setCouponForm(c)} className="rounded-lg px-2 py-1 font-bold"
                  style={{ background: C.gray800, color: C.white, fontSize: 11 }}>✎</button>
                <button onClick={() => setConfirmDel({ kind: "coupon", ref: c })} className="rounded-lg px-2 py-1 font-bold"
                  style={{ background: "transparent", border: `1px solid ${C.red}55`, color: C.red, fontSize: 11 }}>🗑</button>
              </span>,
            ])}
          />
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Promoções programadas</div>
          <Btn small onClick={() => setPromoForm("new")}>+ Nova promoção</Btn>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {store.promos.map((p) => { const st = promoStatus(p, now); return (
            <Card key={p.id} className="p-4" style={{ opacity: p.active ? 1 : 0.6 }}>
              <div className="flex justify-between items-start gap-2">
                <span style={{ color: C.white, fontWeight: 800, fontSize: 13.5 }}>{p.name}</span>
                <MiniToggle on={p.active} onClick={() => togglePromo(p)} />
              </div>
              <div style={{ color: "#9a9a9a", fontSize: 12, marginTop: 6, minHeight: 18 }}>{p.rule}</div>
              <div style={{ color: C.yellowLight, fontSize: 11, marginTop: 8, fontWeight: 700 }}>
                ⏰ {p.startsAt || p.endsAt
                  ? `${p.startsAt ? fmtShort(p.startsAt) : "…"} → ${p.endsAt ? fmtShort(p.endsAt) : "…"}`
                  : (p.window || "sempre")}
              </div>
              {p.window && (p.startsAt || p.endsAt) && (
                <div style={{ color: "#7a7a7a", fontSize: 10.5, marginTop: 2 }}>{p.window}</div>
              )}
              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${C.gray800}` }}>
                <span className="rounded-md px-2 py-0.5 font-bold" style={{ background: `${st.color}1f`, color: st.color, fontSize: 10.5 }}>
                  {st.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <button onClick={() => setPromoForm(p)} className="rounded-lg px-2 py-1 font-bold"
                    style={{ background: C.gray800, color: C.white, fontSize: 11 }}>✎ Editar</button>
                  <button onClick={() => setConfirmDel({ kind: "promo", ref: p })} className="rounded-lg px-2 py-1 font-bold"
                    style={{ background: "transparent", border: `1px solid ${C.red}55`, color: C.red, fontSize: 11 }}>🗑</button>
                </span>
              </div>
            </Card>
          ); })}
          {store.promos.length === 0 && (
            <Card className="p-6 text-center"><span style={{ color: "#8a8a8a", fontSize: 13 }}>Nenhuma promoção. Crie a primeira acima ↑</span></Card>
          )}
        </div>
      </div>

      {couponForm && (
        <CouponForm
          key={couponForm === "new" ? "new" : couponForm.code}
          initial={couponForm === "new" ? null : couponForm}
          onClose={() => setCouponForm(null)}
          onSaved={(m) => { setCouponForm(null); say(m); }}
        />
      )}
      {promoForm && (
        <PromoForm
          key={promoForm === "new" ? "new" : promoForm.id}
          initial={promoForm === "new" ? null : promoForm}
          onClose={() => setPromoForm(null)}
          onSaved={(m) => { setPromoForm(null); say(m); }}
        />
      )}
    </div>
  );
}

const ROLE_LABELS = {
  ADMIN: "Administrador", GERENTE: "Gerente", ATENDIMENTO: "Atendimento",
  COZINHA: "Cozinha", EXPEDICAO: "Expedição", ENTREGADOR: "Entregador",
};


export default AdminPromos;

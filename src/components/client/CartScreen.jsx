import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";

function CartScreen({ store, goCheckout, onOpen }) {
  const { cart } = store;
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const subtotal = cart.reduce((s, i) => s + i.unit * i.qty, 0);
  const coupon = store.coupon;
  let discount = 0;
  let fee = store.fee;
  if (coupon) {
    if (coupon.type === "percent") discount = subtotal * (coupon.value / 100);
    if (coupon.type === "fixed") discount = coupon.value;
    if (coupon.type === "freeship") fee = 0;
  }
  const total = Math.max(0, subtotal + fee - discount);

  const apply = async () => {
    try {
      const c = await store.validateCoupon(code.trim().toUpperCase(), subtotal);
      setErr("");
      store.setCoupon(c);
      store.toast(`Cupom ${c.code} aplicado`);
    } catch (e) {
      setErr(e.message);
    }
  };

  const upsell = store.products
    .filter((p) => ["porcoes", "bebidas", "sobremesas"].includes(p.cat))
    .filter((p) => !cart.find((i) => i.productId === p.id))
    .slice(0, 4);

  if (!cart.length) {
    return (
      <div className="px-4 py-16 text-center">
        <div style={{ fontSize: 56 }}>🛒</div>
        <div style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 22, color: C.white, marginTop: 12 }}>
          CARRINHO VAZIO
        </div>
        <p style={{ color: "#8a8a8a", fontSize: 13, marginTop: 8 }}>Escolhe um burger e a gente resolve o resto.</p>
        <div className="mt-6 flex justify-center">
          <Btn onClick={() => store.setTab("cardapio")}>Ver cardápio</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-4 py-5 pb-6 max-w-[720px] mx-auto w-full overflow-x-hidden">
      <h2 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: "clamp(22px, 6vw, 24px)", color: C.white, marginBottom: 14 }}>
        SEU PEDIDO
      </h2>

      <div className="space-y-3">
        {cart.map((i) => (
          <Card key={i.id} className="p-3">
            <div className="flex gap-3">
              <div className="shrink-0 rounded-xl overflow-hidden" style={{ width: 56, height: 56, border: `1px solid ${C.gray800}` }}>
                <SmartImg id={i.productId} emoji={i.emoji} alt={i.name} fs={26} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <span style={{ color: C.white, fontWeight: 800, fontSize: 14 }}>{i.name}</span>
                  <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 14 }}>{brl(i.unit * i.qty)}</span>
                </div>
                {i.opts.map((o) => (
                  <div key={o.id + o.name} style={{ color: "#8f8f8f", fontSize: 11.5 }}>
                    + {o.name}{o.price > 0 ? ` (${brl(o.price)})` : ""}
                  </div>
                ))}
                {i.note && <div style={{ color: C.yellow, fontSize: 11.5, marginTop: 2 }}>📝 {i.note}</div>}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3 rounded-lg px-2.5 py-1" style={{ background: C.gray800 }}>
                    <button onClick={() => store.setQty(i.id, i.qty - 1)} style={{ color: C.orange, fontWeight: 900, fontSize: 17 }}>−</button>
                    <span style={{ color: C.white, fontWeight: 800, fontSize: 13, minWidth: 14, textAlign: "center" }}>{i.qty}</span>
                    <button onClick={() => store.setQty(i.id, i.qty + 1)} style={{ color: C.orange, fontWeight: 900, fontSize: 17 }}>+</button>
                  </div>
                  <button onClick={() => store.removeItem(i.id)} style={{ color: "#7a7a7a", fontSize: 11.5 }}>Remover</button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="pt-6">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14, marginBottom: 10 }}>COMBINA COM SEU PEDIDO 🔥</div>
        <CarouselShell gap={10} showArrows={false}>
          {upsell.map((p) => (
            <Card key={p.id} className="sarro-carousel-item p-2.5 sarro-imgzoom" style={{ width: "clamp(126px, 36vw, 138px)" }}>
              <div className="rounded-lg overflow-hidden mb-2" style={{ height: 66, border: `1px solid ${C.gray800}` }}>
                <SmartImg id={p.id} emoji={p.emoji} alt={p.name} fs={30} file={p.img} v={p.updatedAt} />
              </div>
              <div style={{ color: C.white, fontSize: 12, fontWeight: 700, lineHeight: 1.25 }} className="line-clamp-2 min-h-[2.5em]">{p.name}</div>
              <div style={{ color: C.yellowLight, fontWeight: 900, fontSize: 12.5, margin: "4px 0 8px" }}>{brl(p.promo || p.price)}</div>
              <Btn small full onClick={() => onOpen(p)}>Adicionar</Btn>
            </Card>
          ))}
        </CarouselShell>
      </div>

      <div className="pt-6">
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Cupom de desconto"
            className="flex-1 rounded-xl px-3 py-3 outline-none"
            style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 13 }}
          />
          <Btn variant="dark" onClick={apply}>Aplicar</Btn>
        </div>
        {err && <div style={{ color: C.red, fontSize: 11.5, marginTop: 6 }}>{err}</div>}
        {coupon && (
          <div className="flex items-center justify-between mt-2">
            <span style={{ color: C.green, fontSize: 12 }}>✓ {coupon.code} — {coupon.note}</span>
            <button onClick={() => store.setCoupon(null)} style={{ color: "#7a7a7a", fontSize: 11 }}>remover</button>
          </div>
        )}
      </div>

      <Card className="p-4 mt-5 space-y-2">
        {[["Subtotal", brl(subtotal)], ["Taxa de entrega", fee === 0 ? "Grátis" : brl(fee)]].map(([k, v]) => (
          <div key={k} className="flex justify-between" style={{ color: "#a5a5a5", fontSize: 13 }}>
            <span>{k}</span><span>{v}</span>
          </div>
        ))}
        {discount > 0 && (
          <div className="flex justify-between" style={{ color: C.green, fontSize: 13 }}>
            <span>Desconto</span><span>−{brl(discount)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${C.gray800}` }}>
          <span style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>Total</span>
          <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 19 }}>{brl(total)}</span>
        </div>
      </Card>

      <div className="mt-4">
        <Btn full onClick={() => goCheckout({ subtotal, fee, discount, total })} disabled={!store.open}>
          {store.open ? "FINALIZAR PEDIDO" : "LOJA FECHADA — VOLTAMOS ÀS 18H"}
        </Btn>
      </div>
    </div>
  );
}

// ============================================================
// CHECKOUT
// ============================================================

// Declarados fora do Checkout: se ficassem dentro, o React remontaria os
// inputs a cada tick do relógio e o campo perderia o foco a cada tecla.

export default CartScreen;

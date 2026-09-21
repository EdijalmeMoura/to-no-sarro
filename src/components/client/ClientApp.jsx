import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";

function ClientApp({ store, now, goRole }) {
  const [modal, setModal] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const cartCount = store.cart.reduce((s, i) => s + i.qty, 0);
  const active = store.myOrder || (store.myOrderId ? store.orders.find((o) => o.id === store.myOrderId) : null);

  const addToCart = (item) => {
    store.addItem(item);
    setModal(null);
    store.toast(`${item.name} no carrinho`);
  };

  return (
    <div style={{ background: C.black, minHeight: "100%", paddingBottom: 66 }} className="overflow-x-hidden w-full">
      {store.tableParam && (
        <div
          className="flex items-center justify-between px-3.5 py-2 mx-3 my-2 rounded-xl shadow-md"
          style={{ background: `linear-gradient(100deg, ${C.orange}, ${C.yellow})`, color: C.black }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🍽️</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Atendimento no Salão
              </div>
              <div style={{ fontSize: 13, fontWeight: 900 }}>
                Você está na {store.tableParam} · Tô no Sarro
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              store.setTableParam(null);
              const u = new URL(window.location);
              u.searchParams.delete("mesa");
              window.history.replaceState({}, "", u.pathname);
            }}
            className="text-xs font-black underline bg-black/15 hover:bg-black/25 px-2.5 py-1 rounded-lg"
          >
            Sair da mesa
          </button>
        </div>
      )}

      {checkout ? (
        <Checkout
          store={store} totals={checkout}
          onBack={() => setCheckout(null)}
          onDone={async (payload) => {
            const ok = await store.placeOrder(payload);
            if (ok) setCheckout(null);
          }}
        />
      ) : (
        <div className="w-full overflow-x-hidden">
          {store.tab === "inicio" && <HomeScreen store={store} onOpen={setModal} goMenu={() => store.setTab("cardapio")} />}
          {store.tab === "cardapio" && <MenuScreen store={store} onOpen={setModal} />}
          {store.tab === "carrinho" && <CartScreen store={store} onOpen={setModal} goCheckout={setCheckout} />}
          {store.tab === "pedidos" && <TrackScreen order={active} store={store} now={now} />}
          {store.tab === "conta" && <AccountScreen store={store} />}
        </div>
      )}

      {modal && <ProductModal key={modal.id} p={modal} store={store} onClose={() => setModal(null)} onAdd={addToCart} />}

      {!checkout && store.tab !== "carrinho" && cartCount > 0 && (
        <div className="fixed z-30 left-0 right-0 flex justify-center pointer-events-none" style={{ bottom: "calc(78px + env(safe-area-inset-bottom))" }}>
          <button
            onClick={() => store.setTab("carrinho")}
            className="pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 font-black active:scale-95 transition mx-4 w-full max-w-[720px]"
            style={{
              background: `linear-gradient(100deg, ${C.orange}, ${C.yellow})`, color: C.black,
              boxShadow: "0 10px 30px rgba(245,130,0,.35)",
            }}
          >
            <span>🛒 {cartCount} {cartCount === 1 ? "item" : "itens"}</span>
            <span className="flex-1 text-right">{brl(store.cart.reduce((s, i) => s + i.unit * i.qty, 0))} →</span>
          </button>
        </div>
      )}

      {!checkout && (
        <a
          onClick={(e) => { e.preventDefault(); store.toast("Abrindo WhatsApp da loja"); }}
          href="#whatsapp"
          className="fixed z-30 flex items-center justify-center rounded-full"
          style={{ right: 16, bottom: cartCount > 0 ? "calc(142px + env(safe-area-inset-bottom))" : "calc(78px + env(safe-area-inset-bottom))", width: 46, height: 46, background: "linear-gradient(135deg, #25D366, #128C7E)", fontSize: 21, boxShadow: "0 8px 22px rgba(0,0,0,.5)" }}
        >
          <WaIcon size={24} color="#fff" />
        </a>
      )}

      {!checkout && (
        <footer className="text-center py-6 pb-24 text-xs" style={{ color: "#555" }}>
          <div>Tô no Sarro Burgers & Açaí · Smart Food System</div>
          <div className="mt-1">
            <a
              href={rolePath("admin")}
              onClick={(e) => { e.preventDefault(); goRole?.("admin"); }}
              style={{ color: "#666", textDecoration: "none", fontSize: 10.5 }}
            >
              🔒 Área da equipe
            </a>
          </div>
        </footer>
      )}

      {!checkout && <BottomNav tab={store.tab} setTab={store.setTab} cartCount={cartCount} />}
    </div>
  );
}
// ============================================================
// ADMIN
// ============================================================


export default ClientApp;

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";

function MenuScreen({ store, onOpen }) {
  const [cat, setCat] = useState("burgers");
  const [q, setQ] = useState("");
  const refs = useRef({});
  const chipsHook = useDragScroll();

  const results = smartSearch(q, store.products);
  const searching = q.trim().length > 0;

  const go = (id) => {
    setCat(id);
    refs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const byCat = (id) =>
    id === "promocoes"
      ? store.products.filter((p) => p.promo)
      : store.products.filter((p) => p.cat === id);

  return (
    <div className="w-full max-w-[720px] mx-auto">
      <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2 sticky z-20 backdrop-blur-md" style={{ background: "rgba(5,5,5,.92)", top: 44, borderBottom: `1px solid ${C.gray850}` }}>
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busque: “burger com bacon”, “combo barato”, “açaí”…"
            className="w-full rounded-2xl pl-10 pr-10 py-3 outline-none"
            style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 13 }}
          />
          <span className="absolute left-3.5 top-3.5" style={{ fontSize: 15 }}>🔍</span>
          {q && (
            <button onClick={() => setQ("")} className="absolute right-3 top-2.5 rounded-full w-7 h-7 flex items-center justify-center" style={{ background: C.gray800, color: "#9a9a9a", fontSize: 12 }}>✕</button>
          )}
        </div>

        {!searching && (
          <div className={`relative mt-3 sarro-fade ${!chipsHook.canLeft ? "no-left" : ""} ${!chipsHook.canRight ? "no-right" : ""}`}>
            <div
              ref={chipsHook.ref}
              className="sarro-chips no-scrollbar"
              style={{ touchAction: "pan-y pinch-zoom" }}
              {...chipsHook.handlers}
            >
              {(store.categories.length ? store.categories : CATEGORIES).map((c) => {
                const on = cat === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => go(c.id)}
                    className="sarro-chip shrink-0 rounded-full px-3.5 py-2 font-bold transition active:scale-95"
                    style={{
                      background: on ? `linear-gradient(100deg, ${C.orange}, ${C.yellow})` : C.gray850,
                      color: on ? C.black : "#c9c9c9",
                      border: `1px solid ${on ? "transparent" : C.gray800}`, fontSize: 12.5, whiteSpace: "nowrap",
                      boxShadow: on ? `0 2px 12px ${C.orange}33` : "none",
                    }}
                  >
                    {c.icon} {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="px-3 sm:px-4 pb-24">
        {searching ? (
          <>
            <div style={{ color: "#8a8a8a", fontSize: 12, margin: "12px 2px" }}>
              {results.length} resultado{results.length === 1 ? "" : "s"} para “{q}”
            </div>
            {results.length === 0 ? (
              <Card className="p-6 text-center">
                <div style={{ fontSize: 34 }}>🕵️</div>
                <div style={{ color: C.white, fontWeight: 800, marginTop: 8 }}>Não achamos esse aqui</div>
                <div style={{ color: "#8a8a8a", fontSize: 12.5, marginTop: 4 }}>
                  Tenta “bacon”, “combo”, “açaí” ou toca numa categoria.
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {results.map((p) => <ProductCard key={p.id} p={p} onOpen={onOpen} />)}
              </div>
            )}
          </>
        ) : (
          (store.categories.length ? store.categories : CATEGORIES).map((c) => {
            const items = byCat(c.id);
            if (!items.length) return null;
            return (
              <div key={c.id} ref={(el) => (refs.current[c.id] = el)} className="pt-6" style={{ scrollMarginTop: 132 }}>
                <div className="flex items-baseline justify-between mb-3 gap-2">
                  <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: "clamp(18px, 4.8vw, 20px)", color: C.white, letterSpacing: "-0.02em" }}>
                    {c.icon} {c.label.toUpperCase()}
                  </h3>
                  <span style={{ color: "#5a5a5a", fontSize: 11 }}>{items.length}</span>
                </div>
                <div className="space-y-2.5 sm:space-y-3">
                  {items.map((p) => <ProductCard key={p.id} p={p} onOpen={onOpen} />)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


export default MenuScreen;

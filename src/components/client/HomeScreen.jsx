import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";

function HomeScreen({ store, onOpen, goMenu }) {
  const top = store.products.filter((p) => p.badges.includes("maisvendido"));
  const promos = store.products.filter((p) => p.promo);
  const novos = store.products.filter((p) => p.badges.includes("novidade"));

  const Row = ({ title, sub, items }) => {
    if (!items.length) return null;
    return (
      <div className="pt-6 sm:pt-7">
        <div className="px-4 sm:px-5 mb-3 flex items-baseline justify-between gap-2 max-w-[720px] mx-auto w-full">
          <div>
            <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: "clamp(18px, 4.8vw, 20px)", color: C.white, letterSpacing: "-0.02em" }}>
              {title}
            </h3>
            {sub && <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>{sub}</div>}
          </div>
          <span style={{ color: "#4a4a4a", fontSize: 11 }}>{items.length} itens</span>
        </div>
        <div className="px-3 sm:px-4 max-w-[720px] mx-auto w-full">
          <CarouselShell>
            {items.map((p) => (
              <ProductCarouselCard key={p.id} p={p} onOpen={onOpen} />
            ))}
          </CarouselShell>
        </div>
      </div>
    );
  };

  return (
    <div className="pb-6 w-full overflow-x-hidden">
      <Hero store={store} onOrder={goMenu} />

      <div className="px-3 sm:px-4 -mt-4 relative z-10 max-w-[720px] mx-auto w-full">
        <Card className="p-3.5 sm:p-4 flex items-center gap-3" style={{ borderColor: `${C.orange}55` }}>
          <div className="rounded-xl overflow-hidden shrink-0 sarro-imgzoom" style={{ width: "clamp(44px, 12vw, 50px)", height: "clamp(44px, 12vw, 50px)", border: `1px solid ${C.orange}55` }}>
            <SmartImg id="p16" emoji="🛠️" alt="Monte seu Sarro" fs={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ color: C.white, fontWeight: 900, fontSize: "clamp(13px, 3.6vw, 14px)" }}>Monte seu Sarro</div>
            <div style={{ color: "#9a9a9a", fontSize: "clamp(10.5px, 3vw, 11.5px)", lineHeight: 1.3 }} className="truncate">Pão, carne, queijo e molho do seu jeito</div>
          </div>
          <Btn small onClick={() => onOpen(store.products.find((p) => p.builder))} style={{ whiteSpace: "nowrap" }}>Montar</Btn>
        </Card>
      </div>

      <Row title="🔥 OS QUERIDINHOS DO SARRO" sub="O que mais sai da chapa" items={top} />
      <Row title="💥 OFERTAS DE HOJE" sub="Enquanto durar o estoque" items={promos} />
      {novos.length > 0 && <Row title="✨ NOVIDADES" sub="Recém-chegados no cardápio" items={novos} />}

      <div className="px-3 sm:px-4 pt-7 max-w-[720px] mx-auto w-full">
        <Card className="p-4" style={{ background: `linear-gradient(120deg, ${C.orange}22, ${C.gray850})`, borderColor: `${C.orange}44` }}>
          <div style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>🔥 Happy Hour do Sarro</div>
          <div style={{ color: "#c9c9c9", fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>
            Das 18h às 20h, todo combo sai com 15% de desconto. Sem cupom, o preço já cai no carrinho.
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// CARRINHO
// ============================================================


export default HomeScreen;

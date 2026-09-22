import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";

function TVPanelApp({ store, now }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("sarro_sound_tv") !== "0");
  const lastReadyRef = useRef("");

  const inPrep = store.orders.filter((o) => ["NOVO", "CONFIRMADO", "PREPARO"].includes(o.status));
  const isReady = store.orders.filter((o) => ["PRONTO", "EMBALADO", "AGUARDANDO"].includes(o.status));

  useEffect(() => {
    const readyCodes = isReady.map((o) => o.code).join(",");
    if (lastReadyRef.current && lastReadyRef.current !== readyCodes) {
      if (soundOn && isReady.length > 0) {
        playReadyChime();
      }
    }
    lastReadyRef.current = readyCodes;
  }, [isReady, soundOn]);

  const toggleFs = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div style={{ background: "#050505", minHeight: "100vh", color: C.white }} className="p-4 md:p-6 flex flex-col select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <Logo size={44} withText={false} />
          <div>
            <div style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 26, color: C.orange, letterSpacing: "-0.02em" }}>
              TÔ NO SARRO!
            </div>
            <div style={{ color: "#8a8a8a", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>
              PAINEL DE PEDIDOS & SENHAS
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div style={{ fontFamily: font.display, fontSize: 30, color: C.yellowLight, fontVariantNumeric: "tabular-nums" }}>
            {new Date(now).toLocaleTimeString("pt-BR")}
          </div>

          <button
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              localStorage.setItem("sarro_sound_tv", next ? "1" : "0");
              if (next) playReadyChime();
            }}
            className="rounded-xl px-3 py-1.5 font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
            style={{
              background: soundOn ? "#16653444" : C.gray850,
              border: `1px solid ${soundOn ? C.green : C.gray800}`,
              color: soundOn ? C.green : "#888",
            }}
          >
            <span>{soundOn ? "🔔 Som TV Ativo" : "🔕 Mudo"}</span>
          </button>

          <button
            onClick={toggleFs}
            className="rounded-xl px-3 py-1.5 font-bold text-xs transition active:scale-95"
            style={{ background: C.gray800, border: `1px solid ${C.gray700}`, color: C.white }}
          >
            {fullscreen ? "⤢ Sair da Tela Cheia" : "⤢ Tela Cheia"}
          </button>
        </div>
      </div>

      {/* Grid com 2 colunas gigantes de TV */}
      <div className="grid md:grid-cols-2 gap-5 flex-1">
        {/* Coluna 1: EM PREPARO */}
        <div className="rounded-2xl p-4 md:p-5 flex flex-col" style={{ background: "#0d0d0d", border: `2px solid ${C.yellow}44` }}>
          <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              <span style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 24, color: C.yellowLight }}>
                EM PREPARO ({inPrep.length})
              </span>
            </div>
            <span style={{ color: "#777", fontSize: 12, fontWeight: 700 }}>Na chapa</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[72vh] pr-1">
            {inPrep.length === 0 && (
              <div className="col-span-full py-16 text-center text-gray-500 font-bold">
                Nenhum pedido na fila no momento.
              </div>
            )}
            {inPrep.map((o) => {
              const mod = getOrderModality(o);
              return (
                <div
                  key={o.id}
                  className="rounded-xl p-3 text-center border transition"
                  style={{ background: C.gray850, borderColor: `${C.yellow}33` }}
                >
                  <div style={{ color: C.yellowLight, fontFamily: font.display, fontStyle: "italic", fontSize: 30 }}>
                    #{o.code}
                  </div>
                  <div className="truncate font-bold text-white text-xs mt-1">
                    {o.customer?.name?.split(" ")[0] || "Cliente"}
                  </div>
                  <div
                    className="rounded-md px-2 py-0.5 font-black text-[10px] mt-1.5 inline-block"
                    style={{ background: mod.bg, color: mod.color, border: `1px solid ${mod.border}44` }}
                  >
                    {mod.icon} {mod.badge}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coluna 2: PRONTOS */}
        <div className="rounded-2xl p-4 md:p-5 flex flex-col" style={{ background: "#0d0d0d", border: `2px solid ${C.green}` }}>
          <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">✅</span>
              <span style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 24, color: C.green }}>
                PRONTOS PARA RETIRADA ({isReady.length})
              </span>
            </div>
            <span style={{ color: C.green, fontSize: 12, fontWeight: 800 }}>Retire no balcão</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[72vh] pr-1">
            {isReady.length === 0 && (
              <div className="col-span-full py-16 text-center text-gray-500 font-bold">
                Aguardando próximos pedidos prontos...
              </div>
            )}
            {isReady.map((o) => {
              const mod = getOrderModality(o);
              return (
                <div
                  key={o.id}
                  className="rounded-xl p-3.5 text-center transition animate-pulse"
                  style={{
                    background: "linear-gradient(135deg, #064e3b, #022c22)",
                    border: `2px solid ${C.green}`,
                    boxShadow: "0 0 16px rgba(16,185,129,.2)",
                  }}
                >
                  <div style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 34 }}>
                    #{o.code}
                  </div>
                  <div className="truncate font-black text-white text-sm mt-1">
                    {o.customer?.name?.split(" ")[0] || "Cliente"}
                  </div>
                  <div className="rounded-md px-2 py-0.5 font-black text-xs mt-2 inline-block bg-black/40 text-emerald-300">
                    {mod.icon} {mod.badge}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ENTREGADOR
// ============================================================


export default TVPanelApp;

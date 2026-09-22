import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";

function KitchenApp({ store, now }) {
  const [filterMod, setFilterMod] = useState("TODOS"); // TODOS | delivery | mesa | pickup
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("sarro_sound_kitchen") !== "0");
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem("sarro_autoprint") === "1");
  const lastQueueSig = useRef("");

  const toggleAutoPrint = () => {
    const v = autoPrint ? "0" : "1";
    localStorage.setItem("sarro_autoprint", v);
    setAutoPrint(!autoPrint);
    store.toast(v === "1" ? "Impressão automática ligada 🖨" : "Impressão automática desligada");
  };

  const queue = store.orders
    .filter((o) => ["NOVO", "CONFIRMADO", "PREPARO"].includes(o.status))
    .sort((a, b) => a.createdAt - b.createdAt);

  // Alerta sonoro automático de novo pedido ou nova rodada de itens
  useEffect(() => {
    const sig = queue.map((o) => `${o.id}:${o.status}:${o.items.length}`).join("|");
    if (lastQueueSig.current && lastQueueSig.current !== sig) {
      if (soundOn && sig.length > lastQueueSig.current.length) {
        playKitchenChime();
      }
    }
    lastQueueSig.current = sig;
  }, [queue, soundOn]);

  const filteredQueue = queue.filter((o) => {
    if (filterMod === "TODOS") return true;
    return getOrderModality(o).id === filterMod;
  });

  const mins = (o) => (now - o.createdAt) / 60000;

  return (
    <div style={{ background: C.black, minHeight: "100%" }} className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Logo size={40} withText={false} />
          <div>
            <h2 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 24, color: C.white, letterSpacing: "-0.02em" }}>
              COZINHA
            </h2>
            <div style={{ color: "#7a7a7a", fontSize: 11.5 }}>{queue.length} pedidos na fila</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Botão de som */}
          <button
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              localStorage.setItem("sarro_sound_kitchen", next ? "1" : "0");
              if (next) playKitchenChime();
              store.toast(next ? "🔔 Som da cozinha ATIVADO!" : "🔕 Som da cozinha MUTADO");
            }}
            className="rounded-lg px-2.5 py-1.5 font-bold transition active:scale-95 flex items-center gap-1.5"
            style={{
              background: soundOn ? "#16653433" : C.gray850,
              border: `1px solid ${soundOn ? C.green : C.gray800}`,
              color: soundOn ? C.green : "#8a8a8a",
              fontSize: 11,
              whiteSpace: "nowrap",
            }}
          >
            <span>{soundOn ? "🔔" : "🔕"}</span>
            <span>Som {soundOn ? "ON" : "OFF"}</span>
          </button>
          <button
            onClick={() => { playKitchenChime(); store.toast("🔊 Bip de teste emitido!"); }}
            className="rounded-lg px-2 py-1.5 font-bold text-xs text-gray-400 hover:text-white transition"
            style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}
            title="Testar volume do bip"
          >
            Bip
          </button>

          <button
            onClick={toggleAutoPrint}
            className="rounded-lg px-2.5 py-1.5 font-bold"
            style={{
              background: autoPrint ? `${C.orange}22` : C.gray850,
              border: `1px solid ${autoPrint ? C.orange : C.gray800}`,
              color: autoPrint ? C.orange : "#8a8a8a", fontSize: 11, whiteSpace: "nowrap",
            }}
          >
            🖨 Auto-print {autoPrint ? "ON" : "OFF"}
          </button>
          <SyncBadge store={store} now={now} />
          <span style={{ color: "#7a7a7a", fontSize: 11.5 }}>Prontos</span>
          <span style={{ color: C.green, fontWeight: 900, fontSize: 20 }}>
            {store.orders.filter((o) => ["PRONTO", "EMBALADO", "AGUARDANDO", "ROTA", "ENTREGUE"].includes(o.status)).length}
          </span>
          {store.me && (
            <button
              onClick={store.logout}
              className="rounded-lg px-2.5 py-1.5 font-bold"
              style={{ border: `1px solid ${C.gray800}`, color: "#8a8a8a", fontSize: 11 }}
            >
              Sair
            </button>
          )}
        </div>
      </div>

      {/* FILTROS POR MODALIDADE */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { id: "TODOS", label: `Todos (${queue.length})` },
          { id: "delivery", label: `🛵 Delivery (${queue.filter((o) => getOrderModality(o).id === "delivery").length})` },
          { id: "mesa", label: `🍽️ Salão (${queue.filter((o) => getOrderModality(o).id === "mesa").length})` },
          { id: "pickup", label: `🏪 Balcão (${queue.filter((o) => getOrderModality(o).id === "pickup").length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterMod(tab.id)}
            className="rounded-lg px-3 py-1.5 font-bold text-xs transition"
            style={{
              background: filterMod === tab.id ? C.orange : C.gray850,
              color: filterMod === tab.id ? C.black : "#8a8a8a",
              border: `1px solid ${filterMod === tab.id ? C.orange : C.gray800}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredQueue.length === 0 && (
        <Card className="p-10 text-center">
          <div style={{ fontSize: 44 }}>🔥</div>
          <div style={{ color: C.white, fontWeight: 900, fontSize: 18, marginTop: 10 }}>Chapa livre</div>
          <div style={{ color: "#8a8a8a", fontSize: 13, marginTop: 4 }}>
            {filterMod === "TODOS" ? "Nenhum pedido esperando na cozinha." : `Nenhum pedido nesta modalidade (${filterMod}).`}
          </div>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredQueue.map((o) => {
          const mod = getOrderModality(o);
          const late = mins(o) > 20;
          const warn = mins(o) > 12;
          const border = late ? C.red : warn ? C.yellow : mod.color;
          return (
            <div
              key={o.id}
              className="rounded-2xl overflow-hidden flex flex-col justify-between"
              style={{
                background: C.gray850,
                border: `2px solid ${border}`,
                boxShadow: `0 4px 20px ${mod.color}15`,
                animation: o.status === "NOVO" ? "sarropulse 1.8s ease-in-out infinite" : "none",
              }}
            >
              <div>
                {/* HEADER DE MODALIDADE COM ALTA VISIBILIDADE */}
                <div
                  className="px-3.5 py-2 flex items-center justify-between font-black text-xs"
                  style={{ background: mod.bg, borderBottom: `2px solid ${mod.border}66` }}
                >
                  <div className="flex items-center gap-1.5" style={{ color: mod.color }}>
                    <span className="text-base">{mod.icon}</span>
                    <span style={{ fontSize: 13, letterSpacing: 0.5 }}>{mod.label}</span>
                  </div>
                  <span
                    className="rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                    style={{ background: `${mod.border}33`, color: mod.color, border: `1px solid ${mod.border}66` }}
                  >
                    {mod.instruction}
                  </span>
                </div>

                <div className="flex items-center justify-between px-4 py-3" style={{ background: late ? `${C.red}1f` : C.gray800 }}>
                  <div className="flex items-center gap-2">
                    <span style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 22 }}>#{o.code}</span>
                    <ChannelPill channel={o.channel} />
                    {o.paymentStatus === "pendente" && (
                      <span
                        className="rounded-md px-1.5 py-0.5 font-bold"
                        style={{ background: `${C.yellow}1f`, color: C.yellow, fontSize: 9.5, border: `1px solid ${C.yellow}44` }}
                      >
                        ⏳ PGTO PENDENTE
                      </span>
                    )}
                    {late && <Badge color={C.red} text={C.white}>ATRASADO</Badge>}
                  </div>
                  <span style={{ color: late ? C.red : C.yellowLight, fontWeight: 900, fontSize: 20, fontVariantNumeric: "tabular-nums" }}>
                    {elapsed(o.createdAt, now)}
                  </span>
                </div>

                <div className="p-4">
                  {o.items.map((i) => (
                    <div key={i.id} className="mb-3">
                      <div style={{ color: C.white, fontWeight: 900, fontSize: 18 }}>
                        {i.qty}x {i.name}
                      </div>
                      {i.opts.map((op) => (
                        <div key={op.id + op.name} style={{ color: C.yellowLight, fontSize: 13, marginLeft: 4 }}>+ {op.name}</div>
                      ))}
                      {i.note && (
                        <div className="rounded-lg px-2.5 py-1.5 mt-1.5" style={{ background: `${C.yellow}1c`, color: C.yellow, fontSize: 13, fontWeight: 700 }}>
                          📝 {i.note}
                        </div>
                      )}
                    </div>
                  ))}

                  <div style={{ color: "#aaa", fontSize: 12, marginTop: 10, fontWeight: 700 }}>
                    {o.customer.name} · {mod.isMesa ? `🍽️ ${mod.badge}` : mod.isPickup ? "🏪 Retirada no balcão" : `🛵 ${o.customer.addr}`}
                  </div>
                </div>
              </div>

              <div className="p-4 pt-0 space-y-2">
                <Btn small full variant="dark" onClick={async () => {
                  try {
                    await api(`/api/print/kitchen/${o.id}`, { method: "POST" });
                    store.toast("Comanda enviada à impressora ✓");
                  } catch {
                    printKitchen(o);
                  }
                }}>🖨 IMPRIMIR COMANDA</Btn>
                {o.status !== "PREPARO" ? (
                  <Btn full onClick={() => store.setStatus(o.id, "PREPARO")}>INICIAR PREPARO</Btn>
                ) : (
                  <Btn full variant="green" onClick={() => store.setStatus(o.id, "PRONTO")}>PEDIDO PRONTO</Btn>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// MODAL DE ACERTO / FECHAMENTO DE ENTREGADOR
// ============================================================


export default KitchenApp;

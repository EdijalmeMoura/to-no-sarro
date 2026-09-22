
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";
// getAudioContext vivia só no App.jsx; sem isto o sino do KDS era engolido
// pelo try/catch e nunca tocava.
import { getAudioContext } from "../../utils/sound.js";


function beep(freq = 880, dur = 0.14) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "square"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch (e) { /* som é opcional */ }
}

function playKitchenChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const tones = [
      { freq: 880, start: 0, dur: 0.15 },
      { freq: 1174, start: 0.18, dur: 0.35 },
    ];
    for (const t of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(t.freq, now + t.start);

      gain.gain.setValueAtTime(0.001, now + t.start);
      gain.gain.exponentialRampToValueAtTime(0.35, now + t.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t.start + t.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + t.start);
      osc.stop(now + t.start + t.dur + 0.05);
    }
  } catch (e) {}
}

function playReadyChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const tones = [
      { freq: 987.77, start: 0, dur: 0.3 },
      { freq: 659.25, start: 0.28, dur: 0.5 },
    ];
    for (const t of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(t.freq, now + t.start);

      gain.gain.setValueAtTime(0.001, now + t.start);
      gain.gain.exponentialRampToValueAtTime(0.4, now + t.start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t.start + t.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + t.start);
      osc.stop(now + t.start + t.dur + 0.05);
    }
  } catch (e) {}
}

function playSuccessChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = freq;
      const start = ctx.currentTime + idx * 0.09;
      g.gain.setValueAtTime(0.14, start);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
      o.start(start);
      o.stop(start + 0.25);
    });
  } catch {}
}

function OrderCard({ o, store, now, compact }) {
  const next = FLOW[FLOW.indexOf(o.status) + 1];
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>#{o.code}</span>
          <ChannelPill channel={o.channel} />
          {o.paymentStatus === "pendente" && (
            <span
              className="rounded-md px-1.5 py-0.5 font-bold"
              style={{ background: `${C.yellow}1f`, color: C.yellow, fontSize: 9, border: `1px solid ${C.yellow}44` }}
            >
              ⏳ PGTO
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ color: "#7a7a7a", fontSize: 10.5 }}>{elapsed(o.createdAt, now)}</span>
          <button
            onClick={() => printReceipt(o, store.settings)}
            title="Imprimir cupom"
            className="rounded-md px-1.5 py-0.5"
            style={{ background: C.gray800, color: "#c9c9c9", fontSize: 11 }}
          >
            🖨
          </button>
        </div>
      </div>
      <div style={{ color: "#c9c9c9", fontSize: 12, fontWeight: 700 }}>{o.customer.name}</div>
      {!compact && <div style={{ color: "#7a7a7a", fontSize: 11, marginTop: 2 }}>{o.customer.addr}</div>}
      <div className="mt-2 space-y-0.5">
        {o.items.map((i) => (
          <div key={i.id} style={{ color: "#9a9a9a", fontSize: 11.5 }}>
            {i.qty}x {i.name}{i.note ? ` · ${i.note}` : ""}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2.5">
        <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 13.5 }}>{brl(o.total)}</span>
        <span style={{ color: "#7a7a7a", fontSize: 10.5 }}>
          {o.payment} · {o.type === "pickup" ? "Retirada" : "Delivery"}
        </span>
      </div>
      {next && o.status !== "ENTREGUE" && (
        <div className="flex gap-2 mt-3">
          <Btn small full onClick={() => store.advance(o.id)}>Avançar → {STATUS[next].label}</Btn>
          <Btn small variant="danger" onClick={() => store.setStatus(o.id, "CANCELADO")}>Cancelar</Btn>
        </div>
      )}
    </Card>
  );
}

function KitchenApp({ store, now }) {
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem("sarro_autoprint") === "1");
  const toggleAutoPrint = () => {
    const v = autoPrint ? "0" : "1";
    localStorage.setItem("sarro_autoprint", v);
    setAutoPrint(!autoPrint);
    store.toast(v === "1" ? "Impressão automática ligada 🖨" : "Impressão automática desligada");
  };
  const queue = store.orders
    .filter((o) => ["NOVO", "CONFIRMADO", "PREPARO"].includes(o.status))
    .sort((a, b) => a.createdAt - b.createdAt);

  const mins = (o) => (now - o.createdAt) / 60000;

  return (
    <div style={{ background: C.black, minHeight: "100%" }} className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-5">
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
          <span style={{ color: "#7a7a7a", fontSize: 11.5 }}>Prontos hoje</span>
          <span style={{ color: C.green, fontWeight: 900, fontSize: 20 }}>
            {store.orders.filter((o) => ["PRONTO", "EMBALADO", "AGUARDANDO", "ROTA", "ENTREGUE"].includes(o.status)).length}
          </span>
        </div>
      </div>

      {queue.length === 0 && (
        <Card className="p-10 text-center">
          <div style={{ fontSize: 44 }}>🔥</div>
          <div style={{ color: C.white, fontWeight: 900, fontSize: 18, marginTop: 10 }}>Chapa livre</div>
          <div style={{ color: "#8a8a8a", fontSize: 13, marginTop: 4 }}>Nenhum pedido esperando. Bom momento para repor a mise en place.</div>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {queue.map((o) => {
          const late = mins(o) > 20;
          const warn = mins(o) > 12;
          const border = late ? C.red : warn ? C.yellow : C.gray800;
          return (
            <div
              key={o.id}
              className="rounded-2xl overflow-hidden"
              style={{ background: C.gray850, border: `2px solid ${border}`, animation: o.status === "NOVO" ? "sarropulse 1.8s ease-in-out infinite" : "none" }}
            >
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

                <div style={{ color: "#7a7a7a", fontSize: 11.5, marginTop: 10 }}>
                  {o.customer.name} · {o.type === "pickup" ? "🏪 retirada" : "🛵 delivery"}
                </div>

                <div className="mt-3 space-y-2">
                  <Btn small full variant="dark" onClick={async () => {
                    try {
                      await api(`/api/print/kitchen/${o.id}`, { method: "POST" });
                      store.toast("Comanda enviada à impressora ✓");
                    } catch {
                      printKitchen(o); // sem impressora: diálogo do navegador
                    }
                  }}>🖨 IMPRIMIR COMANDA</Btn>
                  {o.status !== "PREPARO" ? (
                    <Btn full onClick={() => store.setStatus(o.id, "PREPARO")}>INICIAR PREPARO</Btn>
                  ) : (
                    <Btn full variant="green" onClick={() => store.setStatus(o.id, "PRONTO")}>PEDIDO PRONTO</Btn>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default KitchenApp;


import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";


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

function DriverApp({ store, now }) {
  // O entregador logado enxerga só o que é dele (o servidor também valida).
  const meDriver = store.drivers.find((d) => d.id === store.me?.driverId) || store.drivers[0];
  const meId = meDriver?.id;
  const mine = store.orders.filter((o) => o.driverId === meId && ["ROTA", "ENTREGUE"].includes(o.status));
  const open = store.orders.filter((o) => o.status === "AGUARDANDO" && o.type === "delivery");

  return (
    <div style={{ background: C.black, minHeight: "100%" }} className="p-4 pb-10">
      <div className="flex items-center justify-between mb-4">
        <Logo size={38} />
        <span
          className="rounded-lg px-2.5 py-1.5 font-bold"
          style={{ background: C.gray850, color: C.white, border: `1px solid ${C.gray800}`, fontSize: 12 }}
        >
          🛵 {meDriver ? meDriver.name.split(" ")[0] : "…"} · {meDriver?.vehicle}
        </span>
      </div>

      <h2 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 26, color: C.white, letterSpacing: "-0.02em" }}>
        🛵 MINHAS ENTREGAS
      </h2>
      <div style={{ color: "#7a7a7a", fontSize: 12, marginBottom: 16 }}>
        {meDriver?.name || "Entregador"} · {mine.filter((o) => o.status === "ROTA").length} em rota hoje
      </div>

      {open.length > 0 && (
        <div className="mb-5">
          <div style={{ color: C.yellowLight, fontWeight: 900, fontSize: 13, marginBottom: 8 }}>Disponíveis para aceitar</div>
          <div className="space-y-2">
            {open.map((o) => (
              <Card key={o.id} className="p-3.5" style={{ borderColor: `${C.yellow}44` }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>#{o.code}</span>
                  <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 14 }}>{brl(o.total)}</span>
                </div>
                <div style={{ color: "#9a9a9a", fontSize: 12, marginTop: 4 }}>{o.customer.addr}</div>
                <div className="mt-3"><Btn full onClick={() => store.assignDriver(o.id, meId)}>ACEITAR ENTREGA</Btn></div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {mine.length === 0 && open.length === 0 && (
          <Card className="p-8 text-center">
            <div style={{ fontSize: 40 }}>🛵</div>
            <div style={{ color: C.white, fontWeight: 800, marginTop: 10 }}>Sem entregas por enquanto</div>
            <div style={{ color: "#8a8a8a", fontSize: 12.5, marginTop: 4 }}>Assim que a expedição liberar um pedido, ele aparece aqui.</div>
          </Card>
        )}

        {mine.map((o) => {
          const done = o.status === "ENTREGUE";
          return (
            <Card key={o.id} className="p-4" style={{ borderColor: done ? C.gray800 : `${C.orange}55`, opacity: done ? 0.6 : 1 }}>
              <div className="flex items-center justify-between mb-2">
                <span style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 20 }}>#{o.code}</span>
                <StatusPill status={o.status} small />
              </div>

              {[["Cliente", o.customer.name], ["Endereço", o.customer.addr], ["Telefone", o.customer.phone],
                ["Valor", `${brl(o.total)} · ${o.payment}`], ["Saiu há", elapsed(o.startedAt || o.createdAt, now)]].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5" style={{ borderBottom: `1px solid ${C.gray850}` }}>
                  <span style={{ color: "#7a7a7a", fontSize: 11.5 }}>{k}</span>
                  <span style={{ color: C.white, fontSize: 12.5, fontWeight: 600, textAlign: "right", maxWidth: "62%" }}>{v}</span>
                </div>
              ))}

              {!done && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Btn variant="dark" onClick={() => store.toast(`Chegada registrada no pedido #${o.code}`)}>CHEGUEI NO LOCAL</Btn>
                  <Btn variant="green" onClick={() => store.setStatus(o.id, "ENTREGUE")}>PEDIDO ENTREGUE</Btn>
                  <Btn variant="dark" onClick={() => store.toast("Abrindo rota no mapa")}>🗺 VER ROTA</Btn>
                  <Btn variant="danger" onClick={() => store.toast("Suporte acionado para este pedido")}>PROBLEMA</Btn>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default DriverApp;

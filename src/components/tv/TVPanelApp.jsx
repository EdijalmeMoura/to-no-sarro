import React, { useState, useEffect, useRef } from "react";
import { C, font } from "../../constants/theme.js";
import { brl, elapsed } from "../../utils/format.js";
import { Card, Logo } from "../ui/index.jsx";

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
  } catch {}
}
function playReadyChime() { beep(880, 0.18); setTimeout(() => beep(1320, 0.22), 180); }

export default function TVPanelApp({ store, now }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("sarro_sound_tv") !== "0");
  const lastReadyRef = useRef("");

  const inPrep = store.orders.filter((o) => ["NOVO", "CONFIRMADO", "PREPARO"].includes(o.status));
  const isReady = store.orders.filter((o) => ["PRONTO", "EMBALADO", "AGUARDANDO"].includes(o.status));

  useEffect(() => {
    const readyCodes = isReady.map((o) => o.code).join(",");
    if (lastReadyRef.current && lastReadyRef.current !== readyCodes) {
      if (soundOn && readyCodes.length > lastReadyRef.current.length) {
        playReadyChime();
      }
    }
    lastReadyRef.current = readyCodes;
  }, [isReady, soundOn]);

  return (
    <div style={{ background: C.black, minHeight: "100vh" }} className={fullscreen ? "p-2" : "p-4 md:p-6"}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Logo size={40} withText={false} />
          <div>
            <h2 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 28, color: C.white }}>PAINEL DE PEDIDOS</h2>
            <div style={{ color: "#7a7a7a", fontSize: 12 }}>{inPrep.length} em preparo · {isReady.length} prontos</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { const n = !soundOn; setSoundOn(n); localStorage.setItem("sarro_sound_tv", n ? "1" : "0"); if (n) playReadyChime(); }} className="rounded-lg px-2.5 py-1.5 font-bold" style={{ background: soundOn ? "#16653433" : C.gray850, border: `1px solid ${soundOn ? C.green : C.gray800}`, color: soundOn ? C.green : "#8a8a8a", fontSize: 11 }}>{soundOn ? "🔔 Som ON" : "🔕 Som OFF"}</button>
          <button onClick={() => setFullscreen(!fullscreen)} className="rounded-lg px-2.5 py-1.5 font-bold" style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 11 }}>{fullscreen ? "⤓ Sair tela cheia" : "⤢ Tela cheia"}</button>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div style={{ color: C.orange, fontWeight: 900, fontSize: 16, marginBottom: 12 }}>🔥 EM PREPARO ({inPrep.length})</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {inPrep.map((o) => (
              <div key={o.id} className="rounded-xl p-3 text-center" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
                <div style={{ color: C.white, fontWeight: 900, fontSize: 20 }}>#{o.code}</div>
                <div style={{ color: "#8a8a8a", fontSize: 11 }}>{o.customer.name.split(" ")[0]} · {elapsed(o.createdAt, now)}</div>
              </div>
            ))}
            {inPrep.length === 0 && <div style={{ color: "#6a6a6a", fontSize: 13 }}>Nenhum pedido em preparo</div>}
          </div>
        </Card>
        <Card className="p-4" style={{ borderColor: `${C.green}66`, background: `${C.green}0d` }}>
          <div style={{ color: C.green, fontWeight: 900, fontSize: 16, marginBottom: 12 }}>✅ PRONTOS PARA RETIRADA / ENTREGA ({isReady.length})</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {isReady.map((o) => (
              <div key={o.id} className="rounded-xl p-3 text-center" style={{ background: C.black, border: `2px solid ${C.green}`, animation: "sarropulse 1.5s ease-in-out infinite" }}>
                <div style={{ color: C.white, fontWeight: 900, fontSize: 22 }}>#{o.code}</div>
                <div style={{ color: C.green, fontSize: 11, fontWeight: 800 }}>{o.customer.name.split(" ")[0]}</div>
              </div>
            ))}
            {isReady.length === 0 && <div style={{ color: "#6a6a6a", fontSize: 13 }}>Nenhum pedido pronto</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

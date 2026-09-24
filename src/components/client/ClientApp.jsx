
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";


const SYNONYMS = {
  bacon: ["bacon"], apimentado: ["picante"], picante: ["picante"],
  barato: [], vegetariano: ["grão-de-bico", "veg"], doce: ["açaí", "brownie", "milkshake"],
}

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

function useDragScroll() {
  const ref = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const drag = useRef({ startX: 0, scrollLeft: 0, moved: false, suppress: false, pointerId: null });

  const update = () => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 8;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 10;
    setCanLeft(left);
    setCanRight(right);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const onScroll = () => update();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const t = setTimeout(update, 300);
    return () => { el.removeEventListener("scroll", onScroll); ro.disconnect(); clearTimeout(t); };
  }, []);

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    drag.current.startX = e.clientX;
    drag.current.scrollLeft = el.scrollLeft;
    drag.current.moved = false;
    drag.current.suppress = false;
    drag.current.pointerId = e.pointerId;
    setIsDragging(true);
    el.classList.add("dragging");
    try { el.setPointerCapture(e.pointerId); } catch {}
  };

  const onPointerMove = (e) => {
    const el = ref.current;
    if (!isDragging || !el) return;
    if (drag.current.pointerId !== null && e.pointerId !== drag.current.pointerId) return;
    const dx = e.clientX - drag.current.startX;
    if (!drag.current.moved && Math.abs(dx) < 5) return;
    if (Math.abs(dx) >= 5) {
      drag.current.moved = true;
      drag.current.suppress = true;
    }
    el.scrollLeft = drag.current.scrollLeft - dx;
  };

  const endDrag = (e) => {
    const el = ref.current;
    if (!el) return;
    if (drag.current.pointerId !== null) {
      try { el.releasePointerCapture(drag.current.pointerId); } catch {}
    }
    setIsDragging(false);
    el.classList.remove("dragging");
    if (drag.current.suppress) {
      el.style.scrollSnapType = "none";
      setTimeout(() => {
        if (el) el.style.scrollSnapType = "";
        drag.current.moved = false;
        drag.current.suppress = false;
        update();
      }, 180);
    } else {
      drag.current.moved = false;
      drag.current.suppress = false;
    }
    drag.current.pointerId = null;
    update();
  };

  const onClickCapture = (e) => {
    if (drag.current.suppress) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const scrollBy = (dir) => {
    const el = ref.current;
    if (!el) return;
    const amount = Math.max(180, el.clientWidth * 0.82) * dir;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onPointerLeave: (e) => { if (isDragging) endDrag(e); },
    onClickCapture,
  };

  return { ref, isDragging, canLeft, canRight, scrollBy, handlers, update };
}

function smartSearch(q, products) {
  const term = q.trim().toLowerCase();
  if (!term) return products;
  const words = term.split(/\s+/).filter((w) => w.length > 2);
  const cheap = /barat|promo|desconto/.test(term);
  const scored = products.map((p) => {
    const hay = [p.name, p.desc, p.cat, ...(p.ingredients || [])].join(" ").toLowerCase();
    let score = 0;
    words.forEach((w) => {
      if (hay.includes(w)) score += 3;
      (SYNONYMS[w] || []).forEach((s) => { if (hay.includes(s)) score += 2; });
      if (p.name.toLowerCase().includes(w)) score += 4;
    });
    if (cheap && (p.promo || p.price < 25)) score += 4;
    return { p, score };
  });
  const hits = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  return hits.map((h) => h.p);
}

function Hero({ store, onOrder }) {
  return (
    <div className="relative overflow-hidden" style={{ background: C.black }}>
      {/* brilho quente + riscos de velocidade da marca */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(120% 90% at 82% 0%, ${C.orange}40 0%, transparent 55%), radial-gradient(80% 60% at 0% 100%, ${C.yellow}1f 0%, transparent 60%)`,
        }}
      />
      <div
        className="absolute pointer-events-none hidden sm:block"
        style={{ left: "-14%", top: "13%", width: "68%", height: 3, background: `linear-gradient(90deg, transparent, ${C.orange}aa, transparent)`, transform: "rotate(-8deg)" }}
      />
      <div
        className="absolute pointer-events-none hidden sm:block"
        style={{ left: "-10%", top: "21%", width: "52%", height: 2, background: `linear-gradient(90deg, transparent, ${C.yellow}77, transparent)`, transform: "rotate(-8deg)" }}
      />

      <div className="relative px-4 sm:px-5 pt-4 sm:pt-5 pb-6 sm:pb-7 max-w-[640px] mx-auto w-full">
        <div className="flex items-center justify-between mb-4 sm:mb-5 gap-2">
          <Logo size={50} glow style={{ width: "clamp(44px, 12vw, 54px)", height: "clamp(44px, 12vw, 54px)" }} />
          <div
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full shrink-0"
            style={{ background: C.gray850, border: `1px solid ${store.openNow ? C.green : C.red}55` }}
          >
            <span
              style={{ width: 8, height: 8, borderRadius: 99, background: store.openNow ? C.green : C.red, display: "inline-block", animation: "sarropulse 1.8s infinite" }}
            />
            <span style={{ fontSize: "clamp(10px, 2.8vw, 11px)", fontWeight: 800, color: store.openNow ? C.green : C.red, whiteSpace: "nowrap" }}>
              {store.openNow ? "Aberto agora" : `Fechado${store.nextOpen ? ` · ${store.nextOpen.badge}` : ""}`}
            </span>
          </div>
        </div>

        <div style={{ fontFamily: font.display, fontStyle: "italic", letterSpacing: "-0.03em" }}>
          <div style={{ fontSize: "clamp(26px, 8vw, 38px)", lineHeight: 0.94, color: C.white }}>BATEU A FOME?</div>
          <div style={{ fontSize: "clamp(28px, 9.2vw, 43px)", lineHeight: 0.98, color: C.orange, textShadow: `3px 3px 0 ${C.black}, 0 0 36px ${C.orange}55` }}>
            ENTÃO TÁ NO SARRO! 🔥
          </div>
        </div>

        <p style={{ color: "#bdbdbd", fontSize: "clamp(12px, 3.4vw, 13px)", marginTop: 12, maxWidth: 430, lineHeight: 1.55 }}>
          Burger artesanal na chapa e açaí batido na hora, saindo do Janga direto
          pra sua casa. {store.openNow ? "Entrega em 35–45 min." : store.nextOpen ? `Voltamos ${store.nextOpen.suffix}.` : "Voltamos em breve."}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-3 mt-5">
          <Btn onClick={onOrder} full={false} style={{ paddingLeft: "clamp(20px, 5vw, 28px)", paddingRight: "clamp(20px, 5vw, 28px)", boxShadow: `0 10px 32px ${C.orange}45`, flex: "0 0 auto", minWidth: 140 }}>
            PEDIR AGORA
          </Btn>
          <div className="flex items-center gap-2 flex-wrap" style={{ color: "#8a8a8a", fontSize: "clamp(10px, 2.9vw, 11px)" }}>
            <span>⭐ 4,9</span><span>•</span><span>🛵 {brl(store.fee)}</span><span>•</span><span>⏱ 35–45min</span>
          </div>
        </div>

        {/* foto hero: apetite vende pedido */}
        <div
          className="sarro-imgzoom rounded-2xl overflow-hidden mt-5 sm:mt-6"
          style={{
            height: "clamp(160px, 52vw, 220px)",
            border: `1px solid ${C.gray800}`,
            boxShadow: `0 20px 60px rgba(0,0,0,.65), 0 0 0 1px ${C.orange}1f`,
          }}
        >
          <SmartImg id="p1" emoji="🍔" alt="Sarro Burger — o queridinho da casa" fs={72} />
        </div>
      </div>
    </div>
  );
}

function ProductCard({ p, onOpen }) {
  const price = p.promo || p.price;
  return (
    <Card
      onClick={() => p.available && onOpen(p)}
      className="p-2.5 sm:p-3 flex gap-2.5 sm:gap-3 items-center group"
      style={{ opacity: p.available ? 1 : 0.45, cursor: p.available ? "pointer" : "not-allowed" }}
    >
      <div
        className="shrink-0 rounded-xl overflow-hidden sarro-imgzoom"
        style={{ width: "clamp(68px, 20vw, 88px)", height: "clamp(68px, 20vw, 88px)", border: `1px solid ${p.promo ? `${C.orange}70` : C.gray800}` }}
      >
        <SmartImg id={p.id} emoji={p.emoji} alt={p.name} fs={32} file={p.img} v={p.updatedAt} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap mb-1">
          {p.badges.includes("maisvendido") && <Badge color={C.yellow}>MAIS VENDIDO</Badge>}
          {p.badges.includes("novidade") && <Badge color={C.white}>NOVIDADE</Badge>}
          {p.badges.includes("promocao") && <Badge color={C.red} text={C.white}>PROMO</Badge>}
        </div>
        <div style={{ fontWeight: 800, color: C.white, fontSize: "clamp(13.5px, 3.8vw, 15px)", lineHeight: 1.2 }} className="line-clamp-2">{p.name}</div>
        <div style={{ color: "#9a9a9a", fontSize: "clamp(10.5px, 3vw, 11.5px)", lineHeight: 1.35, marginTop: 2 }} className="line-clamp-2">
          {p.desc}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 flex-wrap">
          <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: "clamp(13px, 3.6vw, 15px)" }}>{brl(price)}</span>
          {p.promo && <span style={{ color: "#6e6e6e", fontSize: 11, textDecoration: "line-through" }}>{brl(p.price)}</span>}
          <span style={{ color: "#6e6e6e", fontSize: 10 }}>• {p.time} min</span>
        </div>
      </div>
      <button
        className="shrink-0 rounded-xl flex items-center justify-center font-black active:scale-90 transition group-active:scale-95"
        style={{ width: "clamp(36px, 10vw, 40px)", height: "clamp(36px, 10vw, 40px)", background: C.orange, color: C.black, fontSize: 22, lineHeight: 1 }}
        aria-label={`Adicionar ${p.name}`}
      >
        +
      </button>
    </Card>
  );
}

function MenuScreen({ store, onOpen }) {
  const [cat, setCat] = useState("burgers");
  const [q, setQ] = useState("");
  const refs = useRef({});

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
    <div>
      <div className="px-4 pt-4 pb-2 sticky top-0 z-20" style={{ background: C.black }}>
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busque: “burger com bacon”, “combo barato”, “açaí”…"
            className="w-full rounded-2xl pl-10 pr-4 py-3 outline-none"
            style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 13 }}
          />
          <span className="absolute left-3.5 top-3.5" style={{ fontSize: 15 }}>🔍</span>
        </div>

        {!searching && (
          <div className="flex gap-2 overflow-x-auto pb-2 pt-3" style={{ scrollbarWidth: "none" }}>
            {CATEGORIES.map((c) => {
              const on = cat === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => go(c.id)}
                  className="shrink-0 rounded-full px-3.5 py-2 font-bold"
                  style={{
                    background: on ? `linear-gradient(100deg, ${C.orange}, ${C.yellow})` : C.gray850,
                    color: on ? C.black : "#c9c9c9",
                    border: `1px solid ${on ? "transparent" : C.gray800}`, fontSize: 12.5, whiteSpace: "nowrap",
                  }}
                >
                  {c.icon} {c.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 pb-6">
        {searching ? (
          <>
            <div style={{ color: "#8a8a8a", fontSize: 12, margin: "10px 2px" }}>
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
          CATEGORIES.map((c) => {
            const items = byCat(c.id);
            if (!items.length) return null;
            return (
              <div key={c.id} ref={(el) => (refs.current[c.id] = el)} className="pt-5" style={{ scrollMarginTop: 130 }}>
                <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: C.white, marginBottom: 12, letterSpacing: "-0.02em" }}>
                  {c.icon} {c.label.toUpperCase()}
                </h3>
                <div className="space-y-3">
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

function HomeScreen({ store, onOpen, goMenu }) {
  const top = store.products.filter((p) => p.badges.includes("maisvendido"));
  const promos = store.products.filter((p) => p.promo);
  const novos = store.products.filter((p) => p.badges.includes("novidade"));

  const Row = ({ title, sub, items }) => (
    <div className="pt-6">
      <div className="px-4 mb-3">
        <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: C.white, letterSpacing: "-0.02em" }}>
          {title}
        </h3>
        {sub && <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>{sub}</div>}
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
        {items.map((p) => (
          <Card key={p.id} onClick={() => onOpen(p)} className="shrink-0 p-2.5 sarro-imgzoom" style={{ width: 174, cursor: "pointer" }}>
            <div className="rounded-xl overflow-hidden mb-2" style={{ height: 110, border: `1px solid ${C.gray800}` }}>
              <SmartImg id={p.id} emoji={p.emoji} alt={p.name} fs={44} file={p.img} v={p.updatedAt} />
            </div>
            <div style={{ color: C.white, fontWeight: 800, fontSize: 13.5 }}>{p.name}</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 14 }}>{brl(p.promo || p.price)}</span>
              {p.promo && <span style={{ color: "#6e6e6e", fontSize: 10.5, textDecoration: "line-through" }}>{brl(p.price)}</span>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="pb-6">
      <Hero store={store} onOrder={goMenu} />

      <div className="px-4 -mt-4 relative z-10">
        <Card className="p-4 flex items-center gap-3" style={{ borderColor: `${C.orange}55` }}>
          <div className="rounded-xl overflow-hidden shrink-0 sarro-imgzoom" style={{ width: 50, height: 50, border: `1px solid ${C.orange}55` }}>
            <SmartImg id="p16" emoji="🛠️" alt="Monte seu Sarro" fs={24} />
          </div>
          <div className="flex-1">
            <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Monte seu Sarro</div>
            <div style={{ color: "#9a9a9a", fontSize: 11.5 }}>Pão, carne, queijo e molho do seu jeito</div>
          </div>
          <Btn small onClick={() => onOpen(store.products.find((p) => p.builder))}>Montar</Btn>
        </Card>
      </div>

      <Row title="🔥 OS QUERIDINHOS DO SARRO" sub="O que mais sai da chapa" items={top} />
      <Row title="💥 OFERTAS DE HOJE" sub="Enquanto durar o estoque" items={promos} />
      {novos.length > 0 && <Row title="✨ NOVIDADES" sub="Recém-chegados no cardápio" items={novos} />}

      <div className="px-4 pt-7">
        <Card className="p-4" style={{ background: `linear-gradient(120deg, ${C.orange}22, ${C.gray850})`, borderColor: `${C.orange}44` }}>
          <div style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>🔥 Happy Hour do Sarro</div>
          <div style={{ color: "#c9c9c9", fontSize: 12.5, marginTop: 4 }}>
            Das 18h às 20h, todo combo sai com 15% de desconto. Sem cupom, o preço já cai no carrinho.
          </div>
        </Card>
      </div>
    </div>
  );
}

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
    <div className="px-4 py-5 pb-6">
      <h2 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 24, color: C.white, marginBottom: 14 }}>
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
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {upsell.map((p) => (
            <Card key={p.id} className="shrink-0 p-2.5 sarro-imgzoom" style={{ width: 138 }}>
              <div className="rounded-lg overflow-hidden mb-2" style={{ height: 66, border: `1px solid ${C.gray800}` }}>
                <SmartImg id={p.id} emoji={p.emoji} alt={p.name} fs={30} file={p.img} v={p.updatedAt} />
              </div>
              <div style={{ color: C.white, fontSize: 12, fontWeight: 700, lineHeight: 1.25 }}>{p.name}</div>
              <div style={{ color: C.yellowLight, fontWeight: 900, fontSize: 12.5, margin: "4px 0 8px" }}>{brl(p.promo || p.price)}</div>
              <Btn small full onClick={() => onOpen(p)}>Adicionar</Btn>
            </Card>
          ))}
        </div>
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
        <Btn full onClick={() => goCheckout({ subtotal, fee, discount, total })} disabled={!store.openNow}>
          {store.openNow
            ? "FINALIZAR PEDIDO"
            : store.nextOpen
              ? `LOJA FECHADA — VOLTA ${store.nextOpen.suffix.toUpperCase()}`
              : "LOJA FECHADA"}
        </Btn>
      </div>
    </div>
  );
}

function ProductModal({ p, store, onClose, onAdd }) {
  const [qty, setQty] = useState(1);
  const [sel, setSel] = useState({});
  const [note, setNote] = useState("");
  const bGroups = store.builder || [];
  const [build, setBuild] = useState(() =>
    Object.fromEntries(bGroups.map((g) => [g.id, g.options[0]?.id]))
  );

  const groups = (p.groups || [])
    .map((g) => store.optionGroups.find((x) => x.id === g))
    .filter(Boolean);

  const toggle = (g, o) => {
    setSel((prev) => {
      const cur = prev[g.id] || [];
      const has = cur.find((x) => x.id === o.id);
      if (has) return { ...prev, [g.id]: cur.filter((x) => x.id !== o.id) };
      if (g.max === 1) return { ...prev, [g.id]: [o] };
      if (cur.length >= g.max) return prev;
      return { ...prev, [g.id]: [...cur, o] };
    });
  };

  const chosen = Object.values(sel).flat();
  const allBuilderOpts = bGroups.flatMap((g) => g.options);
  const buildExtra = p.builder
    ? Object.values(build).reduce((s, oid) => s + (allBuilderOpts.find((o) => o.id === oid)?.price || 0), 0)
    : 0;
  const unit = (p.promo || p.price) + chosen.reduce((s, o) => s + o.price, 0) + buildExtra;
  const missing = groups.filter((g) => g.required && (sel[g.id] || []).length < g.min);

  const add = () => {
    const opts = p.builder
      ? Object.entries(build).map(([gid, oid]) => {
          const g = bGroups.find((x) => x.id === gid);
          const o = g?.options.find((x) => x.id === oid);
          return { id: o.id, name: `${g.label.replace("Escolha o ", "").replace("Escolha a ", "")}: ${o.name}`, price: o.price };
        })
      : chosen;
    const optionIds = p.builder ? Object.values(build) : chosen.map((o) => o.id);
    onAdd({ id: uid(), productId: p.id, name: p.name, emoji: p.emoji, qty, unit, opts, optionIds, note });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,.78)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div
        className="w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[92vh] overflow-y-auto no-scrollbar flex flex-col"
        style={{ background: C.gray900, borderTop: `3px solid ${C.orange}`, borderRadius: "22px 22px 0 0" }}
      >
        <div className="relative sarro-imgzoom shrink-0" style={{ height: "clamp(148px, 42vw, 172px)", background: `linear-gradient(135deg, ${C.orange}33, ${C.black})` }}>
          <SmartImg id={p.id} emoji={p.emoji} alt={p.name} fs={72} file={p.img} v={p.updatedAt} />
          <div
            className="absolute inset-x-0 bottom-0 pointer-events-none"
            style={{ height: 90, background: `linear-gradient(180deg, transparent, ${C.gray900})` }}
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full flex items-center justify-center"
            style={{ width: 34, height: 34, background: "rgba(0,0,0,.6)", color: C.white, fontSize: 18 }}
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-5 flex-1">
          <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: "clamp(20px, 5.5vw, 26px)", color: C.white, letterSpacing: "-0.02em" }}>
            {p.name.toUpperCase()}
          </h3>
          <p style={{ color: "#a5a5a5", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{p.desc}</p>

          {!p.builder && (
            <ul className="mt-3 space-y-1">
              {p.ingredients.map((i) => (
                <li key={i} style={{ color: "#d0d0d0", fontSize: 12.5 }}>· {i}</li>
              ))}
            </ul>
          )}

          {p.builder &&
            bGroups.map((g) => (
              <div key={g.id} className="mt-5">
                <div style={{ color: C.yellowLight, fontWeight: 800, fontSize: 13, marginBottom: 8 }}>{g.label}</div>
                <div className="flex flex-wrap gap-2">
                  {g.options.map((o) => {
                    const on = build[g.id] === o.id;
                    return (
                      <button
                        key={o.id}
                        onClick={() => setBuild({ ...build, [g.id]: o.id })}
                        className="rounded-xl px-3 py-2 text-left"
                        style={{
                          background: on ? `${C.orange}22` : C.gray850,
                          border: `1px solid ${on ? C.orange : C.gray800}`, color: C.white, fontSize: 12.5, fontWeight: 600,
                        }}
                      >
                        {o.name}
                        {o.price !== 0 && (
                          <span style={{ color: o.price > 0 ? C.yellowLight : C.green, marginLeft: 6, fontWeight: 800 }}>
                            {o.price > 0 ? `+${brl(o.price)}` : brl(o.price)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

          {groups.map((g) => (
            <div key={g.id} className="mt-5">
              <div className="flex items-center justify-between mb-2 gap-2">
                <span style={{ color: C.yellowLight, fontWeight: 800, fontSize: 13 }}>{g.name}</span>
                <span style={{ color: "#777", fontSize: 10.5, whiteSpace: "nowrap" }}>
                  {g.required ? "Obrigatório" : "Opcional"} · até {g.max}
                </span>
              </div>
              <div className="space-y-2">
                {g.options.map((o) => {
                  const on = !!(sel[g.id] || []).find((x) => x.id === o.id);
                  return (
                    <button
                      key={o.id}
                      onClick={() => toggle(g, o)}
                      className="w-full flex items-center justify-between rounded-xl px-3 py-2.5"
                      style={{
                        background: on ? `${C.orange}1c` : C.gray850,
                        border: `1px solid ${on ? C.orange : C.gray800}`,
                      }}
                    >
                      <span className="flex items-center gap-2" style={{ color: C.white, fontSize: 13 }}>
                        <span
                          className="flex items-center justify-center"
                          style={{
                            width: 18, height: 18, borderRadius: g.max === 1 ? 99 : 5,
                            border: `2px solid ${on ? C.orange : "#4a4a4a"}`, background: on ? C.orange : "transparent",
                            color: C.black, fontSize: 11, fontWeight: 900,
                          }}
                        >
                          {on ? "✓" : ""}
                        </span>
                        {o.name}
                      </span>
                      {o.price > 0 && <span style={{ color: C.yellowLight, fontSize: 12.5, fontWeight: 800 }}>+{brl(o.price)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mt-5">
            <div style={{ color: C.yellowLight, fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Alguma observação?</div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: caprichar no molho, cortar ao meio…"
              className="w-full rounded-xl px-3 py-3 outline-none"
              style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 13 }}
            />
          </div>
        </div>

        <div className="sticky bottom-0 p-4 flex items-center gap-3 safe-bottom" style={{ background: C.black, borderTop: `1px solid ${C.gray800}` }}>
          <div className="flex items-center gap-3 rounded-xl px-3 py-2 shrink-0" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
            <button onClick={() => setQty(Math.max(1, qty - 1))} style={{ color: C.orange, fontSize: 20, fontWeight: 900 }}>−</button>
            <span style={{ color: C.white, fontWeight: 900, minWidth: 18, textAlign: "center" }}>{qty}</span>
            <button onClick={() => setQty(qty + 1)} style={{ color: C.orange, fontSize: 20, fontWeight: 900 }}>+</button>
          </div>
          <Btn full onClick={add} disabled={missing.length > 0} style={{ minWidth: 0 }}>
            {missing.length > 0 ? `Escolha: ${missing[0].name}` : `Adicionar · ${brl(unit * qty)}`}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function Checkout({ store, totals, onBack, onDone }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({
    name: "", phone: "", cpf: "", type: "delivery",
    street: "", number: "", district: "", city: "Paulista/PE", ref: "",
    payment: "PIX", changeFor: "", needChange: false,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const fee = f.type === "pickup" ? 0 : totals.fee;
  const total = Math.max(0, totals.subtotal + fee - totals.discount);

  const steps = ["Você", "Entrega", "Endereço", "Pagamento", "Confirmar"];
  const valid = {
    1: f.name.trim().length > 2 && f.phone.replace(/\D/g, "").length >= 10,
    2: true,
    3: f.type === "pickup" || (f.street.trim() && f.number.trim() && f.district.trim()),
    4: f.payment !== "Dinheiro" || !f.needChange || f.changeFor.trim(),
    5: true,
  };

  const finish = () => {
    // O servidor recalcula preços, cupom, taxa e total — aqui vai só a intenção.
    onDone({
      customer: {
        name: f.name,
        phone: f.phone,
        addr: f.type === "pickup" ? "Retirada na loja" : `${f.street}, ${f.number} — ${f.district}, ${f.city}`,
      },
      type: f.type,
      payment: f.payment,
      changeFor: f.payment === "Dinheiro" && f.needChange ? f.changeFor : undefined,
      couponCode: store.coupon?.code || undefined,
      note: f.ref,
      items: store.cart.map((i) => ({
        productId: i.productId,
        qty: i.qty,
        optionIds: i.optionIds || [],
        note: i.note || "",
      })),
    });
  };

  return (
    <div className="px-4 py-5 pb-6">
      <button onClick={step === 1 ? onBack : () => setStep(step - 1)} style={{ color: "#8a8a8a", fontSize: 13 }}>
        ← Voltar
      </button>

      <div className="flex gap-1.5 mt-4 mb-5">
        {steps.map((s, i) => (
          <div key={s} className="flex-1">
            <div style={{ height: 4, borderRadius: 9, background: i < step ? C.orange : C.gray800 }} />
            <div style={{ color: i < step ? C.white : "#6a6a6a", fontSize: 9.5, marginTop: 5, fontWeight: 700 }}>{s}</div>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 22, color: C.white }}>QUEM TÁ PEDINDO?</h3>
          <Field label="Nome completo" value={f.name} onChange={(v) => set("name", v)} ph="João Silva" />
          <Field label="WhatsApp" value={f.phone} onChange={(v) => set("phone", v)} ph="(81) 99999-9999" />
          <Field label="CPF na nota (opcional)" value={f.cpf} onChange={(v) => set("cpf", v)} ph="000.000.000-00" />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 22, color: C.white, marginBottom: 6 }}>
            COMO VOCÊ QUER RECEBER?
          </h3>
          <Choice on={f.type === "delivery"} onClick={() => set("type", "delivery")} icon="🛵"
            title="Delivery" sub={`35–45 min · taxa ${brl(store.fee)}`} />
          <Choice on={f.type === "pickup"} onClick={() => set("type", "pickup")} icon="🏪"
            title="Retirar na loja" sub="Pronto em ~20 min · sem taxa" />
        </div>
      )}

      {step === 3 && (
        f.type === "pickup" ? (
          <div>
            <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 22, color: C.white }}>RETIRADA NA LOJA</h3>
            <Card className="p-4 mt-4">
              <div style={{ color: C.white, fontWeight: 800, fontSize: 14 }}>TÔ NO SARRO! Burgers & Açaí</div>
              <div style={{ color: "#9a9a9a", fontSize: 12.5, marginTop: 6, lineHeight: 1.5 }}>
                Av. Cláudio José Gueiros Leite, 3200 — Janga, Paulista/PE<br />
                Aberto de terça a domingo, 18h às 23h30
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 22, color: C.white }}>ONDE ENTREGAMOS?</h3>
            <Field label="Rua" value={f.street} onChange={(v) => set("street", v)} ph="Rua das Palmeiras" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Número" value={f.number} onChange={(v) => set("number", v)} ph="220" />
              <Field label="Bairro" value={f.district} onChange={(v) => set("district", v)} ph="Janga" />
            </div>
            <Field label="Cidade" value={f.city} onChange={(v) => set("city", v)} ph="Paulista/PE" />
            <Field label="Ponto de referência" value={f.ref} onChange={(v) => set("ref", v)} ph="Portão preto, ao lado da padaria" />
          </div>
        )
      )}

      {step === 4 && (
        <div className="space-y-3">
          <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 22, color: C.white, marginBottom: 6 }}>
            COMO VAI PAGAR?
          </h3>
          <Choice on={f.payment === "PIX"} onClick={() => set("payment", "PIX")} icon="⚡" title="Pix" sub="Aprovação na hora · checkout seguro InfinitePay" />
          <Choice on={f.payment === "CARTAO_ONLINE"} onClick={() => set("payment", "CARTAO_ONLINE")} icon="💳" title="Cartão online" sub="Crédito em até 12x · link seguro InfinitePay" />
          <Choice on={f.payment === "Cartão"} onClick={() => set("payment", "Cartão")} icon="🛵" title="Cartão na entrega" sub="Maquininha com o entregador" />
          <Choice on={f.payment === "Dinheiro"} onClick={() => set("payment", "Dinheiro")} icon="💵" title="Dinheiro" sub="Pagamento na entrega" />

          {f.payment === "CARTAO_ONLINE" && (
            <Card className="p-4">
              <div style={{ color: "#9a9a9a", fontSize: 12, lineHeight: 1.5 }}>
                Você recebe um <strong style={{ color: C.yellowLight }}>link seguro da InfinitePay</strong> ♾️ para pagar com
                crédito em até 12x. Nenhum dado de cartão passa pelo nosso sistema.
              </div>
            </Card>
          )}

          {f.payment === "Dinheiro" && (
            <Card className="p-4 space-y-3">
              <div style={{ color: C.white, fontWeight: 800, fontSize: 13.5 }}>Precisa de troco?</div>
              <div className="flex gap-2">
                <Btn small variant={f.needChange ? "primary" : "dark"} onClick={() => set("needChange", true)}>Sim</Btn>
                <Btn small variant={!f.needChange ? "primary" : "dark"} onClick={() => set("needChange", false)}>Não precisa</Btn>
              </div>
              {f.needChange && <Field label="Troco para quanto?" value={f.changeFor} onChange={(v) => set("changeFor", v)} ph="R$ 100,00" />}
            </Card>
          )}

          {f.payment === "PIX" && (
            <Card className="p-4">
              <div style={{ color: "#9a9a9a", fontSize: 12, lineHeight: 1.5 }}>
                Ao confirmar, a gente te leva para o <strong style={{ color: C.yellowLight }}>checkout seguro da InfinitePay</strong> ♾️
                com o QR Code do Pix. A confirmação é automática — quando cair, seu pedido entra na cozinha na hora.
              </div>
            </Card>
          )}
        </div>
      )}

      {step === 5 && (
        <div>
          <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 22, color: C.white }}>CONFIRA TUDO</h3>
          <Card className="p-4 mt-4 space-y-2">
            {store.cart.map((i) => (
              <div key={i.id} className="flex justify-between" style={{ color: "#d0d0d0", fontSize: 13 }}>
                <span>{i.qty}x {i.name}</span><span>{brl(i.unit * i.qty)}</span>
              </div>
            ))}
            <div className="pt-2 space-y-1" style={{ borderTop: `1px solid ${C.gray800}` }}>
              <div className="flex justify-between" style={{ color: "#9a9a9a", fontSize: 12.5 }}>
                <span>Entrega</span><span>{fee === 0 ? "Grátis" : brl(fee)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between" style={{ color: C.green, fontSize: 12.5 }}>
                  <span>Desconto</span><span>−{brl(totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1">
                <span style={{ color: C.white, fontWeight: 900 }}>Total</span>
                <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 18 }}>{brl(total)}</span>
              </div>
            </div>
          </Card>
          <Card className="p-4 mt-3" style={{ fontSize: 12.5, color: "#9a9a9a", lineHeight: 1.6 }}>
            <div><strong style={{ color: C.white }}>{f.name}</strong> · {f.phone}</div>
            <div>{f.type === "pickup" ? "🏪 Retirada na loja" : `🛵 ${f.street}, ${f.number} — ${f.district}`}</div>
            <div>💳 {f.payment}{f.needChange && f.changeFor ? ` · troco para ${f.changeFor}` : ""}</div>
          </Card>
        </div>
      )}

      <div className="mt-6">
        <Btn full disabled={!valid[step]} onClick={() => (step === 5 ? finish() : setStep(step + 1))}>
          {step === 5 ? `CONFIRMAR PEDIDO · ${brl(total)}` : "Continuar"}
        </Btn>
      </div>
    </div>
  );
}

function TrackScreen({ order, store, now }) {
  // Atualização do próprio pedido: polling autenticado por token
  // (o canal público não carrega pedidos de outros clientes).
  useEffect(() => {
    if (!order) return;
    store.refreshMyOrder?.().catch(() => {});
    const t = setInterval(() => store.refreshMyOrder?.().catch(() => {}), 6000);
    return () => clearInterval(t);
  }, [order?.id]);
  // Enquanto o Pix/cartão não cai, o servidor consulta a InfinitePay a cada 6s
  useEffect(() => {
    if (order?.paymentStatus !== "pendente") return;
    const t = setInterval(() => store.checkPayment(order.id).catch(() => {}), 6000);
    return () => clearInterval(t);
  }, [order?.id, order?.paymentStatus]);

  if (!order) {
    return (
      <div className="px-4 py-16 text-center">
        <div style={{ fontSize: 52 }}>📦</div>
        <div style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 20, marginTop: 10 }}>
          NENHUM PEDIDO ATIVO
        </div>
        <p style={{ color: "#8a8a8a", fontSize: 13, marginTop: 6 }}>Quando você pedir, o acompanhamento aparece aqui.</p>
        <div className="mt-5 flex justify-center"><Btn onClick={() => store.setTab("cardapio")}>Ver cardápio</Btn></div>
      </div>
    );
  }

  const idx = TRACK_STEPS.findIndex((s) => s.key === order.status);
  const pos = order.status === "AGUARDANDO" ? 4 : idx;
  const done = order.status === "ENTREGUE";
  const driver = store.drivers.find((d) => d.id === order.driverId);

  return (
    <div className="px-4 py-5 pb-6">
      <div
        className="rounded-2xl p-5 mb-4"
        style={{ background: `linear-gradient(130deg, ${C.orange}, ${C.yellow})`, color: C.black }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.75 }}>Pedido #{order.code}</div>
          <div style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 26, lineHeight: 1.02, marginTop: 4 }}>
            {done ? "SEU SARRO CHEGOU! 🔥" : order.type === "pickup" ? "SEU SARRO TÁ SAINDO!" : "SEU SARRO ESTÁ A CAMINHO!"}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 8 }}>
          {done ? "Bom apetite. Volta sempre!" : order.type === "pickup" ? "Pronto para retirada em ~20 min" : "Previsão: 35–45 minutos"}
        </div>
      </div>

      {order.paymentStatus === "pendente" && (
        <Card className="p-4 mb-3" style={{ borderColor: `${C.yellow}66`, background: `${C.yellow}12` }}>
          <div style={{ color: C.yellowLight, fontWeight: 900, fontSize: 14 }}>
            ⏳ Aguardando pagamento {order.payment === "Cartão online" ? "do cartão" : "Pix"}
          </div>
          <div style={{ color: "#c9c9c9", fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
            Assim que a InfinitePay confirmar ♾️, seu pedido entra na fila da cozinha automaticamente.
          </div>
          {order.payUrl && (
            <div className="mt-3">
              <Btn full onClick={() => window.open(order.payUrl, "_blank")}>
                PAGAR AGORA · {order.payment === "Cartão online" ? "CARTÃO ♾️" : "PIX ♾️"}
              </Btn>
            </div>
          )}
        </Card>
      )}

      <Card className="p-5">
        {TRACK_STEPS.map((s, i) => {
          const isDone = i <= pos;
          const isNow = i === pos && !done;
          return (
            <div key={s.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{
                    width: 30, height: 30, borderRadius: 99, fontSize: 13,
                    background: isDone ? C.orange : C.gray800,
                    color: isDone ? C.black : "#6a6a6a",
                    animation: isNow ? "sarropulse 1.4s ease-in-out infinite" : "none",
                  }}
                >
                  {s.icon}
                </div>
                {i < TRACK_STEPS.length - 1 && (
                  <div style={{ width: 2, flex: 1, minHeight: 26, background: i < pos ? C.orange : C.gray800 }} />
                )}
              </div>
              <div className="pb-4">
                <div style={{ color: isDone ? C.white : "#6a6a6a", fontWeight: isNow ? 900 : 700, fontSize: 13.5 }}>
                  {s.label}
                </div>
                {isNow && (
                  <div style={{ color: C.yellowLight, fontSize: 11.5, marginTop: 2 }}>
                    agora · {elapsed(order.createdAt, now)} desde o pedido
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {driver && !done && (
        <Card className="p-4 mt-3 flex items-center gap-3">
          <div className="flex items-center justify-center rounded-full" style={{ width: 44, height: 44, background: C.gray800, fontSize: 22 }}>🛵</div>
          <div className="flex-1">
            <div style={{ color: C.white, fontWeight: 800, fontSize: 13.5 }}>{driver.name}</div>
            <div style={{ color: "#8a8a8a", fontSize: 11.5 }}>{driver.vehicle} · {driver.phone}</div>
          </div>
        </Card>
      )}

      <Card className="p-4 mt-3">
        <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Itens</div>
        {order.items.map((i) => (
          <div key={i.id} className="flex justify-between" style={{ color: "#a5a5a5", fontSize: 12.5, marginBottom: 3 }}>
            <span>{i.qty}x {i.name}</span><span>{brl(i.unit * i.qty)}</span>
          </div>
        ))}
        <div className="flex justify-between pt-2 mt-2" style={{ borderTop: `1px solid ${C.gray800}` }}>
          <span style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Total</span>
          <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 16 }}>{brl(order.total)}</span>
        </div>
      </Card>

      <div className="mt-4 flex gap-2">
        <Btn variant="dark" full onClick={() => store.toast("Abrindo conversa no WhatsApp da loja")}>
          <span className="inline-flex items-center justify-center gap-1.5">
            <WaIcon size={14} color="#25D366" /> Falar com a loja
          </span>
        </Btn>
      </div>
    </div>
  );
}

function AccountScreen({ store }) {
  const me = store.customers[0];
  if (!me) {
    return (
      <div className="px-4 py-16 text-center max-w-[640px] mx-auto">
        <div style={{ fontSize: 52 }}>😎</div>
        <div style={{ color: C.white, fontWeight: 900, fontSize: 16, marginTop: 10 }}>Sua conta aparece aqui</div>
        <p style={{ color: "#8a8a8a", fontSize: 13, marginTop: 6 }}>Faça seu primeiro pedido para entrar no Clube do Sarro.</p>
      </div>
    );
  }
  const pct = Math.min(100, me.points);
  const mine = store.orders.filter((o) => o.customer.name === me.name);
  return (
    <div className="px-3 sm:px-4 py-5 pb-6 max-w-[720px] mx-auto w-full overflow-x-hidden">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center rounded-full" style={{ width: 54, height: 54, background: C.gray800, fontSize: 26 }}>😎</div>
        <div>
          <div style={{ color: C.white, fontWeight: 900, fontSize: 17 }}>{me.name}</div>
          <div style={{ color: "#8a8a8a", fontSize: 12 }}>{me.phone} · cliente {me.tier}</div>
        </div>
      </div>

      <Card className="p-4" style={{ background: `linear-gradient(120deg, ${C.orange}26, ${C.gray850})`, borderColor: `${C.orange}44` }}>
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>🍔 Clube do Sarro</div>
        <div style={{ color: "#c0c0c0", fontSize: 12, marginTop: 4 }}>
          A cada R$ 10 gastos você ganha 1 ponto. Com 100 pontos, o burger é por nossa conta.
        </div>
        <div className="mt-3" style={{ height: 10, borderRadius: 9, background: C.gray800, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${C.orange}, ${C.yellowLight})` }} />
        </div>
        <div className="flex justify-between mt-2">
          <span style={{ color: C.yellowLight, fontWeight: 800, fontSize: 12 }}>{me.points} / 100 pontos</span>
          <span style={{ color: "#8a8a8a", fontSize: 12 }}>faltam {100 - me.points}</span>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3 mt-4">
        {[["Pedidos", me.orders], ["Gasto total", brl(me.spent)], ["Ticket médio", brl(me.spent / me.orders)]].map(([k, v]) => (
          <Card key={k} className="p-3">
            <div style={{ color: "#8a8a8a", fontSize: 10.5 }}>{k}</div>
            <div style={{ color: C.white, fontWeight: 900, fontSize: 14, marginTop: 3 }}>{v}</div>
          </Card>
        ))}
      </div>

      <div style={{ color: C.white, fontWeight: 900, fontSize: 14, margin: "22px 0 10px" }}>Seus pedidos</div>
      <div className="space-y-2">
        {mine.length === 0 && <Card className="p-4"><span style={{ color: "#8a8a8a", fontSize: 12.5 }}>Nenhum pedido ainda.</span></Card>}
        {mine.map((o) => (
          <Card key={o.id} className="p-3 flex items-center justify-between">
            <div>
              <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>#{o.code} · {o.items.length} itens</div>
              <div style={{ color: "#8a8a8a", fontSize: 11.5 }}>{brl(o.total)} · {o.payment}</div>
            </div>
            <StatusPill status={o.status} small />
          </Card>
        ))}
      </div>

      <Card className="p-4 mt-5">
        <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Endereço salvo</div>
        <div style={{ color: "#9a9a9a", fontSize: 12.5 }}>{me.addr}</div>
      </Card>
    </div>
  );
}

function BottomNav({ tab, setTab, cartCount }) {
  const items = [
    { id: "inicio", icon: "🏠", label: "Início" },
    { id: "cardapio", icon: "🍔", label: "Cardápio" },
    { id: "carrinho", icon: "🛒", label: "Carrinho" },
    { id: "pedidos", icon: "📦", label: "Pedidos" },
    { id: "conta", icon: "👤", label: "Conta" },
  ];
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 flex justify-center safe-bottom"
      style={{ background: "rgba(5,5,5,.96)", borderTop: `1px solid ${C.gray800}`, backdropFilter: "blur(10px)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex w-full max-w-[720px]">
        {items.map((i) => {
          const on = tab === i.id;
          return (
            <button key={i.id} onClick={() => setTab(i.id)} className="flex-1 flex flex-col items-center gap-0.5 py-2.5 relative">
              <span style={{ fontSize: "clamp(16px, 4.5vw, 18px)", filter: on ? "none" : "grayscale(1) opacity(.55)" }}>{i.icon}</span>
              <span style={{ fontSize: "clamp(9px, 2.6vw, 9.5px)", fontWeight: 800, color: on ? C.orange : "#6a6a6a" }}>{i.label}</span>
              {i.id === "carrinho" && cartCount > 0 && (
                <span
                  className="absolute flex items-center justify-center"
                  style={{ top: 4, right: "50%", marginRight: -22, width: 17, height: 17, borderRadius: 99, background: C.orange, color: C.black, fontSize: 10, fontWeight: 900 }}
                >
                  {cartCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ClientApp({ store, now }) {
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
    <div style={{ background: C.black, minHeight: "100%", paddingBottom: 66 }}>
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
        <>
          {store.tab === "inicio" && <HomeScreen store={store} onOpen={setModal} goMenu={() => store.setTab("cardapio")} />}
          {store.tab === "cardapio" && <MenuScreen store={store} onOpen={setModal} />}
          {store.tab === "carrinho" && <CartScreen store={store} onOpen={setModal} goCheckout={setCheckout} />}
          {store.tab === "pedidos" && <TrackScreen order={active} store={store} now={now} />}
          {store.tab === "conta" && <AccountScreen store={store} />}
        </>
      )}

      {modal && <ProductModal key={modal.id} p={modal} store={store} onClose={() => setModal(null)} onAdd={addToCart} />}

      {!checkout && store.tab !== "carrinho" && cartCount > 0 && (
        <button
          onClick={() => store.setTab("carrinho")}
          className="fixed z-30 flex items-center gap-3 rounded-2xl px-4 py-3 font-black active:scale-95 transition"
          style={{
            left: 16, right: 16, bottom: 78,
            background: `linear-gradient(100deg, ${C.orange}, ${C.yellow})`, color: C.black,
            boxShadow: "0 10px 30px rgba(245,130,0,.35)",
          }}
        >
          <span>🛒 {cartCount} {cartCount === 1 ? "item" : "itens"}</span>
          <span className="flex-1 text-right">{brl(store.cart.reduce((s, i) => s + i.unit * i.qty, 0))} →</span>
        </button>
      )}

      {!checkout && (
        <a
          onClick={(e) => { e.preventDefault(); store.toast("Abrindo WhatsApp da loja"); }}
          href="#whatsapp"
          className="fixed z-30 flex items-center justify-center rounded-full"
          style={{ right: 16, bottom: cartCount > 0 ? 142 : 78, width: 46, height: 46, background: "linear-gradient(135deg, #25D366, #128C7E)", fontSize: 21, boxShadow: "0 8px 22px rgba(0,0,0,.5)" }}
        >
          <WaIcon size={24} color="#fff" />
        </a>
      )}

      {!checkout && <BottomNav tab={store.tab} setTab={store.setTab} cartCount={cartCount} />}
    </div>
  );
}

export default ClientApp;
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import QRCode from "qrcode";
import { getOrderModality as getOrderModalityUtil } from "./utils/orderModality.js";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts.js";
import { extractTableNumber, getOrderTableNumber, buildMesaIndex } from "./utils/mesa.js";
import ServiceChargeCard from "./components/admin/ServiceChargeCard.jsx";
// Lazy load heavy panels for code splitting
const AdminTablesModular = React.lazy(() => import("./components/tables/AdminTables.jsx"));
const TrackScreenModular = React.lazy(() => import("./components/track/TrackScreen.jsx"));
const AdminDashboardModular = React.lazy(() => import("./components/admin/AdminDashboard.jsx"));
const AdminProductsModular = React.lazy(() => import("./components/admin/AdminProducts.jsx"));
const AdminCustomersModular = React.lazy(() => import("./components/admin/AdminCustomers.jsx"));
const AdminInventoryModular = React.lazy(() => import("./components/admin/AdminInventory.jsx"));
const AdminFinanceModular = React.lazy(() => import("./components/admin/AdminFinance.jsx"));
const AdminReportsModular = React.lazy(() => import("./components/admin/AdminReports.jsx"));
const AdminPromosModular = React.lazy(() => import("./components/admin/AdminPromos.jsx"));
const AdminUsersModular = React.lazy(() => import("./components/admin/AdminUsers.jsx"));
const AdminCategoriesModular = React.lazy(() => import("./components/admin/AdminCategories.jsx"));
const AdminIntegrationsModular = React.lazy(() => import("./components/admin/AdminIntegrations.jsx"));
const AdminPaymentsCardModular = React.lazy(() => import("./components/admin/AdminPaymentsCard.jsx"));
const AdminPrinterCardModular = React.lazy(() => import("./components/admin/AdminPrinterCard.jsx"));
const AdminStoreCardModular = React.lazy(() => import("./components/admin/AdminStoreCard.jsx"));
const AdminModalitiesCardModular = React.lazy(() => import("./components/admin/AdminModalitiesCard.jsx"));
const AdminCashRegisterModular = React.lazy(() => import("./components/admin/AdminCashRegister.jsx"));
const AdminAppModular = React.lazy(() => import("./components/admin/AdminApp.jsx"));
const MenuScreenModular = React.lazy(() => import("./components/client/MenuScreen.jsx"));
const HomeScreenModular = React.lazy(() => import("./components/client/HomeScreen.jsx"));
const CartScreenModular = React.lazy(() => import("./components/client/CartScreen.jsx"));
const CheckoutModular = React.lazy(() => import("./components/client/Checkout.jsx"));
const ClientAppModular = React.lazy(() => import("./components/client/ClientApp.jsx"));
const KitchenAppModular = React.lazy(() => import("./components/kitchen/KitchenApp.jsx"));
const ExpeditionAppModular = React.lazy(() => import("./components/expedition/ExpeditionApp.jsx"));
const TVPanelAppModular = React.lazy(() => import("./components/tv/TVPanelApp.jsx"));
const DriverAppModular = React.lazy(() => import("./components/driver/DriverApp.jsx"));




// ============================================================
// TÔ NO SARRO! — SMART FOOD SYSTEM
// Protótipo funcional de ponta a ponta:
// Cliente → Carrinho → Checkout → Pedido → Admin → Cozinha →
// Expedição → Entregador → Cliente
//
// Todo o estado vive em memória (useState) e é compartilhado
// entre os painéis, simulando o WebSocket de produção.
// ============================================================

// TÔ NO SARRO — SMART FOOD SYSTEM
// Camada de dados do protótipo. Em produção, tudo isto vem da API REST
// (ver docs/ARQUITETURA.md e docs/schema.sql).

const C = {
  black: "#050505",
  gray900: "#0d0d0d",
  gray850: "#151515",
  gray800: "#252525",
  gray700: "#343434",
  orange: "#F58200",
  yellow: "#FFB000",
  yellowLight: "#FFC928",
  white: "#FFFFFF",
  green: "#2ECC71",
  red: "#FF4D4D",
  blue: "#3BA9FF",
};

const STATUS = {
  NOVO: { label: "Novo", color: C.yellowLight, icon: "🆕" },
  CONFIRMADO: { label: "Confirmado", color: C.yellow, icon: "✅" },
  PREPARO: { label: "Em preparação", color: C.orange, icon: "🔥" },
  PRONTO: { label: "Pronto", color: C.green, icon: "🍔" },
  EMBALADO: { label: "Embalado", color: "#8FD14F", icon: "📦" },
  AGUARDANDO: { label: "Aguardando entregador", color: C.blue, icon: "⏳" },
  ROTA: { label: "Saiu para entrega", color: "#7C5CFF", icon: "🛵" },
  ENTREGUE: { label: "Entregue", color: "#5a5a5a", icon: "✓" },
  CANCELADO: { label: "Cancelado", color: C.red, icon: "✕" },
};

const FLOW = [
  "NOVO", "CONFIRMADO", "PREPARO", "PRONTO", "EMBALADO",
  "AGUARDANDO", "ROTA", "ENTREGUE",
];

const CHANNELS = {
  DIRECT: { label: "Cardápio próprio", short: "SARRO", color: C.orange, icon: "🔥" },
  WHATSAPP: { label: "WhatsApp", short: "ZAP", color: "#25D366", icon: "💬" },
  IFOOD: { label: "iFood", short: "IFOOD", color: "#EA1D2C", icon: "🔴" },
  NNFOOD: { label: "99Food", short: "99", color: "#FFD400", icon: "🟡" },
};

const CATEGORIES = [
  { id: "burgers", label: "Burgers", icon: "🍔" },
  { id: "combos", label: "Combos", icon: "🍟" },
  { id: "especiais", label: "Especiais", icon: "🥓" },
  { id: "porcoes", label: "Porções", icon: "🍗" },
  { id: "bebidas", label: "Bebidas", icon: "🥤" },
  { id: "sobremesas", label: "Sobremesas", icon: "🍫" },
  { id: "acai", label: "Açaí", icon: "🥣" },
  { id: "promocoes", label: "Promoções", icon: "🔥" },
];

const INTEGRATIONS = [
  { id: "ifood", name: "iFood", status: "conectado", desc: "Pedidos e status via API oficial do iFood (merchant + order events).", fields: ["Client ID", "Client Secret", "Merchant ID", "Webhook URL"], color: "#EA1D2C", orders: 12 },
  { id: "99food", name: "99Food", status: "pendente", desc: "Integração via API parceira. Aguardando liberação de credenciais.", fields: ["API Key", "Store ID", "Webhook URL"], color: "#FFD400", orders: 0 },
  { id: "whatsapp", name: "WhatsApp Business API", status: "conectado", desc: "Mensagens transacionais de status do pedido via templates aprovados.", fields: ["Phone Number ID", "Access Token", "Webhook Verify Token"], color: "#25D366", orders: 7 },
  { id: "pix", name: "Gateway de pagamento", status: "conectado", desc: "Camada desacoplada: Mercado Pago ativo. Suporta PagBank, Stone, Inter e Asaas.", fields: ["Provedor", "Access Token", "Webhook Secret"], color: C.blue, orders: 0 },
  { id: "print", name: "Impressão de comandas", status: "conectado", desc: "Impressora térmica 80mm na cozinha e na expedição.", fields: ["IP da impressora", "Modo (auto/manual)"], color: C.yellow, orders: 0 },
];

const SALES_BY_HOUR = [
  { h: "17h", v: 180 }, { h: "18h", v: 640 }, { h: "19h", v: 1180 },
  { h: "20h", v: 1520 }, { h: "21h", v: 1290 }, { h: "22h", v: 760 }, { h: "23h", v: 310 },
];

const SALES_BY_DAY = [
  { d: "Seg", v: 1820 }, { d: "Ter", v: 2140 }, { d: "Qua", v: 1990 },
  { d: "Qui", v: 2630 }, { d: "Sex", v: 4180 }, { d: "Sáb", v: 5240 }, { d: "Dom", v: 3910 },
];

const brl = (n) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const uid = () => Math.random().toString(36).slice(2, 9);

let audioCtx = null;
function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
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

function getOrderModality(o) {
  return getOrderModalityUtil(o);
}


// ============================================================
// CARROSSEL — hook + componentes reutilizáveis
// Responsivo, drag com pointer events, snap proximity, setas, fade
// ============================================================

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

function CarouselShell({ children, className = "", gap = 12, showArrows = true, fade = true }) {
  const { ref, canLeft, canRight, scrollBy, handlers, isDragging } = useDragScroll();
  return (
    <div className={`relative group/carousel ${fade ? "sarro-fade" : ""} ${!canLeft ? "no-left" : ""} ${!canRight ? "no-right" : ""}`}>
      <div
        ref={ref}
        className={`sarro-carousel no-scrollbar ${isDragging ? "dragging" : ""} ${className}`}
        style={{ gap, touchAction: "pan-y pinch-zoom" }}
        {...handlers}
      >
        {children}
      </div>
      {showArrows && (
        <>
          <button
            onClick={() => scrollBy(-1)}
            aria-label="Voltar"
            className={`hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center transition-all duration-200 ${canLeft ? "opacity-90 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"}`}
            style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, boxShadow: "0 4px 18px rgba(0,0,0,.5)" }}
          >
            ‹
          </button>
          <button
            onClick={() => scrollBy(1)}
            aria-label="Avançar"
            className={`hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center transition-all duration-200 ${canRight ? "opacity-90 translate-x-0" : "opacity-0 translate-x-2 pointer-events-none"}`}
            style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, boxShadow: "0 4px 18px rgba(0,0,0,.5)" }}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}

function ProductCarouselCard({ p, onOpen }) {
  return (
    <Card
      onClick={() => p.available && onOpen(p)}
      className="sarro-carousel-item p-2.5 sarro-imgzoom select-none"
      style={{
        width: "clamp(142px, 42vw, 174px)",
        cursor: p.available ? "pointer" : "not-allowed",
        opacity: p.available ? 1 : 0.5,
      }}
    >
      <div className="rounded-xl overflow-hidden mb-2 relative" style={{ height: "clamp(84px, 26vw, 110px)", border: `1px solid ${p.promo ? `${C.orange}70` : C.gray800}` }}>
        <SmartImg id={p.id} emoji={p.emoji} alt={p.name} fs={36} file={p.img} v={p.updatedAt} />
        {p.promo && (
          <span className="absolute top-1.5 left-1.5 rounded-full px-1.5 py-0.5 font-black" style={{ background: C.red, color: C.white, fontSize: 9, lineHeight: 1 }}>
            OFERTA
          </span>
        )}
      </div>
      <div style={{ color: C.white, fontWeight: 800, fontSize: "clamp(12px, 3.2vw, 13.5px)", lineHeight: 1.2 }} className="line-clamp-2 min-h-[2.4em]">
        {p.name}
      </div>
      <div className="flex items-baseline gap-1.5 mt-1 flex-wrap">
        <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 14 }}>{brl(p.promo || p.price)}</span>
        {p.promo && <span style={{ color: "#6e6e6e", fontSize: 10.5, textDecoration: "line-through" }}>{brl(p.price)}</span>}
      </div>
    </Card>
  );
}

// Fotos dos produtos (servidas de /public/img). A foto do produto usa o id
// (ex.: p1.jpg). Enquanto uma foto não existir, o SmartImg cai para o emoji.
const IMG_BASE = "img/products";
const LOGO_ROUND = "assets/logo-round.png";
// ============================================================
// UTILITÁRIOS DE UI
// ============================================================

const font = {
  display: "'Archivo Black', 'Arial Black', Impact, sans-serif",
  body: "'Inter', system-ui, -apple-system, Segoe UI, sans-serif",
};

// Folha global: sem isto o App explode (ReferenceError) e a tela fica preta.
const css = `
  @keyframes sarropulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: .45; transform: scale(1.18); }
  }
  @keyframes sarrofloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  @keyframes sarrofall {
    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
    100% { transform: translateY(110vh) rotate(280deg); opacity: 0; }
  }
  @keyframes sarroshimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(200%); }
  }
  .sarro-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .sarro-imgzoom { overflow: hidden; }
  .sarro-imgzoom img { width: 100%; height: 100%; object-fit: cover; display: block; }
  * { box-sizing: border-box; }
  html { overflow-x: hidden; -webkit-text-size-adjust: 100%; }
  body { margin: 0; overflow-x: hidden; width: 100%; max-width: 100vw; overscroll-behavior-y: contain; -webkit-tap-highlight-color: transparent; }
  #root { overflow-x: hidden; max-width: 100vw; }
  .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
  .no-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }
  /* Carrossel base — proximity evita o loop de voltar pro início no mobile */
  .sarro-carousel {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x proximity;
    scroll-padding-left: 16px;
    scroll-padding-right: 24px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
    overscroll-behavior-y: auto;
    cursor: grab;
    touch-action: pan-y pinch-zoom;
    scroll-behavior: auto;
  }
  .sarro-carousel:active { cursor: grabbing; }
  .sarro-carousel::-webkit-scrollbar { display: none; }
  .sarro-carousel-item { scroll-snap-align: start; scroll-snap-stop: normal; flex-shrink: 0; }
  .sarro-carousel.dragging, .sarro-chips.dragging { scroll-snap-type: none !important; user-select: none; -webkit-user-select: none; }
  .sarro-carousel.dragging * , .sarro-chips.dragging * { pointer-events: none; }
  .sarro-chips {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
    padding-bottom: 2px;
    cursor: grab;
    scroll-padding-left: 12px;
    scroll-padding-right: 12px;
    touch-action: pan-y pinch-zoom;
  }
  .sarro-chips:active { cursor: grabbing; }
  .sarro-chips::-webkit-scrollbar { display: none; }
  .sarro-chip { scroll-snap-align: start; flex-shrink: 0; }
  .sarro-fade { position: relative; }
  .sarro-fade::before, .sarro-fade::after {
    content: '';
    position: absolute;
    top: 0; bottom: 0;
    width: 20px;
    pointer-events: none;
    z-index: 2;
    transition: opacity .2s;
  }
  .sarro-fade::before { left: 0; background: linear-gradient(90deg, #050505 0%, transparent 100%); }
  .sarro-fade::after { right: 0; background: linear-gradient(270deg, #050505 0%, transparent 100%); }
  .sarro-fade.no-left::before { opacity: 0; }
  .sarro-fade.no-right::after { opacity: 0; }
  @media (max-width: 360px) {
    .sarro-carousel { gap: 10px; scroll-padding-left: 12px; }
  }
  @media (min-width: 640px) {
    .sarro-carousel { gap: 14px; }
  }
  .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
  .safe-bottom-plus { padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
`;

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

const elapsed = (from, now) => {
  const s = Math.max(0, Math.floor((now - from) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

function Logo({ size = 44, glow = false, style = {} }) {
  return (
    <img
      src={LOGO_ROUND}
      alt="TÔ NO SARRO! Burgers & Açaí"
      width={size}
      height={size}
      draggable={false}
      className="shrink-0 select-none"
      style={{
        borderRadius: "50%", display: "block",
        boxShadow: glow ? `0 0 0 1px ${C.black}, 0 8px 30px ${C.orange}59` : "none",
        ...style,
      }}
    />
  );
}

// Foto do produto com fallback para o emoji: enquanto a foto real não existir
// (ou estiver carregando em conexão ruim), o card continua apresentável.
// `file` = foto enviada pelo admin (servida em /img-up); sem ela usa a foto
// padrão img/products/<id>.jpg gerada para o catálogo.
function SmartImg({ id, emoji, alt = "", fs = 34, className = "", style = {}, file, v = 0 }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [file, id, v]);
  const src = file
    ? `img-up/${file}?v=${v}`
    : `${IMG_BASE}/${id}.jpg?v=${v}`;

  if (broken) {
    return (
      <span
        className={`flex items-center justify-center w-full h-full ${className}`}
        style={{ background: `linear-gradient(135deg, ${C.orange}2e, ${C.gray800})`, ...style }}
      >
        <span style={{ fontSize: fs, lineHeight: 1 }}>{emoji}</span>
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      draggable={false}
      onError={() => setBroken(true)}
      className={`sarro-img ${className}`}
      style={style}
    />
  );
}

function Badge({ children, color = C.orange, text = C.black }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold"
      style={{ background: color, color: text, fontSize: 10, letterSpacing: "0.02em" }}
    >
      {children}
    </span>
  );
}

function Btn({ children, onClick, variant = "primary", full, disabled, small, style = {} }) {
  const base = {
    primary: { background: `linear-gradient(100deg, ${C.orange}, ${C.yellow})`, color: C.black },
    dark: { background: C.gray800, color: C.white, border: `1px solid ${C.gray700}` },
    ghost: { background: "transparent", color: C.white, border: `1px solid ${C.gray700}` },
    danger: { background: "transparent", color: C.red, border: `1px solid ${C.red}55` },
    green: { background: C.green, color: "#06220f" },
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl font-bold transition active:scale-95 ${full ? "w-full" : ""} ${small ? "px-3 py-1.5" : "px-4 py-3"}`}
      style={{
        ...base, fontSize: small ? 12 : 14, opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer", fontFamily: font.body, ...style,
      }}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "", style = {}, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl ${className}`}
      style={{ background: C.gray850, border: `1px solid ${C.gray800}`, ...style }}
    >
      {children}
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div
      className="fixed left-1/2 z-50 px-4 py-3 rounded-xl font-bold flex items-center gap-2 safe-bottom"
      style={{
        bottom: "calc(96px + env(safe-area-inset-bottom))",
        transform: "translateX(-50%)",
        background: C.white,
        color: C.black,
        fontSize: "clamp(12px, 3.4vw, 13px)",
        boxShadow: "0 12px 40px rgba(0,0,0,.6)",
        maxWidth: "min(88vw, 360px)",
        whiteSpace: "nowrap",
      }}
    >
      🔥 {msg}
    </div>
  );
}

function Confetti({ on }) {
  if (!on) return null;
  const bits = Array.from({ length: 40 });
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {bits.map((_, i) => {
        const left = (i * 37) % 100;
        const delay = (i % 10) * 0.08;
        const col = [C.orange, C.yellow, C.yellowLight, C.white][i % 4];
        return (
          <span
            key={i}
            style={{
              position: "absolute", left: `${left}%`, top: "-5%", width: 8, height: 14,
              background: col, borderRadius: 2,
              animation: `sarrofall 2.4s ${delay}s linear forwards`,
              transform: `rotate(${i * 27}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}

function StatusPill({ status, small }) {
  const s = STATUS[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-bold"
      style={{
        background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}55`,
        fontSize: small ? 10 : 11, padding: small ? "2px 7px" : "3px 10px",
      }}
    >
      {s.icon} {s.label}
    </span>
  );
}

// Logo oficial do WhatsApp (SVG inline — sem dependências)
function WaIcon({ size = 22, color = "#fff", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

// Selo de sincronização dos painéis de pedido: mostra se o tempo real está
// ligado e há quanto tempo os dados foram atualizados. Toque = atualizar agora.
// Relógio de sincronização dos painéis de pedido: mostra há quanto tempo
// os dados foram carregados + botão para forçar a atualização na hora.
function SyncBadge({ store, now }) {
  const age = Math.max(0, Math.floor((now - (store.lastSyncAt || now)) / 1000));
  const label = age < 5 ? "agora mesmo" : age < 60 ? `há ${age}s` : `há ${Math.floor(age / 60)}min`;
  const live = store.wsOnline;
  return (
    <span className="flex items-center gap-1.5">
      <span
        title={live ? "Tempo real ligado (com rede de segurança a cada 60s)" : "Tempo real caído — atualizando a cada 60s"}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-bold"
        style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: "#9a9a9a", fontSize: 10.5, whiteSpace: "nowrap" }}
      >
        <span
          style={{
            width: 7, height: 7, borderRadius: 99,
            background: live ? C.green : C.yellow,
            animation: "sarropulse 2s ease-in-out infinite",
          }}
        />
        🔄 {label}
      </span>
      <button
        onClick={() => store.refreshAll(true)}
        title="Atualizar os pedidos agora"
        className="rounded-lg px-2.5 py-1.5 font-bold"
        style={{ background: C.gray800, border: `1px solid ${C.gray700}`, color: C.white, fontSize: 10.5, whiteSpace: "nowrap" }}
      >
        Atualizar agora
      </button>
    </span>
  );
}

function ChannelPill({ channel }) {
  const c = CHANNELS[channel];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md font-bold"
      style={{ background: `${c.color}1f`, color: c.color, fontSize: 10, padding: "2px 6px", border: `1px solid ${c.color}44` }}
    >
      {channel === "WHATSAPP" ? <WaIcon size={11} color={c.color} /> : c.icon} {c.short}
    </span>
  );
}

// IMPRESSÃO — comandas 80mm via iframe (cozinha, expedição,
// cupom do cliente e etiqueta de sacola)
// ============================================================

function printHTML(body) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Tô no Sarro</title><style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body { font-family: "Courier New", ui-monospace, monospace; color: #000; font-size: 12.5px; margin: 0; }
    h1 { font-size: 17px; margin: 0 0 2px; text-align: center; letter-spacing: 1px; }
    .sub { text-align: center; font-size: 10.5px; margin-bottom: 6px; }
    hr { border: 0; border-top: 1px dashed #000; margin: 7px 0; }
    .big { font-size: 16px; font-weight: 700; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .item { font-size: 14.5px; font-weight: 700; margin-top: 7px; }
    .opt { font-size: 11.5px; padding-left: 12px; }
    .note { background: #000; color: #fff; padding: 3px 6px; font-weight: 700; margin: 3px 0 3px 12px; font-size: 12px; }
    .kv { margin: 2px 0; }
    .total { font-size: 15px; font-weight: 700; }
    .c { text-align: center; }
  </style></head><body>${body}</body></html>`;

  const f = document.createElement("iframe");
  f.setAttribute("aria-hidden", "true");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(f);
  const doc = f.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  f.contentWindow.focus();
  setTimeout(() => {
    f.contentWindow.print();
    setTimeout(() => f.remove(), 4000);
  }, 150);
}

const fmtDT = (ts) =>
  new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const channelName = (ch) => CHANNELS[ch]?.label || ch;

// Escape para HTML — dados do pedido (nome/obs do cliente) nunca entram
// crus no document.write da impressão
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function printKitchen(o) {
  const items = o.items.map((i) => `
    <div class="item">${i.qty}x ${esc(i.name)}</div>
    ${i.opts.map((op) => `<div class="opt">+ ${esc(op.name)}</div>`).join("")}
    ${i.note ? `<div class="note">OBS: ${esc(i.note)}</div>` : ""}
  `).join("");
  printHTML(`
    <h1>COMANDA — COZINHA</h1>
    <div class="sub">${esc(channelName(o.channel))} · ${fmtDT(o.createdAt)}</div>
    <div class="big">#${o.code} · ${o.type === "pickup" ? "RETIRADA" : "DELIVERY"}</div>
    <hr />
    ${items}
    ${o.note ? `<hr /><div class="note">OBS GERAL: ${esc(o.note)}</div>` : ""}
  `);
}

function printExpedition(o) {
  const items = o.items.map((i) => `<div class="kv">${i.qty}x ${esc(i.name)}</div>`).join("");
  printHTML(`
    <h1>EXPEDIÇÃO</h1>
    <div class="sub">${channelName(o.channel)} · ${fmtDT(o.createdAt)}</div>
    <div class="big">#${o.code}</div>
    <hr />
    <div class="kv"><strong>Cliente:</strong> ${esc(o.customer.name)}</div>
    <div class="kv"><strong>Telefone:</strong> ${esc(o.customer.phone)}</div>
    <div class="kv"><strong>${o.type === "pickup" ? "Retirada na loja" : "Endereço"}:</strong> ${esc(o.customer.addr)}</div>
    <div class="kv"><strong>Pagamento:</strong> ${esc(o.payment)}</div>
    <hr />
    ${items}
  `);
}

function printReceipt(o, settings = {}) {
  const items = o.items.map((i) => `
    <div class="row"><span>${i.qty}x ${esc(i.name)}</span><span>${brl(i.unit * i.qty)}</span></div>
    ${i.opts.filter((op) => op.price > 0).map((op) => `<div class="opt">+ ${esc(op.name)} (${brl(op.price)})</div>`).join("")}
  `).join("");
  printHTML(`
    <h1>TÔ NO SARRO!</h1>
    <div class="sub">Burgers & Açaí · Janga, Paulista/PE<br />${settings.address || ""}</div>
    <hr />
    <div class="kv">Pedido <strong>#${o.code}</strong> · ${fmtDT(o.createdAt)}</div>
    <div class="kv">Cliente: ${esc(o.customer.name)}</div>
    <div class="kv">${o.type === "pickup" ? "Retirada na loja" : "Delivery"} · ${esc(o.customer.addr)}</div>
    <hr />
    ${items}
    <hr />
    <div class="row"><span>Subtotal</span><span>${brl(o.subtotal)}</span></div>
    <div class="row"><span>Taxa de entrega</span><span>${o.fee ? brl(o.fee) : "grátis"}</span></div>
    ${o.discount ? `<div class="row"><span>Desconto</span><span>-${brl(o.discount)}</span></div>` : ""}
    <div class="row total"><span>TOTAL</span><span>${brl(o.total)}</span></div>
    <div class="kv" style="margin-top:4px">Pagamento: ${esc(o.payment)}</div>
    <hr />
    <div class="c">Obrigado! Volta sempre 🔥<br />tonosarro · cardápio digital</div>
  `);
}

function printLabel(o) {
  printHTML(`
    <h1>SARRO #${o.code}</h1>
    <hr />
    <div class="big">${esc(o.customer.name)}</div>
    <div class="kv">${esc(o.customer.phone)}</div>
    <div class="kv">${o.type === "pickup" ? "RETIRADA NA LOJA" : esc(o.customer.addr)}</div>
    <hr />
    ${o.items.map((i) => `<div class="kv">${i.qty}x ${esc(i.name)}</div>`).join("")}
  `);
}

function printCashSummaryReceipt(reg, settings = {}) {
  if (!reg || !reg.summary) return;
  const s = reg.summary;
  const txs = reg.transactions || [];
  const txRows = txs.map((t) => `
    <div class="row">
      <span>${fmtDT(t.createdAt)} [${esc(t.type)}]</span>
      <span style="font-weight: bold; color: ${t.type === "SANGRIA" ? "red" : "black"};">
        ${t.type === "SANGRIA" ? "-" : "+"}${brl(t.amount)}
      </span>
    </div>
    <div style="font-size: 10px; color: #555; margin-bottom: 5px;">${esc(t.reason)} (${esc(t.createdBy)})</div>
  `).join("");

  printHTML(`
    <h1>TÔ NO SARRO!</h1>
    <div class="sub">RESUMO DE CAIXA / PDV · ${esc(settings.storeName || "Burgers & Açaí")}</div>
    <hr />
    <div class="kv">Turno: <strong>#${reg.id.slice(0, 8)}</strong> (${reg.status === "OPEN" ? "EM ABERTO" : "FECHADO"})</div>
    <div class="kv">Aberto por: <strong>${esc(reg.openedBy)}</strong> em ${fmtDT(reg.openedAt)}</div>
    ${reg.closedAt ? `<div class="kv">Fechado por: <strong>${esc(reg.closedBy || "")}</strong> em ${fmtDT(reg.closedAt)}</div>` : ""}
    <hr />
    <div class="row"><span>Fundo de Troco Inicial:</span><strong>${brl(s.initialCash)}</strong></div>
    <div class="row"><span>Vendas em Dinheiro:</span><strong>${brl(s.cashSales)}</strong></div>
    <div class="row"><span>Suprimentos de Caixa (+):</span><strong>+${brl(s.suprimentos)}</strong></div>
    <div class="row"><span>Sangrias de Caixa (-):</span><strong>-${brl(s.sangrias)}</strong></div>
    <hr />
    <div class="row" style="font-size: 13px;"><span>TOTAL ESPERADO GAVETA:</span><strong>${brl(s.expectedCash)}</strong></div>
    ${s.closedCash !== null ? `
      <div class="row"><span>Valor Contado Gaveta:</span><strong>${brl(s.closedCash)}</strong></div>
      <div class="row" style="color: ${s.diffCash === 0 ? "black" : s.diffCash > 0 ? "green" : "red"};">
        <span>Diferença / Quebra:</span>
        <strong>${s.diffCash === 0 ? "R$ 0,00 (Exato)" : (s.diffCash > 0 ? "+" : "") + brl(s.diffCash)}</strong>
      </div>
    ` : ""}
    <hr />
    <div class="kv"><strong>VENDAS POR FORMA DE PAGAMENTO:</strong></div>
    <div class="row"><span>💵 Dinheiro:</span><span>${brl(s.cashSales)}</span></div>
    <div class="row"><span>💠 Pix:</span><span>${brl(s.pixSales)}</span></div>
    <div class="row"><span>💳 Cartão:</span><span>${brl(s.cardSales)}</span></div>
    ${s.otherSales > 0 ? `<div class="row"><span>Outros:</span><span>${brl(s.otherSales)}</span></div>` : ""}
    <div class="row total" style="font-size: 13px; font-weight: bold; margin-top: 4px;">
      <span>FATURAMENTO TOTAL:</span><span>${brl(s.totalSales)}</span>
    </div>
    <div class="kv" style="font-size: 10.5px; color: #555; margin-top: 3px;">Total de pedidos no turno: ${s.orderCount}</div>
    ${txs.length > 0 ? `
      <hr />
      <div class="kv"><strong>MOVIMENTAÇÕES DE CAIXA (${txs.length}):</strong></div>
      ${txRows}
    ` : ""}
    ${reg.notes ? `<hr /><div class="note">OBS: ${esc(reg.notes)}</div>` : ""}
    <hr />
    <div class="c">Tô no Sarro · Frente de Caixa PDV</div>
  `);
}

function printDriverSettlementReceipt(settlement, settings = {}) {
  if (!settlement) return;
  const s = settlement.summary || {
    deliveriesCount: settlement.deliveries_count ?? settlement.deliveriesCount ?? settlement.orders?.length ?? 0,
    totalFees: settlement.total_fees ?? settlement.totalFees ?? 0,
    basePay: settlement.base_pay ?? settlement.basePay ?? 0,
    totalDueToDriver: (settlement.total_fees ?? settlement.totalFees ?? 0) + (settlement.base_pay ?? settlement.basePay ?? 0),
    totalCashCollected: settlement.total_cash_collected ?? settlement.totalCashCollected ?? 0,
    netBalance: settlement.net_balance ?? settlement.netBalance ?? 0,
  };
  const d = settlement.driver || { name: settlement.driver_name, vehicle: settlement.driver_vehicle };
  const orders = settlement.orders || [];

  const orderRows = orders.map((o) => `
    <div class="row">
      <span>#${o.code} - ${esc(o.customer?.name?.slice(0, 16) || "Cliente")}</span>
      <span>Taxa: ${brl(o.fee || 0)} | ${esc(o.payment || "")}: ${brl(o.total || 0)}</span>
    </div>
  `).join("");

  printHTML(`
    <h1>TÔ NO SARRO!</h1>
    <div class="sub">ACERTO DE CONTAS · ENTREGADOR</div>
    <hr />
    <div class="kv">Entregador: <strong>${esc(d.name || "Entregador")}</strong> (${esc(d.vehicle || "Moto")})</div>
    <div class="kv">Data/Hora: ${fmtDT(settlement.createdAt || settlement.created_at || Date.now())}</div>
    <div class="kv">Operador: ${esc(settlement.settledBy || settlement.settled_by || "Operador")}</div>
    <hr />
    <div class="row"><span>Entregas Realizadas:</span><strong>${s.deliveriesCount}</strong></div>
    <div class="row"><span>Total de Taxas Devidas:</span><strong>+${brl(s.totalFees)}</strong></div>
    ${s.basePay > 0 ? `<div class="row"><span>Diária Fixa:</span><strong>+${brl(s.basePay)}</strong></div>` : ""}
    <div class="row"><span>TOTAL A RECEBER (MOTOBOY):</span><strong>${brl(s.totalDueToDriver)}</strong></div>
    <hr />
    <div class="row"><span>Dinheiro Recolhido de Clientes:</span><strong style="color:red;">-${brl(s.totalCashCollected)}</strong></div>
    <hr />
    <div class="row total" style="font-size: 13px;">
      <span>SALDO FINAL DO ACERTO:</span>
      <strong>${s.netBalance > 0 ? `MOTOBOY PAGA À LOJA: ${brl(s.netBalance)}` : s.netBalance < 0 ? `LOJA PAGA AO MOTOBOY: ${brl(Math.abs(s.netBalance))}` : "R$ 0,00 (QUITADO)"}</strong>
    </div>
    ${orders.length > 0 ? `
      <hr />
      <div class="kv"><strong>PEDIDOS ENTREGUES (${orders.length}):</strong></div>
      ${orderRows}
    ` : ""}
    <hr />
    <div style="margin-top: 25px; text-align: center; font-size: 11px;">
      ____________________________________<br />
      Assinatura do Entregador
    </div>
    <div style="margin-top: 25px; text-align: center; font-size: 11px;">
      ____________________________________<br />
      Assinatura da Hamburgueria
    </div>
    <hr />
    <div class="c">Tô no Sarro · Controle de Entregas</div>
  `);
}

function buildGoogleMapsMultiStopUrl(orders, storeAddress = "Rua do Sol, Janga, Paulista - PE") {
  if (!orders || orders.length === 0) return "";
  const origin = encodeURIComponent(storeAddress);
  const destOrder = orders[orders.length - 1];
  const destination = encodeURIComponent(destOrder.customer.addr);
  const waypointOrders = orders.slice(0, -1);
  const waypoints = waypointOrders.map((o) => encodeURIComponent(o.customer.addr)).join("|");

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  if (waypoints) {
    url += `&waypoints=${waypoints}`;
  }
  url += "&travelmode=driving";
  return url;
}

// ============================================================
// EXPORTAÇÃO CSV (abre no Excel — BOM + separador ;)
// ============================================================

function downloadCSV(name, rows) {
  const esc = (c) => `"${String(c ?? "").replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ============================================================
// PEDIDOS — SEED + CRIAÇÃO
// ============================================================

// ============================================================
// CLIENTE — CARDÁPIO
// ============================================================

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
            style={{ background: C.gray850, border: `1px solid ${store.open ? C.green : C.red}55` }}
          >
            <span
              style={{ width: 8, height: 8, borderRadius: 99, background: store.open ? C.green : C.red, display: "inline-block", animation: "sarropulse 1.8s infinite" }}
            />
            <span style={{ fontSize: "clamp(10px, 2.8vw, 11px)", fontWeight: 800, color: store.open ? C.green : C.red, whiteSpace: "nowrap" }}>
              {store.open ? "Aberto agora" : "Fechado · 18h"}
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
          pra sua casa. {store.open ? "Entrega em 35–45 min." : "Voltamos às 18h."}
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
// ============================================================
// BUSCA INTELIGENTE
// ============================================================

const SYNONYMS = {
  bacon: ["bacon"], apimentado: ["picante"], picante: ["picante"],
  barato: [], vegetariano: ["grão-de-bico", "veg"], doce: ["açaí", "brownie", "milkshake"],
};

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

// ============================================================
// CARDÁPIO
// ============================================================

function MenuScreen({ store, onOpen }) {
  return (
    <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Carregando MenuScreen...</div>}>
      <MenuScreenModular store={store} onOpen={onOpen}  />
    </React.Suspense>
  );
}

function Field({ label, value, onChange, ph, type = "text" }) {
  return (
    <label className="block">
      <span style={{ color: "#9a9a9a", fontSize: 11.5, fontWeight: 700 }}>{label}</span>
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} type={type}
        className="w-full rounded-xl px-3 py-3 mt-1.5 outline-none"
        style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 13.5 }}
      />
    </label>
  );
}

function Choice({ on, onClick, icon, title, sub }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-left"
      style={{ background: on ? `${C.orange}1c` : C.gray850, border: `1px solid ${on ? C.orange : C.gray800}` }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span className="flex-1">
        <span className="block" style={{ color: C.white, fontWeight: 800, fontSize: 14 }}>{title}</span>
        {sub && <span className="block" style={{ color: "#8a8a8a", fontSize: 11.5 }}>{sub}</span>}
      </span>
      {on && <span style={{ color: C.orange, fontWeight: 900 }}>✓</span>}
    </button>
  );
}

function Checkout({ store, totals, onBack, onDone }) {
  return (
    <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Carregando Checkout...</div>}>
      <CheckoutModular store={store} totals={totals} onBack={onBack} onDone={onDone}  />
    </React.Suspense>
  );
}

function QRCodeImage({ value, size = 160, className = "" }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    if (!value) { setSrc(""); return; }
    QRCode.toDataURL(value, { width: size * 2, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then((url) => { if (alive) setSrc(url); })
      .catch(() => {});
    return () => { alive = false; };
  }, [value, size]);

  if (!src) {
    return (
      <div style={{ width: size, height: size, background: "#fff" }} className={`flex items-center justify-center rounded-lg ${className}`}>
        <span style={{ color: "#888", fontSize: 11 }}>Carregando QR...</span>
      </div>
    );
  }
  return <img src={src} alt={value} style={{ width: size, height: size }} className={`rounded-lg ${className}`} />;
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

const TRACK_STEPS = [
  { key: "NOVO", label: "Pedido recebido", icon: "✓" },
  { key: "CONFIRMADO", label: "Pagamento confirmado", icon: "✓" },
  { key: "PREPARO", label: "Na chapa agora", icon: "🔥" },
  { key: "PRONTO", label: "Pedido pronto", icon: "🍔" },
  { key: "EMBALADO", label: "Embalado", icon: "📦" },
  { key: "ROTA", label: "Saiu para entrega", icon: "🛵" },
  { key: "ENTREGUE", label: "Entregue", icon: "✓" },
];

const TRACK_STEPS_MESA = [
  { key: "NOVO", label: "Comanda aberta", icon: "📝" },
  { key: "CONFIRMADO", label: "Enviado à cozinha", icon: "✓" },
  { key: "PREPARO", label: "Na chapa agora", icon: "🔥" },
  { key: "PRONTO", label: "Pronto no salão", icon: "🍽️" },
  { key: "ENTREGUE", label: "Entregue na mesa", icon: "✓" },
];

const TRACK_STEPS_PICKUP = [
  { key: "NOVO", label: "Pedido recebido", icon: "✓" },
  { key: "CONFIRMADO", label: "Confirmado", icon: "✓" },
  { key: "PREPARO", label: "Na chapa agora", icon: "🔥" },
  { key: "PRONTO", label: "Pronto para retirada", icon: "🏪" },
  { key: "ENTREGUE", label: "Retirado", icon: "✓" },
];

function TrackScreen({ order, store, now }) {
  return (
    <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Carregando TrackScreen...</div>}>
      <TrackScreenModular order={order} store={store} now={now}  />
    </React.Suspense>
  );
}

// ============================================================
// CLIENTE — SHELL (bottom nav, conta, fidelidade)
// ============================================================

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

function ClientApp({ store, now, goRole }) {
  return (
    <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Carregando ClientApp...</div>}>
      <ClientAppModular store={store} now={now} goRole={goRole}  />
    </React.Suspense>
  );
}

function BarChart({ data, xKey, vKey, height = 130 }) {
  const max = Math.max(...data.map((d) => d[vKey]));
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d) => (
        <div key={d[xKey]} className="flex-1 flex flex-col items-center gap-1.5">
          <div style={{ color: "#7a7a7a", fontSize: 9 }}>{Math.round(d[vKey] / 100) / 10}k</div>
          <div
            style={{
              width: "100%", height: `${(d[vKey] / max) * (height - 34)}px`,
              background: `linear-gradient(180deg, ${C.yellow}, ${C.orange})`, borderRadius: "5px 5px 2px 2px",
            }}
          />
          <div style={{ color: "#8a8a8a", fontSize: 10, fontWeight: 700 }}>{d[xKey]}</div>
        </div>
      ))}
    </div>
  );
}

function Donut({ slices, size = 118 }) {
  const total = slices.reduce((s, x) => s + x.v, 0);
  let acc = 0;
  const r = size / 2 - 11;
  const cx = size / 2;
  const arcs = slices.map((s) => {
    const frac = s.v / total;
    const a0 = acc * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    const a1 = acc * 2 * Math.PI - Math.PI / 2;
    const large = frac > 0.5 ? 1 : 0;
    const d = `M ${cx + r * Math.cos(a0)} ${cx + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cx + r * Math.sin(a1)}`;
    return { d, color: s.color, label: s.label, pct: Math.round(frac * 100) };
  });
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size}>
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth="14" strokeLinecap="butt" />
        ))}
      </svg>
      <div className="space-y-1.5">
        {arcs.map((a) => (
          <div key={a.label} className="flex items-center gap-2" style={{ fontSize: 11.5, color: "#c0c0c0" }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: a.color, display: "inline-block" }} />
            {a.label} <strong style={{ color: C.white }}>{a.pct}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function KPI({ icon, label, value, sub, accent }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 19 }}>{icon}</span>
        {sub && <span style={{ color: C.green, fontSize: 10.5, fontWeight: 800 }}>{sub}</span>}
      </div>
      <div style={{ color: accent || C.white, fontWeight: 900, fontSize: 22, marginTop: 8, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ color: "#8a8a8a", fontSize: 11, marginTop: 2 }}>{label}</div>
    </Card>
  );
}

function AdminDashboard({ store, now, setSec }) {
  return (
    <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Carregando AdminDashboard...</div>}>
      <AdminDashboardModular store={store} now={now} setSec={setSec}  />
    </React.Suspense>
  );
}

function AdminOrders({ store, now }) {
  const [view, setView] = useState("kanban");
  const [filter, setFilter] = useState("TODOS");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  const list = useMemo(() => store.orders.filter((o) => filter === "TODOS" || o.channel === filter), [store.orders, filter]);
  const paginated = useMemo(() => view === "kanban" ? list : list.slice(0, (page+1)*PAGE_SIZE), [list, page, view]);
  const hasMore = paginated.length < list.length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Btn small variant={view === "kanban" ? "primary" : "dark"} onClick={() => setView("kanban")}>Kanban</Btn>
        <Btn small variant={view === "lista" ? "primary" : "dark"} onClick={() => setView("lista")}>Lista</Btn>
        <SyncBadge store={store} now={now} />
        <div className="flex-1" />
        {["TODOS", ...Object.keys(CHANNELS)].map((k) => (
          <button
            key={k}
            onClick={() => { setFilter(k); setPage(0); }}
            className="rounded-lg px-2.5 py-1.5 font-bold"
            style={{
              background: filter === k ? C.gray700 : C.gray850, color: filter === k ? C.white : "#8a8a8a",
              border: `1px solid ${C.gray800}`, fontSize: 10.5,
            }}
          >
            {k === "TODOS" ? "Todos" : CHANNELS[k].short}
          </button>
        ))}
      </div>

      {view === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollbarWidth: "thin" }}>
          {FLOW.concat("CANCELADO").map((st) => {
            const items = list.filter((o) => o.status === st);
            return (
              <div key={st} className="shrink-0" style={{ width: 252 }}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <StatusPill status={st} small />
                  <span style={{ color: "#6a6a6a", fontSize: 11, fontWeight: 800 }}>{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((o) => <OrderCard key={o.id} o={o} store={store} now={now} compact />)}
                  {items.length === 0 && (
                    <div className="rounded-xl p-4 text-center" style={{ border: `1px dashed ${C.gray800}`, color: "#4a4a4a", fontSize: 11 }}>
                      vazio
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {paginated.map((o) => <OrderCard key={o.id} o={o} store={store} now={now} />)}
          </div>
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Btn small variant="ghost" onClick={() => setPage((p) => p+1)}>Carregar mais ({list.length - paginated.length} restantes)</Btn>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const BADGE_OPTS = [
  ["maisvendido", "Mais vendido", C.yellow],
  ["novidade", "Novidade", C.white],
  ["promocao", "Promoção", C.red],
];

function ProductForm({ initial, store, onClose }) {
  const [f, setF] = useState(() => (initial ? {
    name: initial.name, cat: initial.cat, emoji: initial.emoji || "🍔",
    description: initial.desc || "",
    ingredients: (initial.ingredients || []).join("\n"),
    price: String(initial.price).replace(".", ","),
    promoOn: initial.promo != null,
    promo: initial.promo != null ? String(initial.promo).replace(".", ",") : "",
    time: String(initial.time ?? 15), stock: String(initial.stock ?? 0),
    badges: initial.badges || [], groups: initial.groups || [],
    available: initial.available, builder: initial.builder,
  } : {
    name: "", cat: "burgers", emoji: "🍔", description: "", ingredients: "",
    price: "", promoOn: false, promo: "", time: "15", stock: "0",
    badges: [], groups: [], available: true, builder: false,
  }));
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleIn = (k, id) =>
    setF((p) => ({ ...p, [k]: p[k].includes(id) ? p[k].filter((x) => x !== id) : [...p[k], id] }));

  const pickFile = (fl) => {
    if (!fl) return;
    setFile(fl);
    setPreview(URL.createObjectURL(fl));
  };

  const num = (s) => parseFloat(String(s).replace(",", "."));
  const save = async () => {
    if (busy) return;
    setErr("");
    const price = num(f.price);
    const promo = f.promoOn ? num(f.promo) : null;
    if (f.name.trim().length < 3) return setErr("Dê um nome com pelo menos 3 letras.");
    if (!Number.isFinite(price) || price <= 0) return setErr("Informe um preço válido.");
    if (f.promoOn && (!Number.isFinite(promo) || promo <= 0)) return setErr("Informe o preço promocional.");
    if (f.promoOn && promo >= price) return setErr("A promoção precisa ser menor que o preço normal.");

    setBusy(true);
    try {
      await store.saveProduct(initial?.id, {
        name: f.name.trim(), cat: f.cat, emoji: f.emoji || "🍔",
        description: f.description.trim(),
        ingredients: f.ingredients.split("\n").map((s) => s.trim()).filter(Boolean),
        price, promo: f.promoOn ? promo : null,
        time: Math.max(1, parseInt(f.time) || 15),
        stock: Math.max(0, parseInt(f.stock) || 0),
        badges: f.badges, groups: f.groups,
        available: f.available, builder: f.builder,
      }, file);
      store.toast(initial ? "Produto atualizado ✓" : "Produto criado ✓");
      onClose();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const inField = { background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 13 };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,.8)" }}>
      <div
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto"
        style={{ background: C.gray900, borderTop: `3px solid ${C.orange}`, borderRadius: "20px 20px 0 0" }}
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: `1px solid ${C.gray800}` }}>
          <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: C.white }}>
            {initial ? "EDITAR PRODUTO" : "NOVO PRODUTO"}
          </h3>
          <button onClick={onClose} className="rounded-full flex items-center justify-center"
            style={{ width: 32, height: 32, background: C.gray850, color: C.white }}>✕</button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex gap-4">
            <div>
              <div className="rounded-xl overflow-hidden" style={{ width: 96, height: 96, border: `1px solid ${C.gray800}`, background: C.gray850 }}>
                {preview ? (
                  <img src={preview} alt="Prévia" className="sarro-img" />
                ) : (
                  <SmartImg id={initial?.id} emoji={f.emoji} file={initial?.img} v={initial?.updatedAt} fs={40} />
                )}
              </div>
              <label className="block text-center mt-2 cursor-pointer rounded-lg px-2 py-1.5"
                style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.yellowLight, fontSize: 11, fontWeight: 800 }}>
                📷 {initial?.img || preview ? "Trocar foto" : "Enviar foto"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
              <div style={{ color: "#6a6a6a", fontSize: 9.5, marginTop: 4, width: 96, textAlign: "center" }}>
                JPG/PNG/WebP · até 3MB
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <label className="block">
                <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Nome *</span>
                <input value={f.name} onChange={(e) => set("name", e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={inField}
                  placeholder="Ex.: Sarro Burger Vegano" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Categoria</span>
                  <select value={f.cat} onChange={(e) => set("cat", e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={inField}>
                    {store.categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Emoji (fallback)</span>
                  <input value={f.emoji} onChange={(e) => set("emoji", e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={inField} />
                </label>
              </div>
            </div>
          </div>

          <label className="block">
            <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Descrição</span>
            <input value={f.description} onChange={(e) => set("description", e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={inField}
              placeholder="Uma frase que dá água na boca" />
          </label>

          <label className="block">
            <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Ingredientes (um por linha)</span>
            <textarea value={f.ingredients} onChange={(e) => set("ingredients", e.target.value)} rows={4}
              className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none resize-y" style={inField}
              placeholder={"Pão brioche\nBlend 180g\nCheddar"} />
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="block">
              <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Preço R$ *</span>
              <input value={f.price} onChange={(e) => set("price", e.target.value)} inputMode="decimal"
                className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={inField} placeholder="29,90" />
            </label>
            <label className="block">
              <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Promoção?</span>
              <button type="button" onClick={() => set("promoOn", !f.promoOn)}
                className="w-full rounded-xl px-3 py-2.5 mt-1 font-bold"
                style={{ background: f.promoOn ? `${C.orange}26` : C.gray850, border: `1px solid ${f.promoOn ? C.orange : C.gray800}`, color: f.promoOn ? C.orange : "#9a9a9a", fontSize: 12.5 }}>
                {f.promoOn ? "✓ Com promo" : "Sem promo"}
              </button>
            </label>
            {f.promoOn && (
              <label className="block">
                <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Preço promo R$</span>
                <input value={f.promo} onChange={(e) => set("promo", e.target.value)} inputMode="decimal"
                  className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={inField} placeholder="24,90" />
              </label>
            )}
            <label className="block">
              <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Preparo (min)</span>
              <input value={f.time} onChange={(e) => set("time", e.target.value)} inputMode="numeric"
                className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={inField} />
            </label>
            <label className="block">
              <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Estoque</span>
              <input value={f.stock} onChange={(e) => set("stock", e.target.value)} inputMode="numeric"
                className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={inField} />
            </label>
          </div>

          <div>
            <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Selos</span>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {BADGE_OPTS.map(([id, lbl, color]) => {
                const on = f.badges.includes(id);
                return (
                  <button key={id} type="button" onClick={() => toggleIn("badges", id)} className="rounded-full px-3 py-1.5 font-bold"
                    style={{ background: on ? `${color}26` : C.gray850, border: `1px solid ${on ? color : C.gray800}`, color: on ? color : "#9a9a9a", fontSize: 11.5 }}>
                    {on ? "✓" : "+"} {lbl}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Grupos de opcionais</span>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {store.optionGroups.map((g) => {
                const on = f.groups.includes(g.id);
                return (
                  <button key={g.id} type="button" onClick={() => toggleIn("groups", g.id)} className="rounded-full px-3 py-1.5 font-bold"
                    style={{ background: on ? `${C.orange}22` : C.gray850, border: `1px solid ${on ? C.orange : C.gray800}`, color: on ? C.orange : "#9a9a9a", fontSize: 11.5 }}>
                    {on ? "✓" : "+"} {g.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => set("available", !f.available)} className="rounded-xl px-3 py-2 font-bold"
              style={{ background: f.available ? `${C.green}1e` : C.gray850, border: `1px solid ${f.available ? C.green : C.gray800}`, color: f.available ? C.green : "#9a9a9a", fontSize: 12 }}>
              {f.available ? "🟢 Disponível" : "🔴 Indisponível"}
            </button>
            <button type="button" onClick={() => set("builder", !f.builder)} className="rounded-xl px-3 py-2 font-bold"
              style={{ background: f.builder ? `${C.orange}1e` : C.gray850, border: `1px solid ${f.builder ? C.orange : C.gray800}`, color: f.builder ? C.orange : "#9a9a9a", fontSize: 12 }}>
              🛠️ Monte seu Sarro {f.builder ? "✓" : ""}
            </button>
          </div>

          {err && (
            <div className="rounded-lg px-3 py-2" style={{ background: `${C.red}18`, color: C.red, fontSize: 12, fontWeight: 700 }}>
              {err}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 p-4 flex gap-3" style={{ background: C.black, borderTop: `1px solid ${C.gray800}` }}>
          <Btn variant="dark" onClick={onClose}>Cancelar</Btn>
          <Btn full disabled={busy} onClick={save}>
            {busy ? "SALVANDO…" : initial ? "SALVAR ALTERAÇÕES" : "CRIAR PRODUTO"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function AdminProducts({ store }) {
  return (
    <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Carregando AdminProducts...</div>}>
      <AdminProductsModular store={store}  />
    </React.Suspense>
  );
}

function Table({ cols, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 560 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} className="text-left px-3 py-2.5" style={{ color: "#7a7a7a", fontSize: 10.5, fontWeight: 800, borderBottom: `1px solid ${C.gray800}` }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className="px-3 py-3" style={{ color: j === 0 ? C.white : "#a5a5a5", fontSize: 12.5, borderBottom: `1px solid ${C.gray850}`, fontWeight: j === 0 ? 700 : 400 }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminCustomers({ store }) {
  return (
    <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Carregando AdminCustomers...</div>}>
      <AdminCustomersModular store={store}  />
    </React.Suspense>
  );
}

function rangeStart(range, now) {
  const DAY = 86400000;
  if (range === "hoje") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (range === "7") return now - 7 * DAY;
  if (range === "30") return now - 30 * DAY;
  return 0;
}

function AdminFinance({ store, now }) {
  return (
    <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Carregando AdminFinance...</div>}>
      <AdminFinanceModular store={store} now={now}  />
    </React.Suspense>
  );
}

function printReport(title, cols, rows) {
  const thead = cols.map((c) => `<th style="text-align:left;padding:6px 10px;border-bottom:2px solid #000">${c}</th>`).join("");
  const tbody = rows.map((r) => `<tr>${r.map((c) => `<td style="padding:5px 10px;border-bottom:1px solid #ddd">${c ?? ""}</td>`).join("")}</tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
    @page { size: A4 landscape; margin: 14mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 2px; }
    .sub { color: #444; font-size: 11px; margin-bottom: 12px; }
    table { border-collapse: collapse; width: 100%; }
  </style></head><body>
    <h1>TÔ NO SARRO! — ${title}</h1>
    <div class="sub">Gerado em ${new Date().toLocaleString("pt-BR")}</div>
    <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
  </body></html>`;
  const w = window.open("", "_blank", "width=980,height=720");
  if (!w) return;
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 250);
}

function ReportCard({ title, cols, rows, csvName }) {
  const hasData = rows.length > 0;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>{title}</div>
        <div className="flex gap-1.5 shrink-0">
          <Btn small variant="dark" onClick={() => printReport(title, cols, rows)}>🖨 PDF</Btn>
          <Btn small variant="dark" onClick={() => downloadCSV(csvName, [cols, ...rows])}>⬇ CSV</Btn>
        </div>
      </div>
      {hasData ? <Table cols={cols} rows={rows} /> : <div style={{ color: "#6a6a6a", fontSize: 12 }}>Sem dados no período.</div>}
    </Card>
  );
}

function AdminReports({ store, now }) {
  return (
    <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Carregando AdminReports...</div>}>
      <AdminReportsModular store={store} now={now}  />
    </React.Suspense>
  );
}

function MiniToggle({ on, onClick, title }) {
  return (
    <button
      onClick={onClick} title={title || (on ? "Pausar" : "Ativar")}
      className="rounded-full shrink-0"
      style={{ width: 38, height: 21, background: on ? C.green : C.gray700, position: "relative", transition: "background .2s" }}
    >
      <span
        style={{
          position: "absolute", top: 2.5, left: on ? 20 : 2.5, width: 16, height: 16,
          borderRadius: 99, background: C.white, transition: "left .2s",
        }}
      />
    </button>
  );
}

// Molde dos modais de gestão (cupom, promoção, usuário)
function FormShell({ title, sub, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,.78)" }}>
      <div
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto p-5"
        style={{ background: C.gray900, borderTop: `3px solid ${C.orange}`, borderRadius: "22px 22px 0 0" }}
      >
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: C.white }}>{title}</h3>
            {sub && <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>{sub}</div>}
          </div>
          <button
            onClick={onClose}
            className="rounded-full flex items-center justify-center shrink-0"
            style={{ width: 32, height: 32, background: C.gray800, color: C.white, fontSize: 15 }}
          >
            ✕
          </button>
        </div>
        <div className="space-y-3 mt-4">{children}</div>
      </div>
    </div>
  );
}

function FSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span style={{ color: "#9a9a9a", fontSize: 11.5, fontWeight: 700 }}>{label}</span>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-3 mt-1.5 outline-none"
        style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 13.5 }}
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

const couponLabel = (c) =>
  c.type === "percent" ? `${c.value}% off` : c.type === "fixed" ? `${brl(c.value)} off` : "Entrega grátis";

// Selo automático da promoção: deriva do relógio — entra e sai do ar
// sozinha, sem ninguém precisar lembrar de ligar/desligar.
function promoStatus(p, now) {
  if (!p.active) return { label: "PAUSADA", color: "#7a7a7a" };
  if (p.startsAt && now < p.startsAt) return { label: "PROGRAMADA", color: C.blue };
  if (p.endsAt && now > p.endsAt) return { label: "EXPIRADA", color: C.red };
  return { label: "ATIVA AGORA", color: C.green };
}

const fmtShort = (ts) =>
  new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// datetime-local ⟷ timestamp (hora local)
const toLocalInput = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  const p2 = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
const fromLocalInput = (v) => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};

// "Último acesso" da equipe
function lastSeen(ts, now) {
  if (!ts) return "nunca";
  const m = Math.floor((now - ts) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return fmtShort(ts);
}

function CouponForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState({
    code: initial?.code || "",
    type: initial?.type || "percent",
    value: initial ? String(initial.value) : "10",
    min: initial ? String(initial.min) : "0",
    max_uses: initial?.limit ? String(initial.limit) : "",
    note: initial?.note || "",
    active: initial ? !!initial.active : true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const num = (s) => parseFloat(String(s).replace(",", "."));

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const body = {
        type: f.type,
        value: f.type === "freeship" ? 0 : num(f.value),
        min: num(f.min) || 0,
        max_uses: f.max_uses.trim() === "" ? null : Math.floor(num(f.max_uses)),
        note: f.note.trim(),
        active: f.active,
      };
      if (initial) {
        await api(`/api/coupons/${initial.code}`, { method: "PATCH", body });
      } else {
        await api("/api/coupons", { method: "POST", body: { ...body, code: f.code } });
      }
      onSaved(initial ? `Cupom ${initial.code} atualizado ✓` : `Cupom ${f.code.toUpperCase()} criado ✓`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell title={initial ? "EDITAR CUPOM" : "NOVO CUPOM"} sub={initial?.code} onClose={onClose}>
      {!initial && <Field label="Código (sem espaços)" value={f.code} onChange={(v) => set("code", v.toUpperCase())} ph="EX: SARRO15" />}
      <FSelect label="Tipo de desconto" value={f.type} onChange={(v) => set("type", v)}
        options={[["percent", "% sobre o subtotal"], ["fixed", "R$ fixo de desconto"], ["freeship", "Entrega grátis"]]} />
      {f.type !== "freeship" && (
        <Field label={f.type === "percent" ? "Porcentagem (1 a 90)" : "Valor em R$"} value={f.value} onChange={(v) => set("value", v)} ph="10" type="number" />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pedido mínimo (R$)" value={f.min} onChange={(v) => set("min", v)} ph="0" type="number" />
        <Field label="Limite de usos (vazio = ∞)" value={f.max_uses} onChange={(v) => set("max_uses", v)} ph="500" type="number" />
      </div>
      <Field label="Descrição curta" value={f.note} onChange={(v) => set("note", v)} ph="Ex: 10% acima de R$ 40" />
      <button onClick={() => set("active", !f.active)} className="flex items-center gap-2.5">
        <MiniToggle on={f.active} onClick={() => set("active", !f.active)} />
        <span style={{ color: f.active ? C.green : "#7a7a7a", fontSize: 12.5, fontWeight: 800 }}>
          {f.active ? "Cupom ativo" : "Cupom pausado"}
        </span>
      </button>
      {err && <div className="rounded-lg px-3 py-2" style={{ background: `${C.red}18`, color: C.red, fontSize: 12, fontWeight: 700 }}>{err}</div>}
      <Btn full disabled={busy} onClick={save}>{busy ? "SALVANDO…" : initial ? "SALVAR ALTERAÇÕES" : "CRIAR CUPOM"}</Btn>
    </FormShell>
  );
}

function PromoForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState({
    name: initial?.name || "",
    rule: initial?.rule || "",
    window: initial?.window || "",
    starts: toLocalInput(initial?.startsAt),
    ends: toLocalInput(initial?.endsAt),
    active: initial ? !!initial.active : true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const body = {
        name: f.name.trim(), rule: f.rule.trim(), window: f.window.trim(),
        starts_at: fromLocalInput(f.starts), ends_at: fromLocalInput(f.ends),
        active: f.active,
      };
      if (initial) {
        await api(`/api/promos/${initial.id}`, { method: "PATCH", body });
      } else {
        await api("/api/promos", { method: "POST", body });
      }
      onSaved(initial ? "Promoção atualizada ✓" : "Promoção criada ✓");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell title={initial ? "EDITAR PROMOÇÃO" : "NOVA PROMOÇÃO"} onClose={onClose}>
      <Field label="Nome" value={f.name} onChange={(v) => set("name", v)} ph="Ex: Happy Hour do Sarro" />
      <Field label="Regra" value={f.rule} onChange={(v) => set("rule", v)} ph="Ex: 18h às 20h — 15% off em combos" />
      <Field label="Quando vale (texto)" value={f.window} onChange={(v) => set("window", v)} ph="Ex: Terças · 18h às 20h" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Início (vazio = já)" value={f.starts} onChange={(v) => set("starts", v)} type="datetime-local" />
        <Field label="Fim (vazio = sem fim)" value={f.ends} onChange={(v) => set("ends", v)} type="datetime-local" />
      </div>
      <button onClick={() => set("active", !f.active)} className="flex items-center gap-2.5">
        <MiniToggle on={f.active} onClick={() => set("active", !f.active)} />
        <span style={{ color: f.active ? C.green : "#7a7a7a", fontSize: 12.5, fontWeight: 800 }}>
          {f.active ? "Promoção ativa" : "Promoção pausada"}
        </span>
      </button>
      {err && <div className="rounded-lg px-3 py-2" style={{ background: `${C.red}18`, color: C.red, fontSize: 12, fontWeight: 700 }}>{err}</div>}
      <Btn full disabled={busy} onClick={save}>{busy ? "SALVANDO…" : initial ? "SALVAR ALTERAÇÕES" : "CRIAR PROMOÇÃO"}</Btn>
    </FormShell>
  );
}

function AdminPromos({ store, now }) {
  return (
    <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Carregando AdminPromos...</div>}>
      <AdminPromosModular store={store} now={now}  />
    </React.Suspense>
  );
}

function UserForm({ initial, roles, drivers, onClose, onSaved }) {
  const [f, setF] = useState({
    name: initial?.name || "",
    username: initial?.username || "",
    password: "",
    role: initial?.role || "ATENDIMENTO",
    driverId: initial?.driverId || "",
    active: initial ? !!initial.active : true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const body = {
        name: f.name.trim(),
        role: f.role,
        driver_id: f.role === "ENTREGADOR" ? (f.driverId || null) : null,
        active: f.active,
      };
      if (!initial || f.password) body.password = f.password;
      if (initial) {
        await api(`/api/users/${initial.id}`, { method: "PATCH", body });
      } else {
        await api("/api/users", { method: "POST", body: { ...body, username: f.username } });
      }
      onSaved(initial ? `“${f.name}” atualizado ✓` : `Usuário ${f.username.toLowerCase()} criado ✓`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell title={initial ? "EDITAR USUÁRIO" : "NOVO USUÁRIO"} sub={initial?.username} onClose={onClose}>
      <Field label="Nome" value={f.name} onChange={(v) => set("name", v)} ph="Ex: Maria da Chapa" />
      {!initial && <Field label="Usuário (login)" value={f.username} onChange={(v) => set("username", v.toLowerCase())} ph="Ex: maria" />}
      <Field
        label={initial ? "Nova senha (vazio = manter)" : "Senha (mín. 6 caracteres)"}
        value={f.password} onChange={(v) => set("password", v)} ph={initial ? "••••••" : "mínimo 6 caracteres"} type="password"
      />
      <FSelect label="Perfil" value={f.role} onChange={(v) => set("role", v)}
        options={roles.map((r) => [r, ROLE_LABELS[r] || r])} />
      {f.role === "ENTREGADOR" && (
        <FSelect label="Entregador vinculado" value={f.driverId} onChange={(v) => set("driverId", v)}
          options={[["", "— escolher —"], ...drivers.map((d) => [d.id, `${d.name} · ${d.vehicle}`])]} />
      )}
      <button onClick={() => set("active", !f.active)} className="flex items-center gap-2.5">
        <MiniToggle on={f.active} onClick={() => set("active", !f.active)} />
        <span style={{ color: f.active ? C.green : "#7a7a7a", fontSize: 12.5, fontWeight: 800 }}>
          {f.active ? "Conta ativa" : "Conta desativada"}
        </span>
      </button>
      {err && <div className="rounded-lg px-3 py-2" style={{ background: `${C.red}18`, color: C.red, fontSize: 12, fontWeight: 700 }}>{err}</div>}
      <Btn full disabled={busy} onClick={save}>{busy ? "SALVANDO…" : initial ? "SALVAR ALTERAÇÕES" : "CRIAR USUÁRIO"}</Btn>
    </FormShell>
  );
}

function AdminUsers({ store, now }) {
  return (
    <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Carregando AdminUsers...</div>}>
      <AdminUsersModular store={store} now={now}  />
    </React.Suspense>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${C.gray850}` }}>
      <span style={{ color: "#c0c0c0", fontSize: 13 }}>{label}</span>
      {children}
    </div>
  );
}

function Input({ v, w = 220 }) {
  return (
    <input defaultValue={v} className="rounded-lg px-2.5 py-1.5 outline-none text-right"
      style={{ background: C.black, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12.5, width: w }} />
  );
}

function AdminPaymentsCard({ store }) {
  return (
    <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Carregando AdminPaymentsCard...</div>}>
      <AdminPaymentsCardModular store={store}  />
    </React.Suspense>
  );
}

function AdminSettings({ store, now }) {
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <AdminPaymentsCard store={store} />
      <AdminPrinterCard store={store} />
      <AdminStoreCard store={store} />
      <AdminModalitiesCard store={store} />
      <ServiceChargeCard store={store} />

      <Card className="p-4 lg:col-span-2">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14, marginBottom: 10 }}>Usuários e permissões</div>
        {store.me?.role === "ADMIN" ? (
          <AdminUsers store={store} now={now} />
        ) : (
          <div>
            {[
              ["Administrador", "Acesso total, incluindo usuários, financeiro e integrações"],
              ["Gerente", "Tudo, exceto gerenciar usuários"],
              ["Atendimento", "Pedidos, clientes e cupons"],
              ["Cozinha", "Somente painel da cozinha"],
              ["Expedição", "Pedidos prontos e atribuição de entregador"],
              ["Entregador", "Somente as próprias entregas"],
            ].map(([r, d]) => (
              <div key={r} className="py-2.5" style={{ borderBottom: `1px solid ${C.gray850}` }}>
                <span style={{ color: C.white, fontWeight: 800, fontSize: 12.5 }}>{r}</span>
                <span style={{ color: "#8a8a8a", fontSize: 11.5 }}> — {d}</span>
              </div>
            ))}
            <div style={{ color: C.yellowLight, fontSize: 11.5, marginTop: 10, fontWeight: 700 }}>
              🔒 Só o administrador gerencia acessos.
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14, marginBottom: 10 }}>Impressão</div>
        <div className="flex flex-wrap gap-2">
          {[
            ["Comanda da cozinha", printKitchen],
            ["Comanda de expedição", printExpedition],
            ["Cupom do cliente", (o) => printReceipt(o, store.settings)],
            ["Etiqueta da sacola", printLabel],
          ].map(([t, fn]) => (
            <Btn key={t} small variant="dark" onClick={() => {
              const demo = store.orders[0];
              if (!demo) return store.toast("Crie um pedido para testar a impressão");
              fn(demo);
            }}>🖨 {t}</Btn>
          ))}
        </div>
        <div style={{ color: "#7a7a7a", fontSize: 11.5, marginTop: 12 }}>
          Impressão automática ao confirmar o pedido está ligada para cozinha e expedição.
        </div>
      </Card>

      <Card className="p-4">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14, marginBottom: 10 }}>Relatórios</div>
        <div className="flex flex-wrap gap-2">
          {["Vendas", "Pedidos", "Produtos", "Clientes", "Entregas", "Cancelamentos", "Pagamentos", "Canais"].map((r) => (
            <Btn key={r} small variant="dark" onClick={() => store.toast(`Exportando relatório de ${r.toLowerCase()}`)}>{r}</Btn>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          {["Excel", "CSV", "PDF"].map((f) => (
            <Btn key={f} small onClick={() => store.toast(`Arquivo ${f} gerado`)}>{f}</Btn>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// MESAS / SALÃO — Gestão de comandas presenciais
// ============================================================

function AdminTables({ store, now }) {
  return (
    <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Carregando AdminTables...</div>}>
      <AdminTablesModular store={store} now={now}  />
    </React.Suspense>
  );
}

function AdminCashRegister({ store, now }) {
  return (
    <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Carregando AdminCashRegister...</div>}>
      <AdminCashRegisterModular store={store} now={now}  />
    </React.Suspense>
  );
}

function KitchenApp({ store, now }) {
  return (
    <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Carregando KitchenApp...</div>}>
      <KitchenAppModular store={store} now={now}  />
    </React.Suspense>
  );
}

function DriverSettlementModal({ driver, store, onClose, readOnly = false }) {
  const [loading, setLoading] = useState(true);
  const [settlementData, setSettlementData] = useState(null);
  const [basePay, setBasePay] = useState(0);
  const [notes, setNotes] = useState("");
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await store.getDriverSettlement(driver.id);
        if (mounted) setSettlementData(data);
      } catch (err) {
        store.toast(err.message || "Erro ao carregar acerto do entregador");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [driver.id]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.82)" }}>
        <Card className="p-8 text-center" style={{ background: C.gray900 }}>
          <div className="animate-spin text-3xl mb-2">🔄</div>
          <div style={{ color: C.white, fontWeight: 700 }}>Calculando acerto de {driver.name}...</div>
        </Card>
      </div>
    );
  }

  const orders = settlementData?.orders || [];
  const s = settlementData?.summary || {};
  const totalOrders = orders.length;
  const totalFees = s.totalFees || 0;
  const cashCollected = s.totalCashCollected || 0;
  const numBasePay = Math.max(0, parseFloat(basePay) || 0);
  const totalToDriver = totalFees + numBasePay;
  const netDiff = Math.round((cashCollected - totalToDriver) * 100) / 100;

  const currentPreviewSettlement = {
    createdAt: Date.now(),
    settledBy: store.me?.name || "Operador",
    driver,
    orders,
    summary: {
      deliveriesCount: totalOrders,
      totalFees,
      basePay: numBasePay,
      totalCashCollected: cashCollected,
      totalDueToDriver: totalToDriver,
      netBalance: netDiff,
    },
  };

  const handlePrint = () => {
    printDriverSettlementReceipt(currentPreviewSettlement, store.settings);
  };

  const handleSettle = async () => {
    if (orders.length === 0) {
      store.toast("Não há entregas pendentes para fechar com este entregador.");
      return;
    }
    const msgConfirm = netDiff > 0
      ? `Confirmar fechamento com ${driver.name}?\n${totalOrders} entregas realizadas.\nO motoboy deve DEVOLVER ${brl(netDiff)} ao caixa da loja.`
      : netDiff < 0
      ? `Confirmar fechamento com ${driver.name}?\n${totalOrders} entregas realizadas.\nA loja deve PAGAR ${brl(Math.abs(netDiff))} ao motoboy.`
      : `Confirmar fechamento com ${driver.name}?\n${totalOrders} entregas realizadas.\nSaldo zerado (contas batidas!).`;

    if (!confirm(msgConfirm)) return;

    try {
      setSettling(true);
      const res = await store.settleDriver(driver.id, {
        basePay: numBasePay,
        notes: notes || "",
      });
      printDriverSettlementReceipt(res, store.settings);
      onClose();
    } catch (err) {
      store.toast(err.message || "Erro ao registrar fechamento");
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto" style={{ background: "rgba(0,0,0,.82)" }}>
      <Card className="w-full max-w-xl max-h-[92vh] flex flex-col p-0 overflow-hidden" style={{ border: `1px solid ${C.orange}66`, background: C.gray900 }}>
        {/* Header */}
        <div className="p-4 flex items-center justify-between" style={{ background: C.gray850, borderBottom: `1px solid ${C.gray800}` }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🤝</span>
              <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: C.white }}>
                ACERTO DE ENTREGADOR
              </h3>
            </div>
            <div style={{ color: C.orange, fontSize: 13, fontWeight: 700, marginTop: 2 }}>
              {driver.name} {driver.vehicle ? `· ${driver.vehicle}` : ""}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold px-2">✕</button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Métricas do Turno */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl text-center" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
              <div style={{ color: "#8a8a8a", fontSize: 10, fontWeight: 700 }}>ENTREGAS</div>
              <div style={{ color: C.white, fontSize: 18, fontWeight: 900 }}>{totalOrders}</div>
            </div>
            <div className="p-2.5 rounded-xl text-center" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
              <div style={{ color: "#8a8a8a", fontSize: 10, fontWeight: 700 }}>TAXAS MOTOBOY</div>
              <div style={{ color: C.green, fontSize: 18, fontWeight: 900 }}>{brl(totalFees)}</div>
            </div>
            <div className="p-2.5 rounded-xl text-center" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
              <div style={{ color: "#8a8a8a", fontSize: 10, fontWeight: 700 }}>DINHEIRO RECOLHIDO</div>
              <div style={{ color: C.yellowLight, fontSize: 18, fontWeight: 900 }}>{brl(cashCollected)}</div>
            </div>
            <div className="p-2.5 rounded-xl text-center" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
              <div style={{ color: "#8a8a8a", fontSize: 10, fontWeight: 700 }}>TOTAL CORRIDAS</div>
              <div style={{ color: "#38bdf8", fontSize: 18, fontWeight: 900 }}>
                {brl(orders.reduce((sum, o) => sum + (o.total || 0), 0))}
              </div>
            </div>
          </div>

          {/* Ajuste de Remuneração Base / Diária */}
          <div className="p-3.5 rounded-xl space-y-3" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
            <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>⚙️ Parâmetros do Fechamento</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label style={{ color: "#a0a0a0", fontSize: 11, fontWeight: 700 }} className="block mb-1">
                  Diária Fixa / Ajuda de Custo (R$)
                </label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={basePay}
                  disabled={readOnly}
                  onChange={(e) => setBasePay(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg font-bold text-sm text-white"
                  style={{ background: C.gray900, border: `1px solid ${C.gray700}` }}
                />
              </div>
              <div>
                <label style={{ color: "#a0a0a0", fontSize: 11, fontWeight: 700 }} className="block mb-1">
                  Observações / Turno
                </label>
                <input
                  type="text"
                  value={notes}
                  disabled={readOnly}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Turno almoço / chuva"
                  className="w-full px-3 py-2 rounded-lg font-normal text-sm text-white"
                  style={{ background: C.gray900, border: `1px solid ${C.gray700}` }}
                />
              </div>
            </div>
          </div>

          {/* Resumo Financeiro / Saldo Líquido */}
          <div
            className="p-4 rounded-xl space-y-2.5"
            style={{
              background: netDiff > 0 ? "#16653422" : netDiff < 0 ? "#1e3a5f33" : "#1e1e1e",
              border: `2px solid ${netDiff > 0 ? C.green : netDiff < 0 ? "#38bdf8" : C.gray700}`
            }}
          >
            <div className="flex justify-between text-xs">
              <span style={{ color: "#a0a0a0" }}>Total ganho pelo motoboy (Taxas + Diária):</span>
              <span style={{ color: C.white, fontWeight: 800 }}>{brl(totalToDriver)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: "#a0a0a0" }}>Total em dinheiro recolhido dos clientes:</span>
              <span style={{ color: C.white, fontWeight: 800 }}>{brl(cashCollected)}</span>
            </div>
            <div className="pt-2 flex items-center justify-between" style={{ borderTop: `1px solid ${C.gray800}` }}>
              <div>
                <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>
                  {netDiff > 0
                    ? "💰 Motoboy Devolve ao Caixa:"
                    : netDiff < 0
                    ? "💵 Caixa Paga ao Motoboy:"
                    : "🤝 Acerto 100% Equilibrado:"}
                </div>
                <div style={{ color: "#a0a0a0", fontSize: 11 }}>
                  {netDiff > 0
                    ? "Dinheiro recebido em mãos supera o valor das taxas"
                    : netDiff < 0
                    ? "Taxas ganhas superam o dinheiro recolhido"
                    : "Nenhum repasse adicional pendente"}
                </div>
              </div>
              <div style={{ color: netDiff > 0 ? C.green : netDiff < 0 ? "#38bdf8" : C.white, fontWeight: 900, fontSize: 22 }}>
                {brl(Math.abs(netDiff))}
              </div>
            </div>
          </div>

          {/* Lista de Pedidos Entregues */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: C.white, fontWeight: 800, fontSize: 12 }}>
                Entregas Realizadas no Turno ({orders.length})
              </span>
              <span style={{ color: "#8a8a8a", fontSize: 11 }}>
                Faturamento: {brl(orders.reduce((sum, o) => sum + (o.total || 0), 0))}
              </span>
            </div>
            {orders.length === 0 ? (
              <div className="p-4 rounded-xl text-center" style={{ background: C.gray850, color: "#8a8a8a", fontSize: 12 }}>
                Nenhuma entrega pendente de acerto para este entregador.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {orders.map((o) => (
                  <div
                    key={o.id}
                    className="p-2.5 rounded-lg flex items-center justify-between text-xs"
                    style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span style={{ color: C.white, fontWeight: 800 }}>#{o.code}</span>
                        <span style={{ color: "#c0c0c0" }}>{o.customer?.name}</span>
                        {o.routeId && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold" style={{ background: `${C.orange}33`, color: C.orange }}>
                            Rota #{o.routeId.slice(-4)} {o.routeSeq ? `(P${o.routeSeq})` : ""}
                          </span>
                        )}
                      </div>
                      <div style={{ color: "#8a8a8a", fontSize: 11 }}>
                        Forma: <b style={{ color: String(o.payment).toUpperCase().includes("DINHEIRO") ? C.yellowLight : "#a0a0a0" }}>{o.payment}</b> · Total: {brl(o.total)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div style={{ color: C.green, fontWeight: 800 }}>+{brl(o.fee || 0)}</div>
                      <div style={{ color: "#7a7a7a", fontSize: 10 }}>taxa entrega</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 flex flex-wrap gap-2 items-center justify-between" style={{ background: C.gray850, borderTop: `1px solid ${C.gray800}` }}>
          <button
            onClick={handlePrint}
            className="px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 text-white active:scale-95"
            style={{ background: C.gray800, border: `1px solid ${C.gray700}` }}
          >
            <span>🖨</span>
            <span>Imprimir Extrato</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl font-bold text-xs text-gray-400 hover:text-white"
            >
              Fechar
            </button>
            {!readOnly && orders.length > 0 && (
              <button
                disabled={settling}
                onClick={handleSettle}
                className="px-4 py-2.5 rounded-xl font-black text-xs text-black active:scale-95 transition flex items-center gap-2"
                style={{ background: C.green }}
              >
                <span>{settling ? "⏳" : "🤝"}</span>
                <span>{settling ? "Registrando..." : "QUITAR & FECHAR ACERTO"}</span>
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// MODAL DE HISTÓRICO DE ACERTOS DE ENTREGADORES
// ============================================================

function SettlementsHistoryModal({ store, onClose }) {
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await api("/api/settlements?limit=30");
        if (mounted) setSettlements(data.settlements || (Array.isArray(data) ? data : []));
      } catch (err) {
        store.toast("Erro ao carregar histórico de acertos");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" style={{ background: "rgba(0,0,0,.82)" }}>
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden" style={{ border: `1px solid ${C.orange}66`, background: C.gray900 }}>
        <div className="p-4 flex items-center justify-between" style={{ background: C.gray850, borderBottom: `1px solid ${C.gray800}` }}>
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: C.white }}>
              HISTÓRICO DE ACERTOS DE ENTREGADORES
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold px-2">✕</button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Carregando acertos...</div>
          ) : settlements.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Nenhum acerto registrado ainda.</div>
          ) : (
            settlements.map((s) => (
              <div
                key={s.id}
                className="p-3.5 rounded-xl space-y-2 text-xs"
                style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>{s.driver_name}</span>
                    <span style={{ color: "#7a7a7a", marginLeft: 8 }}>
                      {new Date(s.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <button
                    onClick={() => printDriverSettlementReceipt(s, store.settings)}
                    className="px-2.5 py-1 rounded-lg font-bold text-xs text-white flex items-center gap-1 active:scale-95"
                    style={{ background: C.gray800, border: `1px solid ${C.gray700}` }}
                  >
                    <span>🖨</span>
                    <span>2ª Via</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                  <div className="p-1.5 rounded" style={{ background: C.gray900 }}>
                    <div style={{ color: "#7a7a7a", fontSize: 9 }}>ENTREGAS</div>
                    <div style={{ color: C.white, fontWeight: 800 }}>{s.deliveries_count}</div>
                  </div>
                  <div className="p-1.5 rounded" style={{ background: C.gray900 }}>
                    <div style={{ color: "#7a7a7a", fontSize: 9 }}>TAXAS MOTOBY</div>
                    <div style={{ color: C.green, fontWeight: 800 }}>{brl(s.total_fees)}</div>
                  </div>
                  <div className="p-1.5 rounded" style={{ background: C.gray900 }}>
                    <div style={{ color: "#7a7a7a", fontSize: 9 }}>DINHEIRO RECOLHIDO</div>
                    <div style={{ color: C.yellowLight, fontWeight: 800 }}>{brl(s.total_cash_collected)}</div>
                  </div>
                  <div className="p-1.5 rounded" style={{ background: C.gray900 }}>
                    <div style={{ color: "#7a7a7a", fontSize: 9 }}>SALDO FINAL</div>
                    <div style={{ color: s.net_balance >= 0 ? C.green : "#38bdf8", fontWeight: 800 }}>
                      {s.net_balance >= 0 ? `+${brl(s.net_balance)}` : brl(s.net_balance)}
                    </div>
                  </div>
                </div>
                {s.notes && (
                  <div style={{ color: "#8a8a8a", fontSize: 11, fontStyle: "italic" }}>
                    Obs: {s.notes} · Fechado por {s.settled_by}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-3 bg-gray-850 flex justify-end" style={{ borderTop: `1px solid ${C.gray800}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl font-bold text-xs text-white bg-gray-800 hover:bg-gray-700">
            Fechar
          </button>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// EXPEDIÇÃO
// ============================================================

function ExpeditionApp({ store, now }) {
  return (
    <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Carregando ExpeditionApp...</div>}>
      <ExpeditionAppModular store={store} now={now}  />
    </React.Suspense>
  );
}

function pathRole() {
  const p = (window.location.pathname || "").replace(/\/+$/, "").toLowerCase();
  return ROLES.find((r) => r.path !== "/" && p.endsWith(r.path))?.id || "cliente";
}

async function api(path, opts = {}) {
  const r = await fetch(path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data = {};
  try { data = await r.json(); } catch { /* resposta vazia */ }
  if (!r.ok) {
    const err = new Error(data.error || "Não foi possível falar com o servidor.");
    err.status = r.status;
    throw err;
  }
  return data;
}

function Splash({ error, onRetry }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: C.black }}>
      <img
        src={LOGO_ROUND} alt="TÔ NO SARRO!" width={110} height={110}
        style={{ borderRadius: "50%", animation: error ? "none" : "sarrofloat 1.6s ease-in-out infinite" }}
      />
      <div style={{ fontFamily: font.display, fontStyle: "italic", color: C.orange, fontSize: 24, marginTop: 22 }}>
        {error ? "A CHAPA APAGOU!" : "ACENDENDO A CHAPA…"}
      </div>
      <div style={{ color: "#8a8a8a", fontSize: 13, marginTop: 8, maxWidth: 300, lineHeight: 1.5 }}>
        {error
          ? "Não conseguimos falar com o servidor. Confere se a API está rodando (npm run dev:all)."
          : "TÔ NO SARRO! Smart Food System"}
      </div>
      {error && <div className="mt-6"><Btn onClick={onRetry}>Tentar de novo</Btn></div>}
    </div>
  );
}

function LoginScreen({ target, me, onDone, onCancel }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const label = ROLES.find((r) => r.id === target)?.label || target;

  const submit = async (e) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const d = await api("/api/auth/login", { method: "POST", body: { username: u, password: p } });
      const gate = STAFF_GATE[target] || [];
      if (!gate.includes(d.user.role)) {
        setErr(`“${d.user.username}” não tem acesso ao painel ${label}.`);
        return;
      }
      onDone(d.user);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const demo = [
    ["admin", "admin123", "Administrador"],
    ["cozinha", "cozinha123", "Cozinha"],
    ["rafael", "entregador123", "Entregador"],
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: C.black }}>
      <div className="w-full" style={{ maxWidth: 400 }}>
        <div className="flex flex-col items-center mb-6">
          <img src={LOGO_ROUND} alt="TÔ NO SARRO!" width={86} height={86} style={{ borderRadius: "50%" }} />
          <div style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 22, color: C.white, marginTop: 14 }}>
            ÁREA DA EQUIPE
          </div>
          <div style={{ color: "#8a8a8a", fontSize: 12.5, marginTop: 4 }}>
            Painel de {label} · entre com sua conta
          </div>
        </div>

        <Card className="p-5">
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span style={{ color: "#9a9a9a", fontSize: 11.5, fontWeight: 700 }}>Usuário</span>
              <input
                value={u} onChange={(e) => setU(e.target.value)} autoFocus autoCapitalize="none"
                className="w-full rounded-xl px-3 py-3 mt-1.5 outline-none"
                style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 14 }}
              />
            </label>
            <label className="block">
              <span style={{ color: "#9a9a9a", fontSize: 11.5, fontWeight: 700 }}>Senha</span>
              <input
                value={p} onChange={(e) => setP(e.target.value)} type="password"
                className="w-full rounded-xl px-3 py-3 mt-1.5 outline-none"
                style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 14 }}
              />
            </label>
            {err && (
              <div className="rounded-lg px-3 py-2" style={{ background: `${C.red}18`, color: C.red, fontSize: 12, fontWeight: 700 }}>
                {err}
              </div>
            )}
            <Btn full disabled={busy || !u.trim() || !p}>
              {busy ? "ENTRANDO…" : `ENTRAR NO PAINEL`}
            </Btn>
          </form>

          <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.gray800}` }}>
            <div style={{ color: "#6a6a6a", fontSize: 10.5, marginBottom: 8 }}>
              Contas de demonstração (toque para preencher):
            </div>
            <div className="flex flex-wrap gap-2">
              {demo.map(([us, pw, lbl]) => (
                <button
                  key={us}
                  onClick={() => { setU(us); setP(pw); }}
                  className="rounded-lg px-2.5 py-1.5 font-bold"
                  style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: "#c0c0c0", fontSize: 11 }}
                >
                  {lbl}: {us}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <div className="mt-4 text-center">
          <button onClick={onCancel} style={{ color: "#8a8a8a", fontSize: 13 }}>
            ← Voltar para o cardápio
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState(false);
  const [me, setMe] = useState(null);
  // O painel inicial vem da URL (/admin, /cozinha, /expedicao, /entregador)
  const [role, setRole] = useState(pathRole);
  const [loginFor, setLoginFor] = useState(pathRole);
  const [tab, setTab] = useState("inicio");

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [promos, setPromos] = useState([]);
  const [cashRegister, setCashRegister] = useState(null);
  const [settings, setSettings] = useState({ open: true, fee: 7.9, minOrder: 25, eta: "35–45 min" });
  const [catalog, setCatalog] = useState({ categories: [], optionGroups: [], builder: [] });

  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sarro_cart")) || []; } catch { return []; }
  });
  const [tableParam, setTableParam] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("mesa");
      if (p) {
        const clean = p.replace(/\D/g, "");
        if (clean) return `Mesa ${clean.padStart(2, "0")}`;
      }
      return null;
    } catch { return null; }
  });
  const [coupon, setCoupon] = useState(null);
  const [myOrderId, setMyOrderId] = useState(() => localStorage.getItem("sarro_my_order") || null);
  const [myOrder, setMyOrder] = useState(null);
  const [toastMsg, setToastMsg] = useState("");
  const [confetti, setConfetti] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [appVersion, setAppVersion] = useState("");
  const [wsOnline, setWsOnline] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(Date.now());

  const known = useRef(null);
  const roleRef = useRef(role);
  roleRef.current = role;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    localStorage.setItem("sarro_cart", JSON.stringify(cart));
  }, [cart]);

  const toast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2400);
  };

  const notify = useCallback((msg) => {
    setNotifications((n) => [{ id: uid(), msg, at: Date.now() }, ...n].slice(0, 20));
  }, []);

  const applySync = useCallback((d) => {
    // Alerta de pedido novo para a equipe (o cliente tem o próprio fluxo)
    if (known.current && roleRef.current !== "cliente") {
      const fresh = d.orders.filter((o) => !known.current.has(o.id));
      if (fresh.length) {
        beep(880);
        fresh.slice(0, 3).forEach((o) =>
          notify(`🔥 Novo pedido ${CHANNELS[o.channel]?.short || ""} #${o.code} · ${brl(o.total)}`)
        );
        // Impressão automática da comanda quando o KDS está aberto com o modo ligado
        if (roleRef.current === "cozinha" && localStorage.getItem("sarro_autoprint") === "1") {
          fresh.slice(0, 3).forEach((o) => {
            api(`/api/print/kitchen/${o.id}`, { method: "POST" }).catch(() => printKitchen(o));
          });
        }
      }
    }
    known.current = new Set(d.orders.map((o) => o.id));
    setOrders(d.orders);
    setProducts(d.products);
    setInventory(d.inventory);
    setDrivers(d.drivers);
    setCustomers(d.customers);
    setCoupons(d.coupons);
    setPromos(d.promos);
    setSettings(d.settings);
    if (d.cashRegister !== undefined) setCashRegister(d.cashRegister);
    setLastSyncAt(Date.now());
  }, [notify]);

  const load = () => {
    setBootError(false);
    api("/api/bootstrap")
      .then((d) => {
        setCatalog({ categories: d.categories, optionGroups: d.optionGroups, builder: d.builder });
        setMe(d.me);
        if (d.version) setAppVersion(d.version);
        const myId = localStorage.getItem("sarro_my_order");
        if (myId) {
          const t = encodeURIComponent(localStorage.getItem("sarro_my_token") || "");
          api(`/api/track/${myId}?t=${t}`).then((r) => setMyOrder(r.order)).catch(() => {});
        }
        known.current = new Set(d.orders.map((o) => o.id));
        applySync(d);
        setReady(true);
      })
      .catch(() => setBootError(true));
  };

  useEffect(() => { load(); }, []);

  // Voltar/avançar do navegador troca de painel sem recarregar a página
  useEffect(() => {
    const onPop = () => { setRole(pathRole()); setLoginFor(null); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Tempo real: um canal só, snapshot a cada mudança
  useEffect(() => {
    let ws = null;
    let closed = false;
    let retry = null;
    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => setWsOnline(true);
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (m.type === "sync") applySync(m.data);
        } catch { /* ignora */ }
      };
      ws.onclose = () => { setWsOnline(false); if (!closed) retry = setTimeout(connect, 2000); };
      ws.onerror = () => { setWsOnline(false); ws.close(); };
    };
    connect();
    return () => { closed = true; clearTimeout(retry); ws?.close(); };
  }, [applySync]);

  // Rede de segurança: se o WebSocket cair, os painéis se atualizam
  // sozinhos a cada 60s (a cozinha não pode ficar cega).
  useEffect(() => {
    const tick = () => {
      api("/api/bootstrap")
        .then((d) => {
          setCatalog({ categories: d.categories, optionGroups: d.optionGroups, builder: d.builder });
          applySync(d);
        })
        .catch(() => {});
    };
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [applySync]);

  const refreshAll = useCallback(async (announce) => {
    try {
      const d = await api("/api/bootstrap");
      setCatalog({ categories: d.categories, optionGroups: d.optionGroups, builder: d.builder });
      applySync(d);
      if (announce) toast("Pedidos atualizados ✓");
    } catch {
      if (announce) toast("Sem conexão com o servidor");
    }
  }, [applySync]);

  // Voltou pra aba/app depois de um tempo? Atualiza na hora (com trava
  // de 15s para não refazer a carga a cada clique fora e dentro).
  useEffect(() => {
    let last = 0;
    const wake = () => {
      const t = Date.now();
      if (t - last < 15000) return;
      last = t;
      refreshAll(false);
    };
    const onVis = () => { if (document.visibilityState === "visible") wake(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", wake);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", wake);
    };
  }, [refreshAll]);

  const store = {
    role, tab, setTab, me,
    orders, products, inventory, drivers, customers, coupons, promos, settings,
    optionGroups: catalog.optionGroups, builder: catalog.builder, categories: catalog.categories,
    cart, coupon, setCoupon, myOrderId, myOrder, notifications, toast,
    tableParam, setTableParam,
    wsOnline, lastSyncAt, refreshAll,
    refreshMyOrder: async () => {
      const id = localStorage.getItem("sarro_my_order");
      if (!id) return null;
      const t = encodeURIComponent(localStorage.getItem("sarro_my_token") || "");
      const d = await api(`/api/track/${id}?t=${t}`);
      setMyOrder(d.order);
      return d.order;
    },
    open: settings.open,
    fee: settings.fee,

    addItem: (item) => setCart((c) => [...c, item]),
    removeItem: (id) => setCart((c) => c.filter((i) => i.id !== id)),
    setQty: (id, qty) =>
      setCart((c) => (qty <= 0 ? c.filter((i) => i.id !== id) : c.map((i) => (i.id === id ? { ...i, qty } : i)))),

    checkPayment: async (orderId) => {
      const t = encodeURIComponent(localStorage.getItem("sarro_my_token") || "");
      const d = await api(`/api/orders/${orderId}/payment_status?t=${t}`, { method: "POST" });
      return d;
    },

    triggerConfetti: () => {
      setConfetti(true);
      setTimeout(() => setConfetti(false), 3000);
    },

    confirmPaymentManual: async (orderId) => {
      try {
        await api(`/api/orders/${orderId}/confirm-payment`, { method: "POST" });
        await refreshAll();
        toast("Pagamento confirmado manualmente ✓");
      } catch (e) {
        toast(e.message);
      }
    },

    refreshSettings: async () => {
      await refreshAll();
    },

    cashRegister, setCashRegister,
    refreshCashRegister: async () => {
      try {
        const d = await api("/api/cash/current");
        setCashRegister(d.register || null);
        return d.register;
      } catch {
        return null;
      }
    },
    openCashRegister: async ({ initialCash, notes }) => {
      const d = await api("/api/cash/open", { method: "POST", body: { initialCash, notes } });
      setCashRegister(d.register);
      toast("Turno de caixa aberto com sucesso! 💵");
      return d.register;
    },
    addCashTransaction: async ({ type, amount, reason, method }) => {
      const d = await api("/api/cash/transaction", { method: "POST", body: { type, amount, reason, method } });
      setCashRegister(d.register);
      toast(`${type === "SUPRIMENTO" ? "Suprimento" : "Sangria"} registrada ✓`);
      return d.register;
    },
    closeCashRegister: async ({ closedCash, declaredPix, declaredCard, notes }) => {
      const d = await api("/api/cash/close", { method: "POST", body: { closedCash, declaredPix, declaredCard, notes } });
      setCashRegister(d.register);
      toast("Caixa fechado com sucesso! 🔒");
      return d.register;
    },

    dispatchRoute: async ({ driverId, orderIds }) => {
      const d = await api("/api/routes/dispatch", { method: "POST", body: { driverId, orderIds } });
      await refreshAll();
      toast(`Rota com ${d.count} entregas despachada com sucesso! 🛵`);
      return d;
    },
    getDriverSettlement: async (driverId) => {
      const d = await api(`/api/drivers/${driverId}/settlement`);
      return d.settlement;
    },
    settleDriver: async (driverId, { basePay, notes }) => {
      const d = await api(`/api/drivers/${driverId}/settle`, { method: "POST", body: { basePay, notes } });
      await refreshAll();
      toast("Acerto de contas realizado com sucesso! 🤝");
      return d.settlement;
    },

    validateCoupon: async (code, subtotal) => {
      const d = await api("/api/coupons/validate", { method: "POST", body: { code, subtotal } });
      return d.coupon;
    },

    placeOrder: async (payload) => {
      try {
        const d = await api("/api/orders", { method: "POST", body: payload });
        const order = d.order;
        known.current?.add(order.id);
        setOrders((o) => [order, ...o.filter((x) => x.id !== order.id)]);
        setCart([]);
        setCoupon(null);
        setMyOrderId(order.id);
        setMyOrder(order);
        localStorage.setItem("sarro_my_order", order.id);
        localStorage.setItem("sarro_my_token", order.trackToken || "");
        setTab("pedidos");
        setConfetti(true);
        setTimeout(() => setConfetti(false), 2600);
        notify(`Pedido #${order.code} recebido · ${brl(order.total)}`);
        beep(1040);
        toast(`Pedido #${order.code} confirmado! 🍔`);

        // Pagamento online (Pix/cartão): gera código Pix ou abre checkout InfinitePay
        if (["PIX", "CARTAO_ONLINE"].includes(payload.payment)) {
          try {
            const pd = await api(`/api/orders/${order.id}/pay?t=${encodeURIComponent(order.trackToken || "")}`, { method: "POST" });
            if (pd.url || pd.pixCode) {
              setOrders((os) => os.map((x) => (x.id === order.id ? { ...x, payUrl: pd.url, pixCode: pd.pixCode } : x)));
              setMyOrder((m) => (m && m.id === order.id ? { ...m, payUrl: pd.url, pixCode: pd.pixCode } : m));
              if (pd.url && payload.payment === "CARTAO_ONLINE") {
                window.open(pd.url, "_blank");
              }
            }
          } catch (pe) {
            toast(pe.message);
          }
        }
        return true;
      } catch (e) {
        toast(e.message);
        return false;
      }
    },

    setStatus: (id, status) => {
      api(`/api/orders/${id}/status`, { method: "PATCH", body: { status } })
        .catch((e) => toast(e.message));
    },

    advance: (id) => {
      const o = orders.find((x) => x.id === id);
      if (!o) return;
      const next = FLOW[FLOW.indexOf(o.status) + 1];
      if (next) store.setStatus(id, next);
    },

    assignDriver: (id, driverId) => {
      api(`/api/orders/${id}/driver`, { method: "PATCH", body: { driverId } })
        .then(() => {
          const d = drivers.find((x) => x.id === driverId);
          toast(`${d ? d.name.split(" ")[0] : "Entregador"} saiu para entrega 🛵`);
          notify(`${d ? d.name : "Entregador"} assumiu o pedido`);
        })
        .catch((e) => toast(e.message));
    },

    updateProduct: (id, patch) => {
      api(`/api/products/${id}`, { method: "PATCH", body: patch }).catch((e) => toast(e.message));
    },

    saveProduct: async (id, payload, file) => {
      let pid = id;
      if (id) {
        await api(`/api/products/${id}`, { method: "PATCH", body: payload });
      } else {
        const d = await api("/api/products", { method: "POST", body: payload });
        pid = d.product.id;
      }
      if (file) {
        const r = await fetch(`/api/products/${pid}/image`, {
          method: "POST",
          headers: { "Content-Type": file.type },
          credentials: "same-origin",
          body: file,
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error || "Falha ao enviar a foto.");
        }
      }
    },

    deleteProduct: (id) => {
      api(`/api/products/${id}`, { method: "DELETE" })
        .then(() => toast("Produto excluído"))
        .catch((e) => toast(e.message));
    },

    moveStock: (id, delta) => {
      api(`/api/inventory/${id}`, { method: "PATCH", body: { delta } }).catch((e) => toast(e.message));
    },

    setOpen: (v) => {
      api("/api/settings", { method: "PATCH", body: { open: v } }).catch((e) => toast(e.message));
    },

    injectExternal: (channel) => {
      api("/api/orders/external", { method: "POST", body: { channel } })
        .then((d) => {
          notify(`Novo pedido ${CHANNELS[channel].label} #${d.order.code}`);
          beep(620);
          toast(`Pedido #${d.order.code} recebido do ${CHANNELS[channel].label}`);
        })
        .catch((e) => toast(e.message));
    },

    logout: () => {
      api("/api/auth/logout", { method: "POST" })
        .then(() => { setMe(null); goRole("cliente"); toast("Você saiu da conta"); })
        .catch(() => {});
    },
  };

  // Troca de painel: muda a URL e o estado juntos; painel da equipe sem
  // sessão pede login antes de mostrar qualquer coisa.
  const goRole = (r) => {
    const gate = STAFF_GATE[r];
    const needsLogin = !!gate && (!me || !gate.includes(me.role));
    setLoginFor(needsLogin ? r : null);
    setRole(r);
    const p = rolePath(r);
    if (window.location.pathname !== p) window.history.pushState({ role: r }, "", p);
  };

  // Atalhos teclado Sprint6 (M=mesas, E=expedição, C=cozinha, Ctrl+K busca)
  useKeyboardShortcuts({ store: { role, settings, setTab }, goRole });

  if (!ready) return <Splash error={bootError} onRetry={load} />;

  const gate = STAFF_GATE[role];
  const allowed = !gate || (me && gate.includes(me.role));

  return (
    <div style={{ background: C.black, minHeight: "100vh", fontFamily: font.body, color: C.white }} className="overflow-x-hidden">
      <style>{css}</style>

      {/* Barra superior de atalhos da equipe:
          - Oculta no cardápio do cliente (tela 100% limpa para pedidos)
          - Oculta para outros usuários (cozinha, expedição, entregador, etc.)
          - Exibida APENAS para usuário administrador (ADMIN) nas áreas administrativas */}
      {me && me.role === "ADMIN" && role !== "cliente" && (
        <div
          className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto"
          style={{ background: C.gray900, borderBottom: `1px solid ${C.gray800}`, position: "sticky", top: 0, zIndex: 40 }}
        >
          <span style={{ color: "#5a5a5a", fontSize: 10, fontWeight: 800, marginRight: 4, whiteSpace: "nowrap" }}>
            SMART FOOD SYSTEM{appVersion ? ` · ${appVersion}` : ""}
          </span>
          {ROLES.map((r) => {
            const locked = STAFF_GATE[r] && (!me || !STAFF_GATE[r].includes(me.role));
            return (
              <a
                key={r.id}
                href={rolePath(r.id)}
                onClick={(e) => { e.preventDefault(); goRole(r.id); }}
                className="shrink-0 rounded-lg px-2.5 py-1.5 font-bold"
                style={{
                  background: role === r.id ? `linear-gradient(100deg, ${C.orange}, ${C.yellow})` : "transparent",
                  color: role === r.id ? C.black : "#8a8a8a",
                  border: `1px solid ${role === r.id ? "transparent" : C.gray800}`,
                  fontSize: 11.5, whiteSpace: "nowrap", textDecoration: "none",
                }}
              >
                {r.icon} {r.label}{locked ? " 🔒" : ""}
              </a>
            );
          })}
          <div className="flex-1" />
          <span className="shrink-0 flex items-center gap-2">
            <span className="hidden sm:inline" style={{ color: "#8a8a8a", fontSize: 11 }}>
              {me.name.split(" ")[0]} · {me.role}
            </span>
            <button
              onClick={store.logout}
              className="rounded-lg px-2 py-1 font-bold"
              style={{ border: `1px solid ${C.gray800}`, color: "#c0c0c0", fontSize: 10.5 }}
            >
              Sair
            </button>
          </span>
        </div>
      )}

      {/* Quando o administrador visualiza o cardápio, botão flutuante para retornar */}
      {me && me.role === "ADMIN" && role === "cliente" && (
        <a
          href={rolePath("admin")}
          onClick={(e) => { e.preventDefault(); goRole("admin"); }}
          className="fixed z-40 flex items-center gap-1.5 rounded-full px-3.5 py-2 font-bold shadow-2xl active:scale-95 transition"
          style={{
            bottom: 84, left: 16,
            background: C.gray900,
            border: `1px solid ${C.orange}`,
            color: C.orange,
            fontSize: 11.5,
            boxShadow: "0 8px 24px rgba(0,0,0,.7)",
            textDecoration: "none",
          }}
        >
          <span>📊</span>
          <span>Voltar ao Admin</span>
        </a>
      )}

      {!allowed ? (
        <LoginScreen
          target={loginFor || role}
          me={me}
          onDone={(user) => { setMe(user); setRole(loginFor || role); setLoginFor(null); toast(`Bem-vindo, ${user.name.split(" ")[0]}!`); }}
          onCancel={() => goRole("cliente")}
        />
      ) : (
        <>
          {role === "cliente" && <ClientApp store={store} now={now} goRole={goRole} />}
          {role === "admin" && <AdminApp store={store} now={now} />}
          {role === "cozinha" && <KitchenApp store={store} now={now} />}
          {role === "expedicao" && <ExpeditionApp store={store} now={now} goRole={goRole} />}
          {role === "entregador" && <DriverApp store={store} now={now} />}
          {role === "paineltv" && <TVPanelApp store={store} now={now} goRole={goRole} />}
        </>
      )}

      <Toast msg={toastMsg} />
      <Confetti on={confetti} />
    </div>
  );
}
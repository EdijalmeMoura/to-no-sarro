import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

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
  .sarro-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .sarro-imgzoom { overflow: hidden; }
  .sarro-imgzoom img { width: 100%; height: 100%; object-fit: cover; display: block; }
  * { box-sizing: border-box; }
  body { margin: 0; }
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
      className="fixed left-1/2 z-50 px-4 py-3 rounded-xl font-bold flex items-center gap-2"
      style={{
        bottom: 96, transform: "translateX(-50%)", background: C.white, color: C.black,
        fontSize: 13, boxShadow: "0 12px 40px rgba(0,0,0,.6)", maxWidth: "88vw",
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

// ============================================================
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
        className="absolute pointer-events-none"
        style={{ left: "-14%", top: "13%", width: "68%", height: 3, background: `linear-gradient(90deg, transparent, ${C.orange}aa, transparent)`, transform: "rotate(-8deg)" }}
      />
      <div
        className="absolute pointer-events-none"
        style={{ left: "-10%", top: "21%", width: "52%", height: 2, background: `linear-gradient(90deg, transparent, ${C.yellow}77, transparent)`, transform: "rotate(-8deg)" }}
      />

      <div className="relative px-5 pt-5 pb-7">
        <div className="flex items-center justify-between mb-5 gap-2">
          <Logo size={54} glow />
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full shrink-0"
            style={{ background: C.gray850, border: `1px solid ${store.open ? C.green : C.red}55` }}
          >
            <span
              style={{ width: 8, height: 8, borderRadius: 99, background: store.open ? C.green : C.red, display: "inline-block", animation: "sarropulse 1.8s infinite" }}
            />
            <span style={{ fontSize: 11, fontWeight: 800, color: store.open ? C.green : C.red }}>
              {store.open ? "Aberto agora" : "Fechado · voltamos 18h"}
            </span>
          </div>
        </div>

        <div style={{ fontFamily: font.display, fontStyle: "italic", letterSpacing: "-0.03em" }}>
          <div style={{ fontSize: 38, lineHeight: 0.94, color: C.white }}>BATEU A FOME?</div>
          <div style={{ fontSize: 43, lineHeight: 1, color: C.orange, textShadow: `3px 3px 0 ${C.black}, 0 0 36px ${C.orange}55` }}>
            ENTÃO TÁ NO SARRO! 🔥
          </div>
        </div>

        <p style={{ color: "#bdbdbd", fontSize: 13, marginTop: 12, maxWidth: 430, lineHeight: 1.55 }}>
          Burger artesanal na chapa e açaí batido na hora, saindo do Janga direto
          pra sua casa. {store.open ? "Entrega em 35–45 min." : "Voltamos às 18h."}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mt-5">
          <Btn onClick={onOrder} style={{ paddingLeft: 28, paddingRight: 28, boxShadow: `0 10px 32px ${C.orange}45` }}>
            PEDIR AGORA
          </Btn>
          <div className="flex items-center gap-2 flex-wrap" style={{ color: "#8a8a8a", fontSize: 11 }}>
            <span>⭐ 4,9</span><span>•</span><span>🛵 {brl(store.fee)}</span><span>•</span><span>⏱ 35–45min</span>
          </div>
        </div>

        {/* foto hero: apetite vende pedido */}
        <div
          className="sarro-imgzoom rounded-2xl overflow-hidden mt-6"
          style={{
            height: 220,
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
      className="p-3 flex gap-3 items-center"
      style={{ opacity: p.available ? 1 : 0.45, cursor: p.available ? "pointer" : "not-allowed" }}
    >
      <div
        className="shrink-0 rounded-xl overflow-hidden sarro-imgzoom"
        style={{ width: 88, height: 88, border: `1px solid ${p.promo ? `${C.orange}70` : C.gray800}` }}
      >
        <SmartImg id={p.id} emoji={p.emoji} alt={p.name} fs={36} file={p.img} v={p.updatedAt} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          {p.badges.includes("maisvendido") && <Badge color={C.yellow}>MAIS VENDIDO</Badge>}
          {p.badges.includes("novidade") && <Badge color={C.white}>NOVIDADE</Badge>}
          {p.badges.includes("promocao") && <Badge color={C.red} text={C.white}>PROMO</Badge>}
        </div>
        <div style={{ fontWeight: 800, color: C.white, fontSize: 15 }}>{p.name}</div>
        <div style={{ color: "#9a9a9a", fontSize: 11.5, lineHeight: 1.35, marginTop: 2 }} className="line-clamp-2">
          {p.desc}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 15 }}>{brl(price)}</span>
          {p.promo && <span style={{ color: "#6e6e6e", fontSize: 11, textDecoration: "line-through" }}>{brl(p.price)}</span>}
          <span style={{ color: "#6e6e6e", fontSize: 10 }}>• {p.time} min</span>
        </div>
      </div>
      <button
        className="shrink-0 rounded-xl flex items-center justify-center font-black active:scale-90 transition"
        style={{ width: 40, height: 40, background: C.orange, color: C.black, fontSize: 22, lineHeight: 1 }}
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
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,.78)" }}>
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto"
        style={{ background: C.gray900, borderTop: `3px solid ${C.orange}`, borderRadius: "22px 22px 0 0" }}
      >
        <div className="relative sarro-imgzoom" style={{ height: 172, background: `linear-gradient(135deg, ${C.orange}33, ${C.black})` }}>
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

        <div className="p-5">
          <h3 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 26, color: C.white, letterSpacing: "-0.02em" }}>
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
              <div className="flex items-center justify-between mb-2">
                <span style={{ color: C.yellowLight, fontWeight: 800, fontSize: 13 }}>{g.name}</span>
                <span style={{ color: "#777", fontSize: 10.5 }}>
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

        <div className="sticky bottom-0 p-4 flex items-center gap-3" style={{ background: C.black, borderTop: `1px solid ${C.gray800}` }}>
          <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
            <button onClick={() => setQty(Math.max(1, qty - 1))} style={{ color: C.orange, fontSize: 20, fontWeight: 900 }}>−</button>
            <span style={{ color: C.white, fontWeight: 900, minWidth: 18, textAlign: "center" }}>{qty}</span>
            <button onClick={() => setQty(qty + 1)} style={{ color: C.orange, fontSize: 20, fontWeight: 900 }}>+</button>
          </div>
          <Btn full onClick={add} disabled={missing.length > 0}>
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

// ============================================================
// CARRINHO
// ============================================================

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
        <Btn full onClick={() => goCheckout({ subtotal, fee, discount, total })} disabled={!store.open}>
          {store.open ? "FINALIZAR PEDIDO" : "LOJA FECHADA — VOLTAMOS ÀS 18H"}
        </Btn>
      </div>
    </div>
  );
}

// ============================================================
// CHECKOUT
// ============================================================

// Declarados fora do Checkout: se ficassem dentro, o React remontaria os
// inputs a cada tick do relógio e o campo perderia o foco a cada tecla.
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

// ============================================================
// ACOMPANHAMENTO
// ============================================================

const TRACK_STEPS = [
  { key: "NOVO", label: "Pedido recebido", icon: "✓" },
  { key: "CONFIRMADO", label: "Pagamento confirmado", icon: "✓" },
  { key: "PREPARO", label: "Na chapa agora", icon: "🔥" },
  { key: "PRONTO", label: "Pedido pronto", icon: "🍔" },
  { key: "EMBALADO", label: "Embalado", icon: "📦" },
  { key: "ROTA", label: "Saiu para entrega", icon: "🛵" },
  { key: "ENTREGUE", label: "Entregue", icon: "✓" },
];

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
// ============================================================
// CLIENTE — SHELL (bottom nav, conta, fidelidade)
// ============================================================

function AccountScreen({ store }) {
  const me = store.customers[0];
  if (!me) {
    return (
      <div className="px-4 py-16 text-center">
        <div style={{ fontSize: 52 }}>😎</div>
        <div style={{ color: C.white, fontWeight: 900, fontSize: 16, marginTop: 10 }}>Sua conta aparece aqui</div>
        <p style={{ color: "#8a8a8a", fontSize: 13, marginTop: 6 }}>Faça seu primeiro pedido para entrar no Clube do Sarro.</p>
      </div>
    );
  }
  const pct = Math.min(100, me.points);
  const mine = store.orders.filter((o) => o.customer.name === me.name);
  return (
    <div className="px-4 py-5 pb-6">
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
      className="fixed bottom-0 left-0 right-0 z-30 flex"
      style={{ background: "rgba(5,5,5,.96)", borderTop: `1px solid ${C.gray800}`, backdropFilter: "blur(10px)" }}
    >
      {items.map((i) => {
        const on = tab === i.id;
        return (
          <button key={i.id} onClick={() => setTab(i.id)} className="flex-1 flex flex-col items-center gap-0.5 py-2.5 relative">
            <span style={{ fontSize: 18, filter: on ? "none" : "grayscale(1) opacity(.55)" }}>{i.icon}</span>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: on ? C.orange : "#6a6a6a" }}>{i.label}</span>
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
  );
}

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

function AdminDashboard({ store, now }) {
  const today = store.orders.filter((o) => o.status !== "CANCELADO");
  const revenue = today.reduce((s, o) => s + o.total, 0);
  const avg = today.length ? revenue / today.length : 0;
  const counts = (st) => store.orders.filter((o) => o.status === st).length;

  const byChannel = Object.keys(CHANNELS).map((k) => ({
    label: CHANNELS[k].label, color: CHANNELS[k].color,
    v: store.orders.filter((o) => o.channel === k).length || 0.001,
  }));

  const sold = {};
  store.orders.forEach((o) => o.items.forEach((i) => { sold[i.name] = (sold[i.name] || 0) + i.qty; }));
  const top = Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const live = [
    { label: "Aguardando", v: counts("NOVO"), color: C.yellowLight },
    { label: "Na cozinha", v: counts("CONFIRMADO") + counts("PREPARO"), color: C.orange },
    { label: "Prontos", v: counts("PRONTO") + counts("EMBALADO"), color: C.green },
    { label: "Aguardando entregador", v: counts("AGUARDANDO"), color: C.blue },
    { label: "Em entrega", v: counts("ROTA"), color: "#7C5CFF" },
  ];

  return (
    <div className="space-y-5">
      <Card className="p-4" style={{ borderColor: `${C.orange}55`, background: `linear-gradient(120deg, ${C.orange}14, ${C.gray850})` }}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ width: 8, height: 8, borderRadius: 99, background: C.green, display: "inline-block", animation: "sarropulse 1.6s infinite" }} />
          <span style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Operação agora</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {live.map((l) => (
            <div key={l.label} className="rounded-xl p-3" style={{ background: C.black, border: `1px solid ${l.color}33` }}>
              <div style={{ color: l.color, fontWeight: 900, fontSize: 25 }}>{String(l.v).padStart(2, "0")}</div>
              <div style={{ color: "#8a8a8a", fontSize: 10.5, marginTop: 2 }}>{l.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KPI icon="💰" label="Vendas hoje" value={brl(revenue)} sub="+18%" accent={C.yellowLight} />
        <KPI icon="🍔" label="Pedidos hoje" value={today.length} sub="+6%" />
        <KPI icon="📦" label="Ticket médio" value={brl(avg)} />
        <KPI icon="👥" label="Clientes na base" value={store.customers.length} />
        <KPI icon="🛵" label="Entregas em rota" value={counts("ROTA")} />
        <KPI icon="⏱" label="Tempo médio de preparo" value="18 min" />
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Vendas por hora</div>
          <BarChart data={SALES_BY_HOUR} xKey="h" vKey="v" />
        </Card>
        <Card className="p-4">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Vendas na semana</div>
          <BarChart data={SALES_BY_DAY} xKey="d" vKey="v" />
        </Card>
        <Card className="p-4">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Pedidos por canal</div>
          <Donut slices={byChannel} />
        </Card>
        <Card className="p-4">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Produtos mais vendidos</div>
          <div className="space-y-2.5">
            {top.map(([name, qty], i) => (
              <div key={name}>
                <div className="flex justify-between" style={{ fontSize: 12 }}>
                  <span style={{ color: "#d0d0d0" }}>{name}</span>
                  <span style={{ color: C.yellowLight, fontWeight: 800 }}>{qty}</span>
                </div>
                <div style={{ height: 6, background: C.gray800, borderRadius: 9, marginTop: 4 }}>
                  <div style={{ width: `${(qty / top[0][1]) * 100}%`, height: "100%", borderRadius: 9, background: `linear-gradient(90deg, ${C.orange}, ${C.yellow})` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
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

function AdminOrders({ store, now }) {
  const [view, setView] = useState("kanban");
  const [filter, setFilter] = useState("TODOS");

  const list = store.orders.filter((o) => filter === "TODOS" || o.channel === filter);

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
            onClick={() => setFilter(k)}
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
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map((o) => <OrderCard key={o.id} o={o} store={store} now={now} />)}
        </div>
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
  const [form, setForm] = useState(null); // null | "new" | produto
  const [confirmDel, setConfirmDel] = useState(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div style={{ color: "#8a8a8a", fontSize: 12 }}>{store.products.length} produtos cadastrados</div>
        <Btn small onClick={() => setForm("new")}>+ Novo produto</Btn>
      </div>

      {confirmDel && (
        <Card className="p-4 mb-4" style={{ borderColor: `${C.red}66`, background: `${C.red}12` }}>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>
            Excluir “{confirmDel.name}”?
          </div>
          <div style={{ color: "#9a9a9a", fontSize: 12, marginTop: 2 }}>
            Se ele já entrou em algum pedido, recomendamos apenas despublicar.
          </div>
          <div className="flex gap-2 mt-3">
            <Btn small variant="danger" onClick={() => { store.deleteProduct(confirmDel.id); setConfirmDel(null); }}>
              Excluir de vez
            </Btn>
            <Btn small variant="dark" onClick={() => setConfirmDel(null)}>Cancelar</Btn>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {store.products.map((p) => (
          <Card key={p.id} className="p-3" style={{ opacity: p.available ? 1 : 0.55 }}>
            <div className="flex gap-3">
              <div className="rounded-xl overflow-hidden shrink-0" style={{ width: 56, height: 56, border: `1px solid ${C.gray800}` }}>
                <SmartImg id={p.id} emoji={p.emoji} alt={p.name} fs={26} file={p.img} v={p.updatedAt} />
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ color: C.white, fontWeight: 800, fontSize: 13.5 }}>
                  {p.name} {p.builder && <span style={{ color: C.orange, fontSize: 11 }}>🛠️</span>}
                </div>
                <div style={{ color: "#7a7a7a", fontSize: 11 }}>
                  {store.categories.find((c) => c.id === p.cat)?.label} · {p.time} min · estoque {p.stock}
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 13.5, marginTop: 2 }}>
                    {brl(p.promo || p.price)}
                  </span>
                  {p.promo && <span style={{ color: "#6e6e6e", fontSize: 10.5, textDecoration: "line-through" }}>{brl(p.price)}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${C.gray800}` }}>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setForm(p)} className="rounded-lg px-2 py-1 font-bold"
                  style={{ background: C.gray800, color: C.white, fontSize: 11 }}>✎ Editar</button>
                <button onClick={() => setConfirmDel(p)} className="rounded-lg px-2 py-1 font-bold"
                  style={{ background: "transparent", border: `1px solid ${C.red}55`, color: C.red, fontSize: 11 }}>🗑</button>
              </div>
              <button
                onClick={() => store.updateProduct(p.id, { available: !p.available })}
                className="rounded-full"
                style={{ width: 42, height: 23, background: p.available ? C.green : C.gray700, position: "relative", transition: "background .2s" }}
              >
                <span
                  style={{
                    position: "absolute", top: 3, left: p.available ? 22 : 3, width: 17, height: 17,
                    borderRadius: 99, background: C.white, transition: "left .2s",
                  }}
                />
              </button>
            </div>
          </Card>
        ))}
      </div>

      {form && (
        <ProductForm
          key={form === "new" ? "new" : form.id}
          initial={form === "new" ? null : form}
          store={store}
          onClose={() => setForm(null)}
        />
      )}
    </div>
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
  const tierColor = { VIP: C.yellowLight, Recorrente: C.green, Novo: C.blue, Inativo: "#7a7a7a" };
  return (
    <Card className="p-1">
      <Table
        cols={["Cliente", "WhatsApp", "Pedidos", "Gasto", "Ticket médio", "Último", "Classificação"]}
        rows={store.customers.map((c) => [
          c.name, c.phone, c.orders, brl(c.spent), brl(c.spent / c.orders), c.last,
          <span key="t" style={{ color: tierColor[c.tier], fontWeight: 800, fontSize: 11.5 }}>{c.tier.toUpperCase()}</span>,
        ])}
      />
    </Card>
  );
}

function AdminInventory({ store }) {
  const low = store.inventory.filter((i) => i.qty <= i.min);
  return (
    <div>
      {low.length > 0 && (
        <Card className="p-4 mb-4" style={{ borderColor: `${C.red}66`, background: `${C.red}12` }}>
          <div style={{ color: C.red, fontWeight: 900, fontSize: 13 }}>⚠️ Estoque baixo em {low.length} itens</div>
          <div style={{ color: "#c9c9c9", fontSize: 12, marginTop: 4 }}>{low.map((i) => i.name).join(" · ")}</div>
        </Card>
      )}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {store.inventory.map((i) => {
          const pct = Math.min(100, (i.qty / (i.min * 2.5)) * 100);
          const bad = i.qty <= i.min;
          return (
            <Card key={i.id} className="p-3">
              <div className="flex justify-between items-baseline">
                <span style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>{i.name}</span>
                <span style={{ color: bad ? C.red : C.yellowLight, fontWeight: 900, fontSize: 13 }}>{i.qty} {i.unit}</span>
              </div>
              <div style={{ height: 6, background: C.gray800, borderRadius: 9, marginTop: 8 }}>
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 9, background: bad ? C.red : C.green }} />
              </div>
              <div className="flex items-center justify-between mt-2.5">
                <span style={{ color: "#7a7a7a", fontSize: 10.5 }}>mínimo {i.min} {i.unit}</span>
                <div className="flex gap-1.5">
                  <Btn small variant="dark" onClick={() => store.moveStock(i.id, -1)}>−1</Btn>
                  <Btn small variant="dark" onClick={() => store.moveStock(i.id, 10)}>+10</Btn>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// FINANCEIRO — visão de caixa com dados reais dos pedidos
// ============================================================

const RANGES = [
  ["hoje", "Hoje"],
  ["7", "7 dias"],
  ["30", "30 dias"],
  ["tudo", "Tudo"],
];

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
  const [range, setRange] = useState("hoje");
  const from = rangeStart(range, now);

  const valid = store.orders.filter((o) => o.createdAt >= from && o.status !== "CANCELADO");
  const canceled = store.orders.filter((o) => o.createdAt >= from && o.status === "CANCELADO");
  const revenue = valid.reduce((s, o) => s + o.total, 0);
  const discounts = valid.reduce((s, o) => s + o.discount, 0);
  const fees = valid.reduce((s, o) => s + o.fee, 0);
  const ticket = valid.length ? revenue / valid.length : 0;
  const canceledValue = canceled.reduce((s, o) => s + o.total, 0);

  const byDay = {};
  valid.forEach((o) => {
    const k = new Date(o.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    byDay[k] = (byDay[k] || 0) + o.total;
  });
  const dayData = Object.entries(byDay)
    .sort((a, b) => (a[0].split("/").reverse().join("") > b[0].split("/").reverse().join("") ? 1 : -1))
    .slice(-14)
    .map(([d, v]) => ({ d, v: Math.round(v) }));

  const groupSum = (keyFn) => {
    const m = new Map();
    valid.forEach((o) => {
      const k = keyFn(o);
      m.set(k, (m.get(k) || 0) + o.total);
    });
    const total = [...m.values()].reduce((s, v) => s + v, 0) || 1;
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v, pct: Math.round((v / total) * 100) }));
  };
  const payments = groupSum((o) => o.payment.replace(/\s*\(.*\)/, ""));
  const channels = groupSum((o) => CHANNELS[o.channel]?.label || o.channel);
  const types = groupSum((o) => (o.type === "pickup" ? "Retirada" : "Delivery"));

  const exportCSV = () => {
    downloadCSV(`financeiro-sarro-${range}.csv`, [
      ["TÔ NO SARRO! — Financeiro"],
      ["Período", RANGES.find((r) => r[0] === range)?.[1] || range],
      [],
      ["Indicador", "Valor"],
      ["Faturamento", revenue.toFixed(2)],
      ["Pedidos válidos", valid.length],
      ["Ticket médio", ticket.toFixed(2)],
      ["Descontos concedidos", discounts.toFixed(2)],
      ["Taxas de entrega", fees.toFixed(2)],
      ["Cancelados", `${canceled.length} (${canceledValue.toFixed(2)})`],
      [],
      ["Dia", "Faturamento"],
      ...dayData.map((d) => [d.d, d.v.toFixed(2)]),
      [],
      ["Forma de pagamento", "Total", "%"],
      ...payments.map((p) => [p.k, p.v.toFixed(2), `${p.pct}%`]),
      [],
      ["Canal", "Total", "%"],
      ...channels.map((p) => [p.k, p.v.toFixed(2), `${p.pct}%`]),
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map(([id, lbl]) => (
          <Btn key={id} small variant={range === id ? "primary" : "dark"} onClick={() => setRange(id)}>{lbl}</Btn>
        ))}
        <div className="flex-1" />
        <Btn small variant="dark" onClick={exportCSV}>⬇ Exportar CSV/Excel</Btn>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KPI icon="💰" label={`Faturamento (${RANGES.find((r) => r[0] === range)?.[1]})`} value={brl(revenue)} accent={C.yellowLight} />
        <KPI icon="🧾" label="Pedidos válidos" value={valid.length} />
        <KPI icon="📦" label="Ticket médio" value={brl(ticket)} />
        <KPI icon="🎟" label="Descontos concedidos" value={brl(discounts)} accent={C.orange} />
        <KPI icon="🛵" label="Taxas de entrega" value={brl(fees)} />
        <KPI icon="❌" label={`Cancelados · ${brl(canceledValue)}`} value={canceled.length} accent={canceled.length ? C.red : C.white} />
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Faturamento por dia</div>
          {dayData.length ? <BarChart data={dayData} xKey="d" vKey="v" /> : <div style={{ color: "#6a6a6a", fontSize: 12 }}>Sem vendas no período.</div>}
        </Card>
        <Card className="p-4">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Formas de pagamento</div>
          {payments.length ? payments.map((p) => (
            <div key={p.k} className="mb-2.5">
              <div className="flex justify-between" style={{ fontSize: 12 }}>
                <span style={{ color: "#d0d0d0" }}>{p.k}</span>
                <span style={{ color: C.yellowLight, fontWeight: 800 }}>{brl(p.v)} · {p.pct}%</span>
              </div>
              <div style={{ height: 6, background: C.gray800, borderRadius: 9, marginTop: 4 }}>
                <div style={{ width: `${p.pct}%`, height: "100%", borderRadius: 9, background: `linear-gradient(90deg, ${C.orange}, ${C.yellow})` }} />
              </div>
            </div>
          )) : <div style={{ color: "#6a6a6a", fontSize: 12 }}>Sem dados.</div>}
        </Card>
        <Card className="p-4">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Por canal</div>
          {channels.length ? <Donut slices={channels.map((c, i) => ({ label: c.k, v: c.v, color: [C.orange, C.yellow, "#25D366", C.blue][i % 4] }))} size={130} /> : <div style={{ color: "#6a6a6a", fontSize: 12 }}>Sem dados.</div>}
        </Card>
        <Card className="p-4">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Delivery x Retirada</div>
          {types.length ? <Donut slices={types.map((t, i) => ({ label: t.k, v: t.v, color: i ? C.blue : C.orange }))} size={130} /> : <div style={{ color: "#6a6a6a", fontSize: 12 }}>Sem dados.</div>}
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// RELATÓRIOS — tabelas com exportação CSV e impressão A4
// ============================================================

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
  const [range, setRange] = useState("7");
  const from = rangeStart(range, now);
  const orders = store.orders.filter((o) => o.createdAt >= from);

  const dayMap = new Map();
  orders.forEach((o) => {
    const k = new Date(o.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const cur = dayMap.get(k) || { n: 0, total: 0 };
    cur.n += 1;
    if (o.status !== "CANCELADO") cur.total += o.total;
    dayMap.set(k, cur);
  });
  const salesRows = [...dayMap.entries()]
    .sort((a, b) => (a[0].split("/").reverse().join("") > b[0].split("/").reverse().join("") ? 1 : -1))
    .map(([d, v]) => [d, v.n, brl(v.total), brl(v.n ? v.total / v.n : 0)]);

  const prodMap = new Map();
  orders.filter((o) => o.status !== "CANCELADO").forEach((o) =>
    o.items.forEach((i) => {
      const cur = prodMap.get(i.name) || { qty: 0, total: 0 };
      cur.qty += i.qty;
      cur.total += i.unit * i.qty;
      prodMap.set(i.name, cur);
    })
  );
  const productRows = [...prodMap.entries()].sort((a, b) => b[1].qty - a[1].qty)
    .map(([name, v]) => [name, v.qty, brl(v.total)]);

  const paySet = [...new Set(orders.filter((o) => o.status !== "CANCELADO").map((o) => o.payment))];
  const payRows = paySet.map((pay) => {
    const list = orders.filter((o) => o.payment === pay && o.status !== "CANCELADO");
    return [pay, list.length, brl(list.reduce((s, o) => s + o.total, 0))];
  });
  const channelRows = Object.keys(CHANNELS).map((k) => {
    const list = orders.filter((o) => o.channel === k && o.status !== "CANCELADO");
    return [CHANNELS[k].label, list.length, brl(list.reduce((s, o) => s + o.total, 0))];
  });

  const driverRows = store.drivers.map((d) => {
    const done = orders.filter((o) => o.driverId === d.id && o.status === "ENTREGUE");
    return [d.name, d.vehicle, done.length, brl(done.reduce((s, o) => s + o.total, 0))];
  });

  const customerRows = store.customers.slice(0, 10).map((c) => [
    c.name, c.phone, c.orders, brl(c.spent), c.tier,
  ]);

  const canceledRows = orders.filter((o) => o.status === "CANCELADO")
    .map((o) => [`#${o.code}`, o.customer.name, brl(o.total), fmtDT(o.createdAt), CHANNELS[o.channel]?.short || o.channel]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span style={{ color: "#8a8a8a", fontSize: 12 }}>Período:</span>
        {RANGES.map(([id, lbl]) => (
          <Btn key={id} small variant={range === id ? "primary" : "dark"} onClick={() => setRange(id)}>{lbl}</Btn>
        ))}
      </div>

      <ReportCard title="Vendas por dia" cols={["Dia", "Pedidos", "Faturamento", "Ticket médio"]} rows={salesRows} csvName="sarro-vendas.csv" />
      <ReportCard title="Produtos vendidos" cols={["Produto", "Qtd", "Receita"]} rows={productRows} csvName="sarro-produtos.csv" />
      <div className="grid lg:grid-cols-2 gap-3">
        <ReportCard title="Formas de pagamento" cols={["Pagamento", "Pedidos", "Total"]} rows={payRows} csvName="sarro-pagamentos.csv" />
        <ReportCard title="Canais de venda" cols={["Canal", "Pedidos", "Total"]} rows={channelRows} csvName="sarro-canais.csv" />
        <ReportCard title="Entregadores" cols={["Entregador", "Veículo", "Entregas", "Valor entregue"]} rows={driverRows} csvName="sarro-entregadores.csv" />
        <ReportCard title="Top clientes" cols={["Cliente", "WhatsApp", "Pedidos", "Gasto", "Classe"]} rows={customerRows} csvName="sarro-clientes.csv" />
      </div>
      <ReportCard title="Cancelamentos" cols={["Pedido", "Cliente", "Valor", "Quando", "Canal"]} rows={canceledRows} csvName="sarro-cancelamentos.csv" />
    </div>
  );
}

// Interruptor pequeno de ativar/pausar (cupons, promos, usuários)
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
  const [couponForm, setCouponForm] = useState(null); // null | "new" | cupom
  const [promoForm, setPromoForm] = useState(null); // null | "new" | promo
  const [confirmDel, setConfirmDel] = useState(null); // { kind: "coupon"|"promo", ref }
  const say = (m) => store.toast(m);

  const toggleCoupon = (c) =>
    api(`/api/coupons/${c.code}`, { method: "PATCH", body: { active: !c.active } })
      .then(() => say(c.active ? `Cupom ${c.code} pausado` : `Cupom ${c.code} ativado ✓`))
      .catch((e) => say(e.message));

  const togglePromo = (p) =>
    api(`/api/promos/${p.id}`, { method: "PATCH", body: { active: !p.active } })
      .then(() => say(p.active ? `“${p.name}” pausada` : `“${p.name}” ativada ✓`))
      .catch((e) => say(e.message));

  const doDelete = async () => {
    try {
      if (confirmDel.kind === "coupon") await api(`/api/coupons/${confirmDel.ref.code}`, { method: "DELETE" });
      else await api(`/api/promos/${confirmDel.ref.id}`, { method: "DELETE" });
      say("Excluído");
    } catch (e) {
      say(e.message);
    }
    setConfirmDel(null);
  };

  return (
    <div className="space-y-5">
      {confirmDel && (
        <Card className="p-4" style={{ borderColor: `${C.red}66`, background: `${C.red}12` }}>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>
            Excluir {confirmDel.kind === "coupon" ? `o cupom ${confirmDel.ref.code}` : `a promoção “${confirmDel.ref.name}”`}?
          </div>
          <div className="flex gap-2 mt-3">
            <Btn small variant="danger" onClick={doDelete}>Excluir de vez</Btn>
            <Btn small variant="dark" onClick={() => setConfirmDel(null)}>Cancelar</Btn>
          </div>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Cupons de desconto</div>
          <Btn small onClick={() => setCouponForm("new")}>+ Novo cupom</Btn>
        </div>
        <Card className="p-1">
          <Table
            cols={["Cupom", "Desconto", "Mínimo", "Usos", "Status", ""]}
            rows={store.coupons.map((c) => [
              <span key="c">
                <span style={{ fontWeight: 800 }}>{c.code}</span>
                {c.note && <span className="block" style={{ color: "#7a7a7a", fontSize: 10.5, fontWeight: 400 }}>{c.note}</span>}
              </span>,
              couponLabel(c),
              brl(c.min),
              `${c.uses}/${c.limit || "∞"}`,
              <span key="s" className="flex items-center gap-2">
                <MiniToggle on={c.active} onClick={() => toggleCoupon(c)} />
                <span style={{ color: c.active ? C.green : "#7a7a7a", fontSize: 10.5, fontWeight: 800 }}>
                  {c.active ? "ATIVO" : "PAUSADO"}
                </span>
              </span>,
              <span key="a" className="flex items-center gap-1.5">
                <button onClick={() => setCouponForm(c)} className="rounded-lg px-2 py-1 font-bold"
                  style={{ background: C.gray800, color: C.white, fontSize: 11 }}>✎</button>
                <button onClick={() => setConfirmDel({ kind: "coupon", ref: c })} className="rounded-lg px-2 py-1 font-bold"
                  style={{ background: "transparent", border: `1px solid ${C.red}55`, color: C.red, fontSize: 11 }}>🗑</button>
              </span>,
            ])}
          />
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Promoções programadas</div>
          <Btn small onClick={() => setPromoForm("new")}>+ Nova promoção</Btn>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {store.promos.map((p) => { const st = promoStatus(p, now); return (
            <Card key={p.id} className="p-4" style={{ opacity: p.active ? 1 : 0.6 }}>
              <div className="flex justify-between items-start gap-2">
                <span style={{ color: C.white, fontWeight: 800, fontSize: 13.5 }}>{p.name}</span>
                <MiniToggle on={p.active} onClick={() => togglePromo(p)} />
              </div>
              <div style={{ color: "#9a9a9a", fontSize: 12, marginTop: 6, minHeight: 18 }}>{p.rule}</div>
              <div style={{ color: C.yellowLight, fontSize: 11, marginTop: 8, fontWeight: 700 }}>
                ⏰ {p.startsAt || p.endsAt
                  ? `${p.startsAt ? fmtShort(p.startsAt) : "…"} → ${p.endsAt ? fmtShort(p.endsAt) : "…"}`
                  : (p.window || "sempre")}
              </div>
              {p.window && (p.startsAt || p.endsAt) && (
                <div style={{ color: "#7a7a7a", fontSize: 10.5, marginTop: 2 }}>{p.window}</div>
              )}
              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${C.gray800}` }}>
                <span className="rounded-md px-2 py-0.5 font-bold" style={{ background: `${st.color}1f`, color: st.color, fontSize: 10.5 }}>
                  {st.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <button onClick={() => setPromoForm(p)} className="rounded-lg px-2 py-1 font-bold"
                    style={{ background: C.gray800, color: C.white, fontSize: 11 }}>✎ Editar</button>
                  <button onClick={() => setConfirmDel({ kind: "promo", ref: p })} className="rounded-lg px-2 py-1 font-bold"
                    style={{ background: "transparent", border: `1px solid ${C.red}55`, color: C.red, fontSize: 11 }}>🗑</button>
                </span>
              </div>
            </Card>
          ); })}
          {store.promos.length === 0 && (
            <Card className="p-6 text-center"><span style={{ color: "#8a8a8a", fontSize: 13 }}>Nenhuma promoção. Crie a primeira acima ↑</span></Card>
          )}
        </div>
      </div>

      {couponForm && (
        <CouponForm
          key={couponForm === "new" ? "new" : couponForm.code}
          initial={couponForm === "new" ? null : couponForm}
          onClose={() => setCouponForm(null)}
          onSaved={(m) => { setCouponForm(null); say(m); }}
        />
      )}
      {promoForm && (
        <PromoForm
          key={promoForm === "new" ? "new" : promoForm.id}
          initial={promoForm === "new" ? null : promoForm}
          onClose={() => setPromoForm(null)}
          onSaved={(m) => { setPromoForm(null); say(m); }}
        />
      )}
    </div>
  );
}

const ROLE_LABELS = {
  ADMIN: "Administrador", GERENTE: "Gerente", ATENDIMENTO: "Atendimento",
  COZINHA: "Cozinha", EXPEDICAO: "Expedição", ENTREGADOR: "Entregador",
};

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
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(Object.keys(ROLE_LABELS));
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null | "new" | usuário
  const [confirmDel, setConfirmDel] = useState(null);
  const say = (m) => store.toast(m);
  const isAdmin = store.me?.role === "ADMIN";

  const load = () => {
    setLoading(true);
    api("/api/users")
      .then((d) => { setUsers(d.users); setRoles(d.roles?.length ? d.roles : Object.keys(ROLE_LABELS)); })
      .catch((e) => say(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const toggle = (u) =>
    api(`/api/users/${u.id}`, { method: "PATCH", body: { active: !u.active } })
      .then(() => { say(u.active ? `“${u.name}” desativado` : `“${u.name}” ativado ✓`); load(); })
      .catch((e) => say(e.message));

  const doDelete = async () => {
    try {
      await api(`/api/users/${confirmDel.id}`, { method: "DELETE" });
      say(`“${confirmDel.name}” excluído`);
      load();
    } catch (e) {
      say(e.message);
    }
    setConfirmDel(null);
  };

  const driverName = (id) => store.drivers.find((d) => d.id === id)?.name || "—";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div style={{ color: "#8a8a8a", fontSize: 12 }}>
          {loading ? "Carregando equipe…" : `${users.length} contas · ${users.filter((u) => u.active).length} ativas`}
        </div>
        <Btn small onClick={() => setForm("new")}>+ Novo usuário</Btn>
      </div>

      {confirmDel && (
        <Card className="p-4 mb-4" style={{ borderColor: `${C.red}66`, background: `${C.red}12` }}>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>Excluir “{confirmDel.name}” ({confirmDel.username})?</div>
          <div style={{ color: "#9a9a9a", fontSize: 12, marginTop: 2 }}>O login para de funcionar na hora. Prefira desativar.</div>
          <div className="flex gap-2 mt-3">
            <Btn small variant="danger" onClick={doDelete}>Excluir de vez</Btn>
            <Btn small variant="dark" onClick={() => setConfirmDel(null)}>Cancelar</Btn>
          </div>
        </Card>
      )}

      <Card className="p-1">
        <Table
          cols={["Nome", "Usuário", "Perfil", "Vínculo", "Último acesso", "Status", ""]}
          rows={users.map((u) => {
            const self = u.id === store.me?.id;
            return [
              <span key="n" style={{ fontWeight: 700 }}>
                {u.name} {self && <span style={{ color: C.orange, fontSize: 10, fontWeight: 800 }}> · VOCÊ</span>}
              </span>,
              <span key="u" style={{ fontSize: 12 }}>{u.username}</span>,
              <span key="r" className="rounded-md px-2 py-0.5 font-bold"
                style={{
                  background: u.role === "ADMIN" ? `${C.orange}1f` : C.gray800,
                  color: u.role === "ADMIN" ? C.orange : "#c9c9c9", fontSize: 10.5,
                }}>
                {ROLE_LABELS[u.role] || u.role}
              </span>,
              <span key="d" style={{ fontSize: 12 }}>{u.role === "ENTREGADOR" ? `🛵 ${driverName(u.driverId)}` : "—"}</span>,
              <span key="l" style={{ fontSize: 11.5 }}>{lastSeen(u.lastLoginAt, now)}</span>,
              <span key="s" className="flex items-center gap-2">
                <span style={{ opacity: self ? 0.35 : 1, display: "inline-flex" }} title={self ? "Você não pode desativar a própria conta" : ""}>
                  <MiniToggle on={u.active} onClick={() => !self && toggle(u)} />
                </span>
                <span style={{ color: u.active ? C.green : "#7a7a7a", fontSize: 10.5, fontWeight: 800 }}>
                  {u.active ? "ATIVO" : "INATIVO"}
                </span>
              </span>,
              <span key="a" className="flex items-center gap-1.5">
                <button onClick={() => setForm(u)} className="rounded-lg px-2 py-1 font-bold"
                  style={{ background: C.gray800, color: C.white, fontSize: 11 }}>✎</button>
                {isAdmin && !self && (
                  <button onClick={() => setConfirmDel(u)} className="rounded-lg px-2 py-1 font-bold"
                    style={{ background: "transparent", border: `1px solid ${C.red}55`, color: C.red, fontSize: 11 }}>🗑</button>
                )}
              </span>,
            ];
          })}
        />
      </Card>
      <div style={{ color: "#6a6a6a", fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
        Desativar derruba o acesso na hora, sem apagar o histórico. Só o administrador exclui contas — e nunca a própria nem a do último administrador.
      </div>

      {form && (
        <UserForm
          key={form === "new" ? "new" : form.id}
          initial={form === "new" ? null : form}
          roles={roles}
          drivers={store.drivers}
          onClose={() => setForm(null)}
          onSaved={(m) => { setForm(null); say(m); load(); }}
        />
      )}
    </div>
  );
}

function AdminCategories({ store }) {
  const [cat, setCat] = useState({ label: "", icon: "" });
  const [grp, setGrp] = useState({ name: "", min: "0", max: "1", required: false });
  const [opt, setOpt] = useState({}); // { groupId: {name, price} }
  const [confirm, setConfirm] = useState(null); // {type, id}

  const say = (m) => store.toast(m);

  const addCategory = async () => {
    try {
      await api("/api/categories", { method: "POST", body: { label: cat.label, icon: cat.icon || "🍽" } });
      setCat({ label: "", icon: "" });
      say("Categoria criada ✓");
    } catch (e) { say(e.message); }
  };

  const addGroup = async () => {
    try {
      await api("/api/option-groups", { method: "POST", body: { name: grp.name, min: grp.min, max: grp.max, required: grp.required } });
      setGrp({ name: "", min: "0", max: "1", required: false });
      say("Grupo criado ✓ — agora adicione os itens");
    } catch (e) { say(e.message); }
  };

  const addOption = async (groupId) => {
    const o = opt[groupId] || {};
    try {
      await api(`/api/option-groups/${groupId}/options`, { method: "POST", body: { name: o.name, price: o.price || 0 } });
      setOpt({ ...opt, [groupId]: { name: "", price: "" } });
      say("Item adicionado ✓");
    } catch (e) { say(e.message); }
  };

  const patchGroup = async (g, patch) => {
    try { await api(`/api/option-groups/${g.id}`, { method: "PATCH", body: patch }); say("Grupo atualizado ✓"); }
    catch (e) { say(e.message); }
  };

  const doDelete = async () => {
    const c = confirm;
    setConfirm(null);
    try {
      if (c.type === "cat") await api(`/api/categories/${c.id}`, { method: "DELETE" });
      if (c.type === "grp") await api(`/api/option-groups/${c.id}`, { method: "DELETE" });
      if (c.type === "opt") await api(`/api/options/${c.id}`, { method: "DELETE" });
      say("Excluído ✓");
    } catch (e) { say(e.message); }
  };

  const inField = { background: C.black, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12 };
  const delBtn = (type, id, extra = null) => (
    confirm?.type === type && confirm?.id === id ? (
      <button onClick={doDelete} className="rounded-lg px-2 py-1 font-bold shrink-0"
        style={{ background: C.red, color: C.white, fontSize: 10.5 }}>confirmar?</button>
    ) : (
      <button onClick={() => setConfirm({ type, id })} className="rounded-lg px-2 py-1 font-bold shrink-0"
        style={{ border: `1px solid ${C.red}55`, color: C.red, fontSize: 10.5 }}>
        {extra || "🗑"}
      </button>
    )
  );

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      {/* CATEGORIAS */}
      <Card className="p-4 self-start">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>🗂 Categorias do cardápio</div>
        <div style={{ color: "#8a8a8a", fontSize: 11.5, marginTop: 4 }}>
          A ordem aqui é a ordem do menu do cliente.
        </div>
        <div className="mt-3 space-y-1.5">
          {store.categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-xl px-2.5 py-2" style={{ background: C.black, border: `1px solid ${C.gray800}` }}>
              <input defaultValue={c.icon} key={c.id + c.icon} style={{ ...inField, width: 44, textAlign: "center" }}
                className="rounded-lg px-2 py-1.5 outline-none"
                onBlur={(e) => e.target.value !== c.icon && api(`/api/categories/${c.id}`, { method: "PATCH", body: { icon: e.target.value } }).catch((x) => say(x.message))} />
              <input defaultValue={c.label} key={c.id + c.label} className="flex-1 rounded-lg px-2 py-1.5 outline-none" style={inField}
                onBlur={(e) => e.target.value !== c.label && api(`/api/categories/${c.id}`, { method: "PATCH", body: { label: e.target.value } }).catch((x) => say(x.message))} />
              <span style={{ color: "#5a5a5a", fontSize: 10.5, whiteSpace: "nowrap" }}>
                {store.products.filter((p) => p.cat === c.id).length} 🍔
              </span>
              {delBtn("cat", c.id)}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <input value={cat.icon} onChange={(e) => setCat({ ...cat, icon: e.target.value })} placeholder="🍔"
            style={{ ...inField, width: 44, textAlign: "center" }} className="rounded-lg px-2 py-1.5 outline-none" />
          <input value={cat.label} onChange={(e) => setCat({ ...cat, label: e.target.value })} placeholder="Nova categoria (ex.: Hot dogs)"
            className="flex-1 rounded-lg px-2 py-1.5 outline-none" style={inField}
            onKeyDown={(e) => e.key === "Enter" && cat.label.trim() && addCategory()} />
          <Btn small disabled={!cat.label.trim()} onClick={addCategory}>+ Criar</Btn>
        </div>
      </Card>

      {/* GRUPOS DE OPCIONAIS */}
      <Card className="p-4 self-start">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>➕ Grupos de opcionais</div>
        <div style={{ color: "#8a8a8a", fontSize: 11.5, marginTop: 4 }}>
          Vincule os grupos aos produtos no cardápio (editar produto → grupos).
        </div>
        <div className="mt-3 space-y-3">
          {store.optionGroups.map((g) => (
            <div key={g.id} className="rounded-xl p-3" style={{ background: C.black, border: `1px solid ${C.gray800}` }}>
              <div className="flex items-center gap-2">
                <span style={{ color: C.white, fontWeight: 800, fontSize: 13, flex: 1 }}>{g.name}</span>
                {delBtn("grp", g.id)}
              </div>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <button onClick={() => patchGroup(g, { required: !g.required })} className="rounded-lg px-2 py-1 font-bold"
                  style={{ background: g.required ? `${C.orange}22` : C.gray850, border: `1px solid ${g.required ? C.orange : C.gray800}`, color: g.required ? C.orange : "#9a9a9a", fontSize: 10.5 }}>
                  {g.required ? "obrigatório" : "opcional"}
                </button>
                {["min", "max"].map((k) => (
                  <label key={k} className="flex items-center gap-1" style={{ fontSize: 10.5, color: "#8a8a8a" }}>
                    {k}
                    <input type="number" defaultValue={g[k]} min={0} max={10}
                      onBlur={(e) => Number(e.target.value) !== g[k] && patchGroup(g, { [k]: e.target.value })}
                      className="rounded-lg px-1.5 py-1 outline-none" style={{ ...inField, width: 46 }} />
                  </label>
                ))}
              </div>
              <div className="mt-2 space-y-1">
                {g.options.map((o) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <input defaultValue={o.name} key={o.id + o.name} className="flex-1 rounded-lg px-2 py-1 outline-none" style={inField}
                      onBlur={(e) => e.target.value !== o.name && api(`/api/options/${o.id}`, { method: "PATCH", body: { name: e.target.value } }).catch((x) => say(x.message))} />
                    <input defaultValue={String(o.price).replace(".", ",")} key={o.id + o.price} inputMode="decimal"
                      className="rounded-lg px-2 py-1 outline-none text-right" style={{ ...inField, width: 78 }}
                      onBlur={(e) => {
                        const v = parseFloat(String(e.target.value).replace(",", "."));
                        if (Number.isFinite(v) && v !== o.price) api(`/api/options/${o.id}`, { method: "PATCH", body: { price: v } }).catch((x) => say(x.message));
                      }} />
                    {delBtn("opt", o.id)}
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <input value={opt[g.id]?.name || ""} onChange={(e) => setOpt({ ...opt, [g.id]: { ...opt[g.id], name: e.target.value } })}
                    placeholder="Novo item (ex.: Cheddar)" className="flex-1 rounded-lg px-2 py-1 outline-none"
                    style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12 }}
                    onKeyDown={(e) => e.key === "Enter" && opt[g.id]?.name?.trim() && addOption(g.id)} />
                  <input value={opt[g.id]?.price || ""} onChange={(e) => setOpt({ ...opt, [g.id]: { ...opt[g.id], price: e.target.value } })}
                    placeholder="R$" inputMode="decimal" className="rounded-lg px-2 py-1 outline-none text-right"
                    style={{ background: C.gray850, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12, width: 78 }} />
                  <Btn small variant="dark" disabled={!opt[g.id]?.name?.trim()} onClick={() => addOption(g.id)}>+</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.gray800}` }}>
          <div style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Novo grupo</div>
          <input value={grp.name} onChange={(e) => setGrp({ ...grp, name: e.target.value })} placeholder="Ex.: Escolha o molho"
            className="w-full rounded-lg px-2 py-1.5 outline-none" style={inField} />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {["min", "max"].map((k) => (
              <label key={k} className="flex items-center gap-1" style={{ fontSize: 10.5, color: "#8a8a8a" }}>
                {k}
                <input value={grp[k]} onChange={(e) => setGrp({ ...grp, [k]: e.target.value })} inputMode="numeric"
                  className="rounded-lg px-1.5 py-1 outline-none" style={{ ...inField, width: 46 }} />
              </label>
            ))}
            <button onClick={() => setGrp({ ...grp, required: !grp.required })} className="rounded-lg px-2 py-1 font-bold"
              style={{ background: grp.required ? `${C.orange}22` : C.gray850, border: `1px solid ${grp.required ? C.orange : C.gray800}`, color: grp.required ? C.orange : "#9a9a9a", fontSize: 10.5 }}>
              {grp.required ? "obrigatório" : "opcional"}
            </button>
            <Btn small disabled={!grp.name.trim()} onClick={addGroup}>+ Criar grupo</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}
function AdminIntegrations({ store }) {
  const [ov, setOv] = useState(null);
  const [wa, setWa] = useState({ phone_number_id: "", token: "", verify: "", template: "tonosarro_status" });
  const [iff, setIff] = useState({ client_id: "", secret: "", merchant_id: "" });
  const [testPhone, setTestPhone] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const load = () => api("/api/integrations/overview").then(setOv).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, []);

  const say = (m) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };
  const inField = { background: C.black, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12 };

  const saveWa = async (enabledDelta) => {
    setBusy("wa");
    try {
      const body = {
        wa_phone_number_id: wa.phone_number_id || undefined,
        wa_verify_token: wa.verify || undefined,
        wa_template: wa.template || undefined,
        wa_access_token: wa.token || undefined,
      };
      if (typeof enabledDelta === "boolean") body.whatsapp_enabled = enabledDelta;
      Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
      await api("/api/settings", { method: "PATCH", body });
      setWa({ phone_number_id: "", token: "", verify: "", template: wa.template });
      await load();
      say(enabledDelta === undefined ? "Credenciais do WhatsApp salvas ✓" : enabledDelta ? "WhatsApp ativado ✓" : "WhatsApp pausado");
    } catch (e) { say(e.message); }
    setBusy("");
  };

  const saveIfood = async (enabledDelta) => {
    setBusy("if");
    try {
      const body = {
        ifood_client_id: iff.client_id || undefined,
        ifood_merchant_id: iff.merchant_id || undefined,
        ifood_client_secret: iff.secret || undefined,
      };
      if (typeof enabledDelta === "boolean") body.ifood_enabled = enabledDelta;
      Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
      await api("/api/settings", { method: "PATCH", body });
      setIff({ client_id: "", secret: "", merchant_id: "" });
      await load();
      say(enabledDelta === undefined ? "Credenciais do iFood salvas ✓" : enabledDelta ? "iFood ativado — poller a cada 30s ✓" : "iFood pausado");
    } catch (e) { say(e.message); }
    setBusy("");
  };

  const testWa = async () => {
    setBusy("twa");
    try {
      await api("/api/integrations/whatsapp/test", { method: "POST", body: { phone: testPhone } });
      say("Mensagem disparada — veja o resultado na fila abaixo");
      await load();
    } catch (e) { say(e.message); await load(); }
    setBusy("");
  };

  const testIfood = async () => {
    setBusy("tif");
    try {
      await api("/api/integrations/ifood/test", { method: "POST" });
      say("Conexão com o iFood OK ✓");
      await load();
    } catch (e) { say(e.message); await load(); }
    setBusy("");
  };

  const w = ov?.whatsapp || {};
  const f = ov?.ifood || {};

  return (
    <div className="space-y-4">
      {msg && (
        <div className="rounded-xl px-3 py-2.5" style={{ background: `${C.orange}18`, color: C.orange, fontSize: 12.5, fontWeight: 700 }}>
          {msg}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-3">
        {/* WHATSAPP */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2" style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>
              <WaIcon size={16} color="#25D366" /> WhatsApp Cloud API
            </span>
            <span
              className="rounded-full px-2.5 py-1 font-bold"
              style={{
                fontSize: 10,
                background: w.configured ? `${C.green}1f` : `${C.yellow}1f`,
                color: w.configured ? C.green : C.yellow,
                border: `1px solid ${w.configured ? C.green : C.yellow}44`,
              }}
            >
              {w.configured ? (w.enabled ? "ATIVO" : "CONFIGURADO · PAUSADO") : "FALTA CREDENCIAL"}
            </span>
          </div>
          <p style={{ color: "#8a8a8a", fontSize: 11.5, marginTop: 6, lineHeight: 1.5 }}>
            Mensagens automáticas a cada status do pedido (recebido, pagamento, chapa, pronto, saiu, entregue).
            Requer um app no <span style={{ color: "#c0c0c0" }}>developers.facebook.com</span> com template aprovado
            ({w.template || "tonosarro_status"}, 1 parâmetro de corpo).
          </p>
          <div className="mt-3 space-y-2">
            <input value={wa.phone_number_id} onChange={(e) => setWa({ ...wa, phone_number_id: e.target.value })}
              placeholder={w.phoneId ? `Phone Number ID: ${w.phoneId}` : "Phone Number ID (ex.: 1234567890)"} className="w-full rounded-lg px-2.5 py-2 outline-none" style={inField} />
            <input value={wa.token} onChange={(e) => setWa({ ...wa, token: e.target.value })} type="password"
              placeholder={w.hasToken ? "Access Token •••• salvo (deixe vazio p/ manter)" : "Access Token permanente"} className="w-full rounded-lg px-2.5 py-2 outline-none" style={inField} />
            <input value={wa.verify} onChange={(e) => setWa({ ...wa, verify: e.target.value })} type="password"
              placeholder={w.hasVerify ? "Verify Token •••• salvo (deixe vazio p/ manter)" : "Verify Token (o que você cadastrar na Meta)"} className="w-full rounded-lg px-2.5 py-2 outline-none" style={inField} />
            <input value={wa.template} onChange={(e) => setWa({ ...wa, template: e.target.value })}
              placeholder="Nome do template" className="w-full rounded-lg px-2.5 py-2 outline-none" style={inField} />
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Btn small disabled={busy === "wa"} onClick={() => saveWa(undefined)}>Salvar credenciais</Btn>
            <Btn small variant={w.enabled ? "dark" : "green"} disabled={busy === "wa"} onClick={() => saveWa(!w.enabled)}>
              {w.enabled ? "⏸ Pausar" : "▶ Ativar"}
            </Btn>
          </div>
          {w.enabled && (
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.gray800}` }}>
              <div style={{ color: "#8a8a8a", fontSize: 11, marginBottom: 6 }}>Testar envio real:</div>
              <div className="flex gap-2">
                <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="(81) 99999-0000"
                  className="flex-1 rounded-lg px-2.5 py-2 outline-none" style={inField} />
                <Btn small disabled={busy === "twa" || !testPhone} onClick={testWa}>{busy === "twa" ? "…" : "Enviar teste"}</Btn>
              </div>
            </div>
          )}
        </Card>

        {/* IFOOD */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>🔴 iFood — API oficial</span>
            <span
              className="rounded-full px-2.5 py-1 font-bold"
              style={{
                fontSize: 10,
                background: f.configured ? `${C.green}1f` : `${C.yellow}1f`,
                color: f.configured ? C.green : C.yellow,
                border: `1px solid ${f.configured ? C.green : C.yellow}44`,
              }}
            >
              {f.configured ? (f.enabled ? "ATIVO · POLLING 30s" : "CONFIGURADO · PAUSADO") : "FALTA CREDENCIAL"}
            </span>
          </div>
          <p style={{ color: "#8a8a8a", fontSize: 11.5, marginTop: 6, lineHeight: 1.5 }}>
            Pedidos do iFood entram sozinhos na fila (evento PLC) e aparecem no Kanban, KDS e expedição.
            Confirmação/pronto/despacho aqui dentro são espelhados de volta no iFood.
            Credenciais do portal <span style={{ color: "#c0c0c0" }}>novopedido.ifood.com.br</span> (Integrações → API).
          </p>
          <div className="mt-3 space-y-2">
            <input value={iff.client_id} onChange={(e) => setIff({ ...iff, client_id: e.target.value })}
              placeholder={f.clientId ? `Client ID: ${f.clientId}` : "Client ID"} className="w-full rounded-lg px-2.5 py-2 outline-none" style={inField} />
            <input value={iff.secret} onChange={(e) => setIff({ ...iff, secret: e.target.value })} type="password"
              placeholder={f.configured ? "Client Secret •••• salvo (deixe vazio p/ manter)" : "Client Secret"} className="w-full rounded-lg px-2.5 py-2 outline-none" style={inField} />
            <input value={iff.merchant_id} onChange={(e) => setIff({ ...iff, merchant_id: e.target.value })}
              placeholder={f.merchantId ? `Merchant ID: ${f.merchantId}` : "Merchant ID (opcional)"} className="w-full rounded-lg px-2.5 py-2 outline-none" style={inField} />
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Btn small disabled={busy === "if"} onClick={() => saveIfood(undefined)}>Salvar credenciais</Btn>
            <Btn small variant={f.enabled ? "dark" : "green"} disabled={busy === "if"} onClick={() => saveIfood(!f.enabled)}>
              {f.enabled ? "⏸ Pausar" : "▶ Ativar polling"}
            </Btn>
            <Btn small variant="dark" disabled={busy === "tif"} onClick={testIfood}>{busy === "tif" ? "…" : "Testar conexão"}</Btn>
          </div>
        </Card>
      </div>

      {/* FILA DE MENSAGENS */}
      <Card className="p-4">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14, marginBottom: 4 }}>
          📤 Fila de mensagens — o que o cliente recebe
        </div>
        <div style={{ color: "#7a7a7a", fontSize: 11.5, marginBottom: 10 }}>
          Sem credenciais (ou sem internet) as mensagens ficam na fila; com a integração ativa, saem de verdade.
        </div>
        <div className="space-y-2">
          {(ov?.outbox || []).length === 0 && (
            <div style={{ color: "#6a6a6a", fontSize: 12 }}>Nenhuma mensagem ainda — mova um pedido pelo fluxo para ver.</div>
          )}
          {(ov?.outbox || []).map((m) => (
            <div key={m.id} className="rounded-xl p-3" style={{ background: C.black, border: `1px solid ${C.gray800}` }}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span style={{ color: "#9a9a9a", fontSize: 10.5 }}>
                  {m.to} {m.code ? `· pedido #${m.code}` : ""} · {new Date(m.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span
                  className="rounded-md px-1.5 py-0.5 font-bold"
                  style={{
                    fontSize: 9.5,
                    background: m.status === "enviada" ? `${C.green}1f` : m.status === "erro" ? `${C.red}1f` : `${C.yellow}1f`,
                    color: m.status === "enviada" ? C.green : m.status === "erro" ? C.red : C.yellow,
                  }}
                >
                  {m.status === "enviada" ? "✓ ENVIADA" : m.status === "erro" ? "ERRO" : "NA FILA"}
                </span>
              </div>
              <div style={{ color: "#d0d0d0", fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{m.body}</div>
              {m.error && <div style={{ color: C.red, fontSize: 10.5, marginTop: 4 }}>⚠ {m.error}</div>}
            </div>
          ))}
        </div>
      </Card>

      {/* DIÁRIO */}
      <Card className="p-4">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14, marginBottom: 8 }}>📜 Diário de integrações</div>
        {(ov?.logs || []).length === 0 && <div style={{ color: "#6a6a6a", fontSize: 12 }}>Sem eventos ainda.</div>}
        <div className="space-y-1">
          {(ov?.logs || []).map((l) => (
            <div key={l.id} className="flex items-start gap-2" style={{ fontSize: 11.5 }}>
              <span style={{ color: "#5a5a5a", whiteSpace: "nowrap" }}>{new Date(l.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              <span
                className="rounded px-1 font-bold"
                style={{
                  background: l.level === "ok" ? `${C.green}1a` : l.level === "erro" ? `${C.red}1a` : C.gray800,
                  color: l.level === "ok" ? C.green : l.level === "erro" ? C.red : "#9a9a9a",
                  fontSize: 9.5, whiteSpace: "nowrap",
                }}
              >
                {l.channel}
              </span>
              <span style={{ color: l.level === "erro" ? C.red : "#c0c0c0" }}>{l.msg}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
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
  const [handle, setHandle] = useState(store.settings.payHandle || "");
  const [base, setBase] = useState(store.settings.appBaseUrl || "");
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/api/settings/payments").then(setInfo).catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await api("/api/settings", { method: "PATCH", body: { pay_handle: handle, app_base_url: base } });
      setInfo(await api("/api/settings/payments"));
      store.toast("InfinitePay configurada ✓");
    } catch (e) {
      store.toast(e.message);
    }
    setBusy(false);
  };

  const copy = (t) => {
    navigator.clipboard?.writeText(t).then(
      () => store.toast("URL copiada ✓"),
      () => store.toast("Copie manualmente")
    );
  };

  const inField = { background: C.black, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12.5 };

  return (
    <Card className="p-4" style={{ borderColor: `${C.orange}44` }}>
      <div className="flex items-center justify-between">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>♾️ Pagamentos — InfinitePay</div>
        <span
          className="rounded-full px-2.5 py-1 font-bold"
          style={{
            fontSize: 10,
            background: store.settings.payHandle ? `${C.green}1f` : `${C.yellow}1f`,
            color: store.settings.payHandle ? C.green : C.yellow,
            border: `1px solid ${store.settings.payHandle ? C.green : C.yellow}44`,
          }}
        >
          {store.settings.payHandle ? "CONFIGURADO" : "FALTA CONFIGURAR"}
        </span>
      </div>
      <div style={{ color: "#8a8a8a", fontSize: 11.5, marginTop: 6, lineHeight: 1.5 }}>
        Pix e cartão (até 12x) no checkout seguro da InfinitePay. Confirmação automática por webhook.
      </div>

      <div className="mt-3 space-y-2.5">
        <label className="block">
          <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Sua InfiniteTag (handle, sem o $)</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="ex.: tonosarro"
            className="w-full rounded-lg px-2.5 py-2 mt-1 outline-none"
            style={inField}
          />
        </label>
        <label className="block">
          <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>URL pública do sistema (opcional)</span>
          <input
            value={base}
            onChange={(e) => setBase(e.target.value)}
            placeholder="ex.: https://pedidos.tonosarro.com.br"
            className="w-full rounded-lg px-2.5 py-2 mt-1 outline-none"
            style={inField}
          />
          <span style={{ color: "#6a6a6a", fontSize: 10 }}>
            Usada no webhook e no retorno do pagamento. Vazio = usa o endereço atual.
          </span>
        </label>

        {info?.webhookUrl && (
          <div>
            <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Webhook de confirmação</span>
            <div className="flex gap-2 mt-1">
              <code
                className="flex-1 rounded-lg px-2 py-2 truncate"
                style={{ background: C.black, border: `1px solid ${C.gray800}`, color: "#c0c0c0", fontSize: 10.5 }}
              >
                {info.webhookUrl}
              </code>
              <Btn small variant="dark" onClick={() => copy(info.webhookUrl)}>Copiar</Btn>
            </div>
            <span style={{ color: "#6a6a6a", fontSize: 10 }}>
              Já é enviado automaticamente a cada cobrança — guarde esta URL caso precise configurar algo manualmente.
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <Btn small disabled={busy} onClick={save}>{busy ? "SALVANDO…" : "Salvar"}</Btn>
        <Btn small variant="dark" onClick={() => store.toast("Teste: faça um pedido com Pix e aprove no app InfinitePay")}>
          Como testar?
        </Btn>
      </div>
    </Card>
  );
}

function AdminPrinterCard({ store }) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("9100");
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api("/api/settings/printer").then((d) => { setInfo(d); setHost(d.host || ""); setPort(d.port || "9100"); }).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async (extra = {}) => {
    setBusy(true);
    try {
      await api("/api/settings", { method: "PATCH", body: { printer_host: host, printer_port: port, ...extra } });
      await load();
      store.toast("Impressora salva ✓");
    } catch (e) { store.toast(e.message); }
    setBusy(false);
  };

  const test = async () => {
    setBusy(true);
    try {
      await api("/api/print/test", { method: "POST" });
      store.toast("Página de teste enviada ✓");
    } catch (e) { store.toast(e.message); }
    setBusy(false);
  };

  const enabled = info?.enabled;
  return (
    <Card className="p-4" style={{ borderColor: `${C.orange}44` }}>
      <div className="flex items-center justify-between">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>🖨 Impressora térmica</div>
        <span
          className="rounded-full px-2.5 py-1 font-bold"
          style={{
            fontSize: 10,
            background: info?.configured ? `${C.green}1f` : `${C.yellow}1f`,
            color: info?.configured ? C.green : C.yellow,
            border: `1px solid ${info?.configured ? C.green : C.yellow}44`,
          }}
        >
          {info?.configured ? "CONECTADA" : "NÃO CONFIGURADA"}
        </span>
      </div>
      <div style={{ color: "#8a8a8a", fontSize: 11.5, marginTop: 6, lineHeight: 1.5 }}>
        Imprime comandas direto na térmica ESC/POS de rede (80mm, porta 9100) —
        sem diálogo do navegador. Sem impressora, os botões usam a impressão do navegador.
      </div>
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-2 block">
            <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>IP da impressora</span>
            <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="ex.: 192.168.0.110"
              className="w-full rounded-lg px-2.5 py-2 mt-1 outline-none"
              style={{ background: C.black, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12.5 }} />
          </label>
          <label className="block">
            <span style={{ color: "#9a9a9a", fontSize: 11, fontWeight: 700 }}>Porta</span>
            <input value={port} onChange={(e) => setPort(e.target.value)}
              className="w-full rounded-lg px-2.5 py-2 mt-1 outline-none"
              style={{ background: C.black, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12.5 }} />
          </label>
        </div>
        {host.trim() && (
          <div className="flex gap-2 flex-wrap">
            <Btn small variant={enabled ? "dark" : "green"} disabled={busy} onClick={() => save({ printer_enabled: !enabled })}>
              {enabled ? "⏸ Desativar" : "▶ Ativar"}
            </Btn>
            <Btn small variant={info?.auto ? "dark" : "primary"} disabled={busy} onClick={() => save({ printer_auto: !info?.auto })}>
              {info?.auto ? "Auto-print ON (clique p/ desligar)" : "Auto-print OFF (clique p/ ligar)"}
            </Btn>
          </div>
        )}
        <div className="flex gap-2">
          <Btn small disabled={busy} onClick={() => save()}>Salvar</Btn>
          <Btn small variant="dark" disabled={busy || !host.trim()} onClick={test}>Testar impressão</Btn>
        </div>
      </div>
    </Card>
  );
}
function AdminSettings({ store, now }) {
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <AdminPaymentsCard store={store} />
      <AdminPrinterCard store={store} />

      <Card className="p-4">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14, marginBottom: 4 }}>Loja</div>
        <Row label="Nome"><Input v="TÔ NO SARRO! Burgers & Açaí" /></Row>
        <Row label="WhatsApp"><Input v="(81) 99999-0000" w={140} /></Row>
        <Row label="Endereço"><Input v="Av. Cláudio J. Gueiros Leite, 3200" /></Row>
        <Row label="Horário"><Input v="Ter a Dom · 18:00 – 23:30" w={180} /></Row>
        <Row label="Taxa de entrega"><Input v="7,90" w={80} /></Row>
        <Row label="Pedido mínimo"><Input v="25,00" w={80} /></Row>
        <Row label="Tempo médio"><Input v="35–45 min" w={110} /></Row>
        <Row label="Loja aberta">
          <button
            onClick={() => store.setOpen(!store.open)}
            className="rounded-full"
            style={{ width: 44, height: 24, background: store.open ? C.green : C.gray700, position: "relative" }}
          >
            <span style={{ position: "absolute", top: 3, left: store.open ? 23 : 3, width: 18, height: 18, borderRadius: 99, background: C.white, transition: "left .2s" }} />
          </button>
        </Row>
      </Card>

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

const ADMIN_NAV = [
  { id: "dashboard", icon: "📊", label: "Dashboard" },
  { id: "pedidos", icon: "🧾", label: "Pedidos" },
  { id: "produtos", icon: "🍔", label: "Cardápio" },
  { id: "categorias", icon: "🗂", label: "Categorias" },
  { id: "clientes", icon: "👥", label: "Clientes" },
  { id: "promos", icon: "🎟", label: "Promoções" },
  { id: "estoque", icon: "📦", label: "Estoque" },
  { id: "financeiro", icon: "💰", label: "Financeiro" },
  { id: "relatorios", icon: "📈", label: "Relatórios" },
  { id: "integracoes", icon: "🔌", label: "Integrações" },
  { id: "config", icon: "⚙️", label: "Configurações" },
];

function AdminApp({ store, now }) {
  const [sec, setSec] = useState("dashboard");
  const [menu, setMenu] = useState(false);
  const title = ADMIN_NAV.find((n) => n.id === sec)?.label;

  return (
    <div className="flex" style={{ background: C.black, minHeight: "100%" }}>
      <aside
        className="hidden md:flex flex-col shrink-0 p-4"
        style={{ width: 216, background: C.gray900, borderRight: `1px solid ${C.gray800}`, minHeight: "100%" }}
      >
        <Logo size={38} />
        <div style={{ color: "#5a5a5a", fontSize: 9.5, marginTop: 10, marginBottom: 18, letterSpacing: "0.04em" }}>
          SMART FOOD SYSTEM
        </div>
        <nav className="space-y-1 flex-1">
          {ADMIN_NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setSec(n.id)}
              className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left"
              style={{
                background: sec === n.id ? `${C.orange}1c` : "transparent",
                color: sec === n.id ? C.orange : "#9a9a9a",
                fontWeight: sec === n.id ? 800 : 600, fontSize: 13,
                borderLeft: `2px solid ${sec === n.id ? C.orange : "transparent"}`,
              }}
            >
              <span>{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>
        <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: C.gray850 }}>
          <div>
            <div style={{ color: "#8a8a8a", fontSize: 10.5 }}>Conectado como</div>
            <div style={{ color: C.white, fontWeight: 800, fontSize: 12.5 }}>{store.me?.name?.split(" ")[0] || "Administrador"}</div>
          </div>
          {store.me && (
            <button
              onClick={store.logout}
              className="rounded-lg px-2 py-1 font-bold text-xs"
              style={{ border: `1px solid ${C.gray800}`, color: "#9a9a9a" }}
            >
              Sair
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setMenu(!menu)} style={{ color: C.white, fontSize: 20 }}>☰</button>
            <h2 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 24, color: C.white, letterSpacing: "-0.02em" }}>
              {title.toUpperCase()}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Btn small variant="dark" onClick={() => store.injectExternal("IFOOD")}>+ Pedido iFood</Btn>
            <div className="relative">
              <span style={{ fontSize: 19 }}>🔔</span>
              {store.notifications.length > 0 && (
                <span
                  className="absolute flex items-center justify-center"
                  style={{ top: -4, right: -6, width: 16, height: 16, borderRadius: 99, background: C.orange, color: C.black, fontSize: 9.5, fontWeight: 900 }}
                >
                  {store.notifications.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {menu && (
          <div className="md:hidden grid grid-cols-2 gap-2 mb-5">
            {ADMIN_NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => { setSec(n.id); setMenu(false); }}
                className="rounded-xl px-3 py-2.5 text-left"
                style={{ background: sec === n.id ? `${C.orange}1c` : C.gray850, color: sec === n.id ? C.orange : "#c0c0c0", fontSize: 12.5, fontWeight: 700 }}
              >
                {n.icon} {n.label}
              </button>
            ))}
          </div>
        )}

        {sec === "dashboard" && <AdminDashboard store={store} now={now} />}
        {sec === "pedidos" && <AdminOrders store={store} now={now} />}
        {sec === "produtos" && <AdminProducts store={store} />}
        {sec === "categorias" && <AdminCategories store={store} />}
        {sec === "clientes" && <AdminCustomers store={store} />}
        {sec === "promos" && <AdminPromos store={store} now={now} />}
        {sec === "estoque" && <AdminInventory store={store} />}
        {sec === "financeiro" && <AdminFinance store={store} now={now} />}
        {sec === "relatorios" && <AdminReports store={store} now={now} />}
        {sec === "integracoes" && <AdminIntegrations store={store} />}
        {sec === "config" && <AdminSettings store={store} now={now} />}
      </main>
    </div>
  );
}
// ============================================================
// COZINHA — KDS
// ============================================================

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
          <SyncBadge store={store} now={now} />
          <span style={{ color: "#7a7a7a", fontSize: 11.5 }}>Prontos hoje</span>
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

// ============================================================
// EXPEDIÇÃO
// ============================================================

function ExpeditionApp({ store, now }) {
  const ready = store.orders.filter((o) => ["PRONTO", "EMBALADO", "AGUARDANDO"].includes(o.status));
  const rota = store.orders.filter((o) => o.status === "ROTA");

  return (
    <div style={{ background: C.black, minHeight: "100%" }} className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <Logo size={40} withText={false} />
          <div>
            <h2 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 24, color: C.white, letterSpacing: "-0.02em" }}>
              EXPEDIÇÃO
            </h2>
            <div style={{ color: "#7a7a7a", fontSize: 11.5 }}>{ready.length} aguardando saída · {rota.length} em rota</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SyncBadge store={store} now={now} />
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

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Pedidos prontos</div>
          {ready.length === 0 && (
            <Card className="p-6 text-center"><span style={{ color: "#8a8a8a", fontSize: 13 }}>Nada pronto no balcão agora.</span></Card>
          )}
          {ready.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span style={{ color: C.white, fontWeight: 900, fontSize: 17 }}>#{o.code}</span>
                  <ChannelPill channel={o.channel} />
                  <StatusPill status={o.status} small />
                </div>
                <span style={{ color: "#7a7a7a", fontSize: 11 }}>pronto há {elapsed(o.createdAt, now)}</span>
              </div>
              <div style={{ color: "#c9c9c9", fontSize: 13, fontWeight: 700 }}>{o.customer.name}</div>
              <div style={{ color: "#7a7a7a", fontSize: 11.5 }}>
                {o.type === "pickup" ? "🏪 Retirada na loja" : `🛵 ${o.customer.addr}`}
              </div>

              <div className="mt-3">
                <Btn small full variant="dark" onClick={async () => {
                  try {
                    await api(`/api/print/expedition/${o.id}`, { method: "POST" });
                    store.toast("Comanda enviada à impressora ✓");
                  } catch {
                    printExpedition(o);
                  }
                }}>🖨 IMPRIMIR EXPEDIÇÃO</Btn>
              </div>
              {o.type === "pickup" ? (
                <div className="mt-2">
                  <Btn full variant="green" onClick={() => store.setStatus(o.id, "ENTREGUE")}>CLIENTE RETIROU</Btn>
                </div>
              ) : (
                <div className="mt-3">
                  {o.status === "PRONTO" && <Btn full onClick={() => store.setStatus(o.id, "EMBALADO")}>EMBALAR PEDIDO</Btn>}
                  {o.status === "EMBALADO" && <Btn full onClick={() => store.setStatus(o.id, "AGUARDANDO")}>CHAMAR ENTREGADOR</Btn>}
                  {o.status === "AGUARDANDO" && (
                    <div>
                      <div style={{ color: "#8a8a8a", fontSize: 11.5, marginBottom: 7 }}>Atribuir entregador</div>
                      <div className="flex flex-wrap gap-2">
                        {store.drivers.map((d) => (
                          <Btn key={d.id} small variant="dark" onClick={() => store.assignDriver(o.id, d.id)}>
                            🛵 {d.name.split(" ")[0]}
                          </Btn>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Entregadores</div>
          {store.drivers.map((d) => {
            const load = store.orders.filter((o) => o.driverId === d.id && o.status === "ROTA").length;
            return (
              <Card key={d.id} className="p-3 flex items-center gap-3">
                <div className="flex items-center justify-center rounded-full" style={{ width: 38, height: 38, background: C.gray800, fontSize: 18 }}>🛵</div>
                <div className="flex-1">
                  <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>{d.name}</div>
                  <div style={{ color: "#7a7a7a", fontSize: 11 }}>{d.vehicle}</div>
                </div>
                <span style={{ color: load ? C.orange : C.green, fontSize: 11, fontWeight: 800 }}>
                  {load ? `${load} em rota` : "livre"}
                </span>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ENTREGADOR
// ============================================================

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
        <div className="flex items-center gap-2">
          <span
            className="rounded-lg px-2.5 py-1.5 font-bold"
            style={{ background: C.gray850, color: C.white, border: `1px solid ${C.gray800}`, fontSize: 12 }}
          >
            🛵 {meDriver ? meDriver.name.split(" ")[0] : "…"} · {meDriver?.vehicle}
          </span>
          {store.me && (
            <button
              onClick={store.logout}
              className="rounded-lg px-2 py-1 font-bold"
              style={{ border: `1px solid ${C.gray800}`, color: "#8a8a8a", fontSize: 11 }}
            >
              Sair
            </button>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <h2 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 26, color: C.white, letterSpacing: "-0.02em" }}>
          🛵 MINHAS ENTREGAS
        </h2>
        <div className="pb-1"><SyncBadge store={store} now={now} /></div>
      </div>
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

// ============================================================
// APP RAIZ — estado compartilhado entre todos os painéis
//
// Fonte da verdade: API REST (/api/bootstrap) + WebSocket (/ws).
// O carrinho e o pedido do cliente ficam no localStorage.
// ============================================================

// Cada painel tem a PRÓPRIA URL. O cliente fica na raiz (cardápio) e não
// esbarra no login da equipe; a equipe salva o endereço do seu painel como
// atalho na tela inicial e abre já no lugar certo.
const ROLES = [
  { id: "cliente", label: "Cardápio", icon: "🍔", path: "/" },
  { id: "admin", label: "Admin", icon: "📊", path: "/admin" },
  { id: "cozinha", label: "Cozinha", icon: "🔥", path: "/cozinha" },
  { id: "expedicao", label: "Expedição", icon: "📦", path: "/expedicao" },
  { id: "entregador", label: "Entregador", icon: "🛵", path: "/entregador" },
];

// Papéis autorizados em cada painel (o servidor valida de novo em cada rota)
const STAFF_GATE = {
  admin: ["ADMIN", "GERENTE"],
  cozinha: ["COZINHA", "GERENTE", "ADMIN"],
  expedicao: ["EXPEDICAO", "GERENTE", "ADMIN"],
  entregador: ["ENTREGADOR"],
};

const rolePath = (role) => ROLES.find((r) => r.id === role)?.path || "/";

// Lê o painel da URL — funciona também em subdiretório (base "./" do Vite),
// então http://host/preview/cozinha cai na cozinha. Sem caminho conhecido,
// cai no cardápio do cliente.
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
  const [settings, setSettings] = useState({ open: true, fee: 7.9, minOrder: 25, eta: "35–45 min" });
  const [catalog, setCatalog] = useState({ categories: [], optionGroups: [], builder: [] });

  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sarro_cart")) || []; } catch { return []; }
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
          fresh.slice(0, 3).forEach((o) => printKitchen(o));
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

        // Pagamento online (Pix/cartão): abre o checkout seguro da InfinitePay.
        // A confirmação volta por webhook e o status atualiza sozinho.
        if (["PIX", "CARTAO_ONLINE"].includes(payload.payment)) {
          try {
            const pd = await api(`/api/orders/${order.id}/pay?t=${encodeURIComponent(order.trackToken || "")}`, { method: "POST" });
            if (pd.url) {
              setOrders((os) => os.map((x) => (x.id === order.id ? { ...x, payUrl: pd.url } : x)));
              setMyOrder((m) => (m && m.id === order.id ? { ...m, payUrl: pd.url } : m));
              window.open(pd.url, "_blank");
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

  if (!ready) return <Splash error={bootError} onRetry={load} />;

  const gate = STAFF_GATE[role];
  const allowed = !gate || (me && gate.includes(me.role));

  return (
    <div style={{ background: C.black, minHeight: "100vh", fontFamily: font.body, color: C.white }}>
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
            <span style={{ color: "#8a8a8a", fontSize: 11 }}>
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
          {role === "expedicao" && <ExpeditionApp store={store} now={now} />}
          {role === "entregador" && <DriverApp store={store} now={now} />}
        </>
      )}

      <Toast msg={toastMsg} />
      <Confetti on={confetti} />
    </div>
  );
}

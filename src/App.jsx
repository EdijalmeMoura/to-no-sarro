import React, { useState, useEffect, useMemo, useRef } from "react";

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

const OPTION_GROUPS = {
  ponto: {
    id: "ponto", name: "Ponto da carne", min: 1, max: 1, required: true,
    options: [
      { id: "malpassado", name: "Mal passado", price: 0 },
      { id: "aoponto", name: "Ao ponto", price: 0 },
      { id: "bempassado", name: "Bem passado", price: 0 },
    ],
  },
  queijo: {
    id: "queijo", name: "Escolha seu queijo", min: 1, max: 1, required: true,
    options: [
      { id: "cheddar", name: "Cheddar", price: 0 },
      { id: "mussarela", name: "Mussarela", price: 0 },
      { id: "prato", name: "Prato", price: 0 },
      { id: "gorgonzola", name: "Gorgonzola", price: 3 },
    ],
  },
  molho: {
    id: "molho", name: "Escolha seu molho", min: 1, max: 2, required: true,
    options: [
      { id: "especial", name: "Molho especial da casa", price: 0 },
      { id: "barbecue", name: "Barbecue", price: 0 },
      { id: "cheddar_m", name: "Cheddar cremoso", price: 2 },
      { id: "picante", name: "Picante do Sarro", price: 2 },
    ],
  },
  adicionais: {
    id: "adicionais", name: "Turbine seu burger", min: 0, max: 6, required: false,
    options: [
      { id: "add_cheddar", name: "Cheddar extra", price: 4 },
      { id: "add_bacon", name: "Bacon crocante", price: 5 },
      { id: "add_carne", name: "Carne extra 180g", price: 9 },
      { id: "add_molho", name: "Molho especial extra", price: 2 },
      { id: "add_cebola", name: "Cebola caramelizada", price: 3 },
      { id: "add_ovo", name: "Ovo frito", price: 3 },
    ],
  },
  remover: {
    id: "remover", name: "Retirar ingredientes", min: 0, max: 6, required: false,
    options: [
      { id: "rm_cebola", name: "Sem cebola", price: 0 },
      { id: "rm_alface", name: "Sem alface", price: 0 },
      { id: "rm_tomate", name: "Sem tomate", price: 0 },
      { id: "rm_picles", name: "Sem picles", price: 0 },
    ],
  },
  acaiTop: {
    id: "acaiTop", name: "Acompanhamentos do açaí", min: 0, max: 5, required: false,
    options: [
      { id: "granola", name: "Granola", price: 2 },
      { id: "leiteninho", name: "Leite ninho", price: 3 },
      { id: "banana", name: "Banana", price: 2 },
      { id: "morango", name: "Morango", price: 4 },
      { id: "nutella", name: "Nutella", price: 6 },
    ],
  },
  refri: {
    id: "refri", name: "Escolha a bebida do combo", min: 1, max: 1, required: true,
    options: [
      { id: "coca", name: "Coca-Cola lata", price: 0 },
      { id: "guarana", name: "Guaraná lata", price: 0 },
      { id: "suco", name: "Suco natural 300ml", price: 3 },
    ],
  },
};

const PRODUCTS = [
  {
    id: "p1", name: "Sarro Burger", cat: "burgers", emoji: "🍔",
    desc: "O clássico que deu nome à casa. Simples, gordo e honesto.",
    ingredients: ["Pão brioche", "Hambúrguer artesanal 180g", "Queijo cheddar", "Bacon crocante", "Molho especial", "Cebola roxa", "Alface", "Tomate"],
    price: 29.9, promo: null, time: 18, badges: ["maisvendido"], available: true,
    groups: ["ponto", "queijo", "molho", "adicionais", "remover"], stock: 40,
  },
  {
    id: "p2", name: "Bacon Sarro", cat: "burgers", emoji: "🥓",
    desc: "Camada dupla de bacon e cheddar derretido na chapa.",
    ingredients: ["Pão brioche", "Hambúrguer 180g", "Cheddar duplo", "Bacon em tiras", "Maionese defumada"],
    price: 34.9, promo: 31.9, time: 20, badges: ["promocao"], available: true,
    groups: ["ponto", "molho", "adicionais", "remover"], stock: 28,
  },
  {
    id: "p3", name: "Duplo Sarro", cat: "especiais", emoji: "🍔",
    desc: "Dois blends de 180g para quem chegou com fome de verdade.",
    ingredients: ["Pão australiano", "2x hambúrguer 180g", "Queijo prato", "Bacon", "Cebola caramelizada", "Molho da casa"],
    price: 44.9, promo: null, time: 24, badges: ["maisvendido"], available: true,
    groups: ["ponto", "queijo", "molho", "adicionais", "remover"], stock: 15,
  },
  {
    id: "p4", name: "Smash do Sarro", cat: "burgers", emoji: "🍔",
    desc: "Dois smashs finos prensados na chapa quente, borda crocante.",
    ingredients: ["Pão de batata", "2x smash 90g", "Cheddar americano", "Picles", "Molho smash"],
    price: 27.9, promo: null, time: 15, badges: ["novidade"], available: true,
    groups: ["queijo", "molho", "adicionais", "remover"], stock: 33,
  },
  {
    id: "p5", name: "Frango Empanado Sarro", cat: "especiais", emoji: "🍗",
    desc: "Filé de frango empanado na hora, crocante por fora.",
    ingredients: ["Pão brioche", "Filé de frango empanado", "Queijo prato", "Alface", "Maionese verde"],
    price: 28.9, promo: null, time: 20, badges: [], available: true,
    groups: ["queijo", "molho", "adicionais", "remover"], stock: 22,
  },
  {
    id: "p6", name: "Combo Sarro Completo", cat: "combos", emoji: "🍟",
    desc: "Sarro Burger + batata especial + bebida gelada. O pedido campeão.",
    ingredients: ["Sarro Burger", "Batata especial 200g", "Bebida 350ml"],
    price: 49.9, promo: 42.9, time: 25, badges: ["maisvendido", "promocao"], available: true,
    groups: ["ponto", "molho", "refri", "adicionais"], stock: 30,
  },
  {
    id: "p7", name: "Combo Casal", cat: "combos", emoji: "🍔",
    desc: "2 burgers, porção grande de batata e 2 bebidas.",
    ingredients: ["2x Sarro Burger", "Batata grande", "2 bebidas"],
    price: 89.9, promo: 79.9, time: 30, badges: ["promocao"], available: true,
    groups: ["ponto", "molho", "adicionais"], stock: 12,
  },
  {
    id: "p8", name: "Batata Especial", cat: "porcoes", emoji: "🍟",
    desc: "Batata rústica com cheddar, bacon e cebolinha.",
    ingredients: ["Batata rústica 300g", "Cheddar cremoso", "Bacon", "Cebolinha"],
    price: 24.9, promo: null, time: 14, badges: ["maisvendido"], available: true,
    groups: ["adicionais"], stock: 45,
  },
  {
    id: "p9", name: "Onion Rings", cat: "porcoes", emoji: "🧅",
    desc: "8 anéis de cebola empanados com molho barbecue.",
    ingredients: ["Cebola empanada", "Molho barbecue"],
    price: 19.9, promo: null, time: 12, badges: [], available: true, groups: [], stock: 20,
  },
  {
    id: "p10", name: "Coca-Cola 350ml", cat: "bebidas", emoji: "🥤",
    desc: "Lata gelada.", ingredients: ["Refrigerante 350ml"],
    price: 7, promo: null, time: 2, badges: [], available: true, groups: [], stock: 120,
  },
  {
    id: "p11", name: "Suco natural 500ml", cat: "bebidas", emoji: "🍹",
    desc: "Laranja, maracujá ou abacaxi com hortelã.", ingredients: ["Fruta natural", "Gelo"],
    price: 12, promo: null, time: 6, badges: [], available: true, groups: [], stock: 40,
  },
  {
    id: "p12", name: "Açaí Sarro 500ml", cat: "acai", emoji: "🥣",
    desc: "Açaí cremoso batido na hora com os acompanhamentos que você escolher.",
    ingredients: ["Açaí 500ml", "Acompanhamentos à escolha"],
    price: 24.9, promo: null, time: 10, badges: ["maisvendido"], available: true,
    groups: ["acaiTop"], stock: 35,
  },
  {
    id: "p13", name: "Açaí Turbinado 700ml", cat: "acai", emoji: "🍨",
    desc: "Porção grande com quatro acompanhamentos inclusos.",
    ingredients: ["Açaí 700ml", "4 acompanhamentos"],
    price: 32.9, promo: 28.9, time: 12, badges: ["promocao"], available: true,
    groups: ["acaiTop"], stock: 18,
  },
  {
    id: "p14", name: "Brownie com sorvete", cat: "sobremesas", emoji: "🍫",
    desc: "Brownie quente com bola de creme e calda quente.",
    ingredients: ["Brownie", "Sorvete de creme", "Calda de chocolate"],
    price: 18.9, promo: null, time: 8, badges: ["novidade"], available: true, groups: [], stock: 14,
  },
  {
    id: "p15", name: "Milkshake 400ml", cat: "sobremesas", emoji: "🥤",
    desc: "Chocolate, morango ou ovomaltine.", ingredients: ["Sorvete", "Leite", "Cobertura"],
    price: 21.9, promo: null, time: 8, badges: [], available: true, groups: [], stock: 25,
  },
  {
    id: "p16", name: "Monte seu Sarro", cat: "especiais", emoji: "🛠️",
    desc: "Você escolhe pão, carne, queijo e o resto. Preço calculado na hora.",
    ingredients: ["Você decide"], price: 26.9, promo: null, time: 22,
    badges: ["novidade"], available: true, groups: [], stock: 99, builder: true,
  },
];

const BUILDER = {
  pao: {
    label: "Escolha o pão", key: "pao",
    options: [
      { id: "brioche", name: "Brioche", price: 0 },
      { id: "australiano", name: "Australiano", price: 3 },
      { id: "batata", name: "Pão de batata", price: 2 },
      { id: "integral", name: "Integral", price: 2 },
    ],
  },
  carne: {
    label: "Escolha a carne", key: "carne",
    options: [
      { id: "blend180", name: "Blend bovino 180g", price: 0 },
      { id: "smash2", name: "Duplo smash 90g", price: 2 },
      { id: "costela", name: "Costela desfiada", price: 6 },
      { id: "frango", name: "Frango empanado", price: 3 },
      { id: "veg", name: "Burger de grão-de-bico", price: 4 },
    ],
  },
  queijo: {
    label: "Escolha o queijo", key: "queijo",
    options: [
      { id: "cheddar", name: "Cheddar", price: 0 },
      { id: "mussarela", name: "Mussarela", price: 0 },
      { id: "gorgonzola", name: "Gorgonzola", price: 3 },
      { id: "semqueijo", name: "Sem queijo", price: -2 },
    ],
  },
  molho: {
    label: "Escolha o molho", key: "molho",
    options: [
      { id: "especial", name: "Especial da casa", price: 0 },
      { id: "barbecue", name: "Barbecue", price: 0 },
      { id: "picante", name: "Picante", price: 2 },
    ],
  },
};

const COUPONS = [
  { code: "SARRO10", type: "percent", value: 10, min: 40, uses: 132, limit: 500, active: true, note: "10% em qualquer pedido acima de R$ 40" },
  { code: "BEMVINDO", type: "percent", value: 15, min: 0, uses: 48, limit: 1000, active: true, note: "Primeira compra" },
  { code: "BURGER20", type: "fixed", value: 20, min: 90, uses: 17, limit: 100, active: true, note: "R$ 20 off acima de R$ 90" },
  { code: "FRETEGRATIS", type: "freeship", value: 0, min: 60, uses: 71, limit: 300, active: true, note: "Entrega grátis acima de R$ 60" },
];

const DRIVERS = [
  { id: "d1", name: "Rafael Lima", phone: "(81) 98812-0011", vehicle: "Moto CG 160", status: "livre", deliveries: 8 },
  { id: "d2", name: "Jonas Pereira", phone: "(81) 99640-2233", vehicle: "Moto Biz", status: "em rota", deliveries: 11 },
  { id: "d3", name: "Bia Santos", phone: "(81) 99177-8890", vehicle: "Moto Fan 150", status: "livre", deliveries: 6 },
];

const CUSTOMERS = [
  { id: "c1", name: "João Silva", phone: "(81) 99123-4567", orders: 14, spent: 742.3, last: "Hoje", tier: "VIP", addr: "Rua das Palmeiras, 220 — Janga, Paulista/PE", points: 74 },
  { id: "c2", name: "Marina Costa", phone: "(81) 98877-1020", orders: 6, spent: 289.4, last: "Ontem", tier: "Recorrente", addr: "Av. Cláudio J. Gueiros, 1500 — Maria Farinha", points: 28 },
  { id: "c3", name: "Pedro Henrique", phone: "(81) 99555-3311", orders: 1, spent: 49.9, last: "Há 3 dias", tier: "Novo", addr: "Rua do Sol, 45 — Pau Amarelo", points: 4 },
  { id: "c4", name: "Ana Beatriz", phone: "(81) 98220-7744", orders: 22, spent: 1310.8, last: "Há 2h", tier: "VIP", addr: "Rua Boa Viagem, 88 — Casa Caiada, Olinda", points: 131 },
  { id: "c5", name: "Carlos Mendes", phone: "(81) 99801-4455", orders: 3, spent: 152.7, last: "Há 46 dias", tier: "Inativo", addr: "Rua Nova, 12 — Rio Doce", points: 15 },
];

const INVENTORY = [
  { id: "i1", name: "Blend bovino 180g", unit: "un", qty: 86, min: 40 },
  { id: "i2", name: "Pão brioche", unit: "un", qty: 62, min: 50 },
  { id: "i3", name: "Queijo cheddar", unit: "fatia", qty: 210, min: 80 },
  { id: "i4", name: "Bacon", unit: "kg", qty: 3.4, min: 4 },
  { id: "i5", name: "Alface", unit: "un", qty: 12, min: 6 },
  { id: "i6", name: "Tomate", unit: "kg", qty: 5.2, min: 3 },
  { id: "i7", name: "Molho especial", unit: "L", qty: 2.1, min: 3 },
  { id: "i8", name: "Batata congelada", unit: "kg", qty: 18, min: 10 },
  { id: "i9", name: "Refrigerante lata", unit: "un", qty: 94, min: 48 },
  { id: "i10", name: "Polpa de açaí", unit: "kg", qty: 7.5, min: 8 },
];

const PROMOS = [
  { id: "pr1", name: "Happy Hour do Sarro", rule: "18h às 20h — 15% off em combos", active: true, window: "18:00–20:00" },
  { id: "pr2", name: "Terça do Duplo", rule: "Duplo Sarro por R$ 37,90", active: true, window: "Terças" },
  { id: "pr3", name: "Açaí da tarde", rule: "Açaí 500ml por R$ 19,90", active: false, window: "14:00–17:00" },
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

const FEE = 7.9;
// ============================================================
// UTILITÁRIOS DE UI
// ============================================================

const font = {
  display: "'Archivo Black', 'Arial Black', Impact, sans-serif",
  body: "'Inter', system-ui, -apple-system, Segoe UI, sans-serif",
};

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

function Logo({ size = 44, withText = true }) {
  return (
    <div className="flex items-center gap-3 select-none">
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{
          width: size, height: size, borderRadius: "50%",
          background: C.black, border: `2px solid ${C.orange}`,
          boxShadow: `0 0 0 2px ${C.black}, 0 0 0 3px ${C.yellow}33`,
        }}
      >
        <span style={{ fontSize: size * 0.52, lineHeight: 1 }}>😜</span>
      </div>
      {withText && (
        <div style={{ lineHeight: 0.86 }}>
          <div style={{ fontFamily: font.display, fontSize: size * 0.32, color: C.white, fontStyle: "italic", letterSpacing: "-0.02em" }}>
            TÔ NO
          </div>
          <div style={{ fontFamily: font.display, fontSize: size * 0.42, color: C.orange, fontStyle: "italic", letterSpacing: "-0.02em" }}>
            SARRO!
          </div>
        </div>
      )}
    </div>
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

function ChannelPill({ channel }) {
  const c = CHANNELS[channel];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md font-bold"
      style={{ background: `${c.color}1f`, color: c.color, fontSize: 10, padding: "2px 6px", border: `1px solid ${c.color}44` }}
    >
      {c.icon} {c.short}
    </span>
  );
}

// ============================================================
// PEDIDOS — SEED + CRIAÇÃO
// ============================================================

let seq = 1047;
const nextCode = () => ++seq;

function makeOrder(partial) {
  const subtotal = partial.items.reduce((s, i) => s + i.unit * i.qty, 0);
  const fee = partial.type === "delivery" ? (partial.fee ?? FEE) : 0;
  const discount = partial.discount || 0;
  return {
    id: uid(), code: nextCode(), channel: "DIRECT", status: "NOVO",
    createdAt: Date.now(), driverId: null, startedAt: null, note: "",
    payment: "PIX", type: "delivery",
    ...partial,
    subtotal, fee, discount, total: subtotal + fee - discount,
  };
}

function seedOrders() {
  const t = Date.now();
  const mk = (o, minsAgo, status) => {
    const ord = makeOrder(o);
    ord.createdAt = t - minsAgo * 60000;
    ord.status = status;
    if (["PREPARO", "PRONTO", "EMBALADO", "AGUARDANDO", "ROTA", "ENTREGUE"].includes(status))
      ord.startedAt = ord.createdAt + 90000;
    return ord;
  };
  const it = (p, qty, opts = [], note = "") => ({
    id: uid(), productId: p.id, name: p.name, emoji: p.emoji, qty,
    unit: (p.promo || p.price) + opts.reduce((s, o) => s + o.price, 0), opts, note,
  });
  const P = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  return [
    mk({ channel: "IFOOD", customer: { name: "Marina Costa", phone: "(81) 98877-1020", addr: "Av. Cláudio J. Gueiros, 1500 — Maria Farinha" },
      items: [it(P.p1, 2, [{ name: "Bacon crocante", price: 5 }], "Sem cebola"), it(P.p10, 2)], payment: "Cartão (iFood)" }, 4, "NOVO"),
    mk({ channel: "DIRECT", customer: { name: "João Silva", phone: "(81) 99123-4567", addr: "Rua das Palmeiras, 220 — Janga, Paulista/PE" },
      items: [it(P.p6, 1), it(P.p8, 1)], payment: "PIX" }, 9, "PREPARO"),
    mk({ channel: "WHATSAPP", customer: { name: "Pedro Henrique", phone: "(81) 99555-3311", addr: "Retirada na loja" },
      items: [it(P.p3, 1, [{ name: "Ovo frito", price: 3 }])], payment: "Dinheiro", type: "pickup" }, 14, "PRONTO"),
    mk({ channel: "NNFOOD", customer: { name: "Ana Beatriz", phone: "(81) 98220-7744", addr: "Rua Boa Viagem, 88 — Casa Caiada, Olinda" },
      items: [it(P.p12, 2), it(P.p14, 1)], payment: "Cartão (99Food)" }, 19, "AGUARDANDO"),
    mk({ channel: "DIRECT", customer: { name: "Carlos Mendes", phone: "(81) 99801-4455", addr: "Rua Nova, 12 — Rio Doce" },
      items: [it(P.p2, 1), it(P.p9, 1), it(P.p11, 1)], payment: "PIX" }, 27, "ROTA"),
    mk({ channel: "DIRECT", customer: { name: "Lucas Andrade", phone: "(81) 99333-1200", addr: "Rua do Sol, 45 — Pau Amarelo" },
      items: [it(P.p7, 1)], payment: "Cartão" }, 52, "ENTREGUE"),
  ].map((o, i) => (i === 4 ? { ...o, driverId: "d2" } : o));
}

// ============================================================
// CLIENTE — CARDÁPIO
// ============================================================

function Hero({ store, onOrder }) {
  return (
    <div className="relative overflow-hidden" style={{ background: C.black }}>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 78% 8%, ${C.orange}3d 0%, transparent 58%), radial-gradient(90% 70% at 10% 100%, ${C.yellow}22 0%, transparent 60%)`,
        }}
      />
      <div
        className="absolute"
        style={{
          left: "-12%", top: "42%", width: "130%", height: 26,
          background: `linear-gradient(90deg, transparent, ${C.orange}, transparent)`,
          transform: "rotate(-6deg)", filter: "blur(1px)", opacity: 0.55,
        }}
      />
      <div className="relative px-5 pt-6 pb-8">
        <div className="flex items-center justify-between mb-6">
          <Logo size={46} />
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: C.gray850, border: `1px solid ${store.open ? C.green : C.red}55` }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 99, background: store.open ? C.green : C.red, display: "inline-block" }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: store.open ? C.green : C.red }}>
              {store.open ? "Aberto agora" : "Fechado"}
            </span>
          </div>
        </div>

        <div style={{ fontFamily: font.display, fontStyle: "italic", letterSpacing: "-0.03em" }}>
          <div style={{ fontSize: 40, lineHeight: 0.92, color: C.white }}>BATEU A FOME?</div>
          <div style={{ fontSize: 46, lineHeight: 0.92, color: C.orange, textShadow: `3px 3px 0 ${C.black}` }}>
            ENTÃO TÁ NO SARRO! 🔥
          </div>
        </div>

        <p style={{ color: "#bdbdbd", fontSize: 13, marginTop: 14, maxWidth: 420, lineHeight: 1.5 }}>
          Burger artesanal na chapa e açaí batido na hora, saindo do Janga direto
          pra sua casa. {store.open ? "Entrega em 35–45 min." : "Voltamos às 18h."}
        </p>

        <div className="flex items-center gap-3 mt-5">
          <Btn onClick={onOrder} style={{ paddingLeft: 26, paddingRight: 26 }}>PEDIR AGORA</Btn>
          <div className="flex items-center gap-2" style={{ color: "#8a8a8a", fontSize: 11 }}>
            <span>⭐ 4,9</span><span>•</span><span>🛵 {brl(FEE)}</span><span>•</span><span>⏱ 35–45min</span>
          </div>
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
        className="shrink-0 flex items-center justify-center rounded-xl"
        style={{
          width: 78, height: 78,
          background: `linear-gradient(135deg, ${C.orange}2e, ${C.gray800})`,
          border: `1px solid ${C.gray800}`, fontSize: 36,
        }}
      >
        {p.emoji}
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

function ProductModal({ p, onClose, onAdd }) {
  const [qty, setQty] = useState(1);
  const [sel, setSel] = useState({});
  const [note, setNote] = useState("");
  const [build, setBuild] = useState({ pao: "brioche", carne: "blend180", queijo: "cheddar", molho: "especial" });

  const groups = (p.groups || []).map((g) => OPTION_GROUPS[g]);

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
  const buildExtra = p.builder
    ? Object.entries(build).reduce((s, [k, v]) => s + (BUILDER[k].options.find((o) => o.id === v)?.price || 0), 0)
    : 0;
  const unit = (p.promo || p.price) + chosen.reduce((s, o) => s + o.price, 0) + buildExtra;
  const missing = groups.filter((g) => g.required && (sel[g.id] || []).length < g.min);

  const add = () => {
    const opts = p.builder
      ? Object.entries(build).map(([k, v]) => {
          const o = BUILDER[k].options.find((x) => x.id === v);
          return { id: o.id, name: `${BUILDER[k].label.replace("Escolha o ", "").replace("Escolha a ", "")}: ${o.name}`, price: o.price };
        })
      : chosen;
    onAdd({ id: uid(), productId: p.id, name: p.name, emoji: p.emoji, qty, unit, opts, note });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,.78)" }}>
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto"
        style={{ background: C.gray900, borderTop: `3px solid ${C.orange}`, borderRadius: "22px 22px 0 0" }}
      >
        <div
          className="relative flex items-center justify-center"
          style={{ height: 150, background: `linear-gradient(135deg, ${C.orange}33, ${C.black})`, fontSize: 72 }}
        >
          {p.emoji}
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
            Object.values(BUILDER).map((g) => (
              <div key={g.key} className="mt-5">
                <div style={{ color: C.yellowLight, fontWeight: 800, fontSize: 13, marginBottom: 8 }}>{g.label}</div>
                <div className="flex flex-wrap gap-2">
                  {g.options.map((o) => {
                    const on = build[g.key] === o.id;
                    return (
                      <button
                        key={o.id}
                        onClick={() => setBuild({ ...build, [g.key]: o.id })}
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
          <Card key={p.id} onClick={() => onOpen(p)} className="shrink-0 p-3" style={{ width: 168, cursor: "pointer" }}>
            <div
              className="rounded-xl flex items-center justify-center mb-2"
              style={{ height: 96, background: `linear-gradient(135deg, ${C.orange}2e, ${C.gray800})`, fontSize: 44 }}
            >
              {p.emoji}
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
          <span style={{ fontSize: 30 }}>🛠️</span>
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
  let fee = store.orderType === "pickup" ? 0 : FEE;
  if (coupon) {
    if (coupon.type === "percent") discount = subtotal * (coupon.value / 100);
    if (coupon.type === "fixed") discount = coupon.value;
    if (coupon.type === "freeship") fee = 0;
  }
  const total = Math.max(0, subtotal + fee - discount);

  const apply = () => {
    const c = COUPONS.find((x) => x.code === code.trim().toUpperCase() && x.active);
    if (!c) return setErr("Cupom não encontrado ou expirado.");
    if (subtotal < c.min) return setErr(`Esse cupom vale a partir de ${brl(c.min)}.`);
    setErr(""); store.setCoupon(c); store.toast(`Cupom ${c.code} aplicado`);
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
              <div
                className="shrink-0 rounded-xl flex items-center justify-center"
                style={{ width: 52, height: 52, background: C.gray800, fontSize: 26 }}
              >
                {i.emoji}
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
            <Card key={p.id} className="shrink-0 p-3" style={{ width: 132 }}>
              <div className="flex items-center justify-center rounded-lg mb-2" style={{ height: 60, background: C.gray800, fontSize: 30 }}>
                {p.emoji}
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
    const order = makeOrder({
      channel: "DIRECT",
      customer: {
        name: f.name, phone: f.phone,
        addr: f.type === "pickup" ? "Retirada na loja" : `${f.street}, ${f.number} — ${f.district}, ${f.city}`,
      },
      items: store.cart,
      type: f.type,
      payment: f.payment + (f.payment === "Dinheiro" && f.needChange ? ` (troco p/ ${f.changeFor})` : ""),
      discount: totals.discount,
      fee,
      note: f.ref,
    });
    onDone(order);
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
            title="Delivery" sub={`35–45 min · taxa ${brl(FEE)}`} />
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
          <Choice on={f.payment === "PIX"} onClick={() => set("payment", "PIX")} icon="⚡" title="Pix" sub="Aprovação na hora" />
          <Choice on={f.payment === "Cartão"} onClick={() => set("payment", "Cartão")} icon="💳" title="Cartão" sub="Crédito ou débito na entrega" />
          <Choice on={f.payment === "Dinheiro"} onClick={() => set("payment", "Dinheiro")} icon="💵" title="Dinheiro" sub="Pagamento na entrega" />

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
                O QR Code é gerado pelo gateway configurado no admin (Mercado Pago, PagBank, Stone,
                Inter ou Asaas). A confirmação chega por webhook e muda o pedido para “Pagamento confirmado”.
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
  const driver = DRIVERS.find((d) => d.id === order.driverId);

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
        <Btn variant="dark" full onClick={() => store.toast("Abrindo conversa no WhatsApp da loja")}>💬 Falar com a loja</Btn>
      </div>
    </div>
  );
}
// ============================================================
// CLIENTE — SHELL (bottom nav, conta, fidelidade)
// ============================================================

function AccountScreen({ store }) {
  const me = CUSTOMERS[0];
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

function ClientApp({ store, now }) {
  const [modal, setModal] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const cartCount = store.cart.reduce((s, i) => s + i.qty, 0);
  const active = store.myOrderId ? store.orders.find((o) => o.id === store.myOrderId) : null;

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
          onDone={(order) => { setCheckout(null); store.placeOrder(order); }}
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

      {modal && <ProductModal p={modal} onClose={() => setModal(null)} onAdd={addToCart} />}

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
          style={{ right: 16, bottom: cartCount > 0 ? 142 : 78, width: 46, height: 46, background: "#25D366", fontSize: 21, boxShadow: "0 8px 22px rgba(0,0,0,.5)" }}
        >
          💬
        </a>
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
        <KPI icon="👥" label="Clientes na base" value={CUSTOMERS.length} />
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
        </div>
        <span style={{ color: "#7a7a7a", fontSize: 10.5 }}>{elapsed(o.createdAt, now)}</span>
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

function AdminProducts({ store }) {
  const [edit, setEdit] = useState(null);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div style={{ color: "#8a8a8a", fontSize: 12 }}>{store.products.length} produtos cadastrados</div>
        <Btn small onClick={() => store.toast("Formulário de novo produto")}>+ Novo produto</Btn>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {store.products.map((p) => (
          <Card key={p.id} className="p-3">
            <div className="flex gap-3">
              <div className="rounded-xl flex items-center justify-center shrink-0" style={{ width: 52, height: 52, background: C.gray800, fontSize: 26 }}>{p.emoji}</div>
              <div className="flex-1 min-w-0">
                <div style={{ color: C.white, fontWeight: 800, fontSize: 13.5 }}>{p.name}</div>
                <div style={{ color: "#7a7a7a", fontSize: 11 }}>
                  {CATEGORIES.find((c) => c.id === p.cat)?.label} · {p.time} min · estoque {p.stock}
                </div>
                {edit === p.id ? (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number" defaultValue={p.price} step="0.5"
                      onBlur={(e) => { store.updateProduct(p.id, { price: parseFloat(e.target.value) || p.price }); setEdit(null); }}
                      className="rounded-lg px-2 py-1 outline-none"
                      style={{ background: C.gray800, color: C.white, border: `1px solid ${C.orange}`, fontSize: 12, width: 82 }}
                      autoFocus
                    />
                    <span style={{ color: "#7a7a7a", fontSize: 10.5 }}>salva ao sair do campo</span>
                  </div>
                ) : (
                  <button onClick={() => setEdit(p.id)} style={{ color: C.yellowLight, fontWeight: 900, fontSize: 13.5, marginTop: 4 }}>
                    {brl(p.promo || p.price)} ✎
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${C.gray800}` }}>
              <span style={{ color: p.available ? C.green : C.red, fontSize: 11.5, fontWeight: 700 }}>
                {p.available ? "Disponível" : "Indisponível"}
              </span>
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

function AdminCustomers() {
  const tierColor = { VIP: C.yellowLight, Recorrente: C.green, Novo: C.blue, Inativo: "#7a7a7a" };
  return (
    <Card className="p-1">
      <Table
        cols={["Cliente", "WhatsApp", "Pedidos", "Gasto", "Ticket médio", "Último", "Classificação"]}
        rows={CUSTOMERS.map((c) => [
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

function AdminPromos() {
  return (
    <div className="space-y-5">
      <div>
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14, marginBottom: 10 }}>Cupons ativos</div>
        <Card className="p-1">
          <Table
            cols={["Código", "Regra", "Mínimo", "Usos", "Limite", "Status"]}
            rows={COUPONS.map((c) => [
              c.code, c.note, brl(c.min), c.uses, c.limit,
              <span key="s" style={{ color: C.green, fontSize: 11.5, fontWeight: 800 }}>ATIVO</span>,
            ])}
          />
        </Card>
      </div>
      <div>
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14, marginBottom: 10 }}>Promoções programadas</div>
        <div className="grid md:grid-cols-3 gap-3">
          {PROMOS.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex justify-between items-start">
                <span style={{ color: C.white, fontWeight: 800, fontSize: 13.5 }}>{p.name}</span>
                <span style={{ color: p.active ? C.green : "#6a6a6a", fontSize: 10.5, fontWeight: 800 }}>
                  {p.active ? "ATIVA" : "PAUSADA"}
                </span>
              </div>
              <div style={{ color: "#9a9a9a", fontSize: 12, marginTop: 6 }}>{p.rule}</div>
              <div style={{ color: C.yellowLight, fontSize: 11, marginTop: 8, fontWeight: 700 }}>⏰ {p.window}</div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminIntegrations({ store }) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {INTEGRATIONS.map((it) => (
        <Card key={it.id} className="p-4">
          <div className="flex items-center justify-between">
            <span style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>{it.name}</span>
            <span
              className="rounded-full px-2.5 py-1 font-bold"
              style={{
                fontSize: 10, background: it.status === "conectado" ? `${C.green}1f` : `${C.yellow}1f`,
                color: it.status === "conectado" ? C.green : C.yellow,
                border: `1px solid ${it.status === "conectado" ? C.green : C.yellow}44`,
              }}
            >
              {it.status.toUpperCase()}
            </span>
          </div>
          <p style={{ color: "#9a9a9a", fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>{it.desc}</p>
          <div className="mt-3 space-y-2">
            {it.fields.map((fl) => (
              <div key={fl} className="flex items-center gap-2">
                <span style={{ color: "#7a7a7a", fontSize: 11, width: 118 }}>{fl}</span>
                <input
                  defaultValue={it.status === "conectado" ? "••••••••••••" : ""}
                  placeholder="não configurado"
                  className="flex-1 rounded-lg px-2.5 py-1.5 outline-none"
                  style={{ background: C.black, border: `1px solid ${C.gray800}`, color: "#c0c0c0", fontSize: 11.5 }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Btn small onClick={() => store.toast(`${it.name}: credenciais salvas`)}>Salvar</Btn>
            <Btn small variant="dark" onClick={() => store.toast(`Testando conexão com ${it.name}…`)}>Testar conexão</Btn>
            {it.id === "ifood" && (
              <Btn small variant="dark" onClick={() => store.injectExternal("IFOOD")}>Simular pedido</Btn>
            )}
            {it.id === "99food" && (
              <Btn small variant="dark" onClick={() => store.injectExternal("NNFOOD")}>Simular pedido</Btn>
            )}
          </div>
          <div style={{ color: "#5a5a5a", fontSize: 10.5, marginTop: 10 }}>
            Tokens ficam no servidor, em variáveis de ambiente. O frontend nunca recebe credenciais.
          </div>
        </Card>
      ))}
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

function AdminSettings({ store }) {
  return (
    <div className="grid lg:grid-cols-2 gap-3">
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

      <Card className="p-4">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14, marginBottom: 4 }}>Usuários e permissões</div>
        {[
          ["Administrador", "Acesso total, incluindo financeiro e integrações"],
          ["Gerente", "Tudo, exceto usuários e integrações"],
          ["Atendimento", "Pedidos, clientes e cupons"],
          ["Cozinha", "Somente painel da cozinha"],
          ["Expedição", "Pedidos prontos e atribuição de entregador"],
          ["Entregador", "Somente as próprias entregas"],
        ].map(([r, d]) => (
          <div key={r} className="py-3" style={{ borderBottom: `1px solid ${C.gray850}` }}>
            <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>{r}</div>
            <div style={{ color: "#8a8a8a", fontSize: 11.5, marginTop: 2 }}>{d}</div>
          </div>
        ))}
      </Card>

      <Card className="p-4">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14, marginBottom: 10 }}>Impressão</div>
        <div className="flex flex-wrap gap-2">
          {["Comanda da cozinha", "Comanda de expedição", "Cupom do cliente", "Etiqueta da sacola"].map((t) => (
            <Btn key={t} small variant="dark" onClick={() => store.toast(`Imprimindo: ${t}`)}>🖨 {t}</Btn>
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
  { id: "clientes", icon: "👥", label: "Clientes" },
  { id: "promos", icon: "🎟", label: "Promoções" },
  { id: "estoque", icon: "📦", label: "Estoque" },
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
        <div className="rounded-xl p-3" style={{ background: C.gray850 }}>
          <div style={{ color: "#8a8a8a", fontSize: 10.5 }}>Conectado como</div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 12.5 }}>Administrador</div>
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
        {sec === "clientes" && <AdminCustomers />}
        {sec === "promos" && <AdminPromos />}
        {sec === "estoque" && <AdminInventory store={store} />}
        {sec === "integracoes" && <AdminIntegrations store={store} />}
        {sec === "config" && <AdminSettings store={store} />}
      </main>
    </div>
  );
}
// ============================================================
// COZINHA — KDS
// ============================================================

function KitchenApp({ store, now }) {
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

                <div className="mt-3">
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
      <div className="flex items-center gap-3 mb-5">
        <Logo size={40} withText={false} />
        <div>
          <h2 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 24, color: C.white, letterSpacing: "-0.02em" }}>
            EXPEDIÇÃO
          </h2>
          <div style={{ color: "#7a7a7a", fontSize: 11.5 }}>{ready.length} aguardando saída · {rota.length} em rota</div>
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

              {o.type === "pickup" ? (
                <div className="mt-3">
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
                        {DRIVERS.map((d) => (
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
          {DRIVERS.map((d) => {
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
  const [me, setMe] = useState(DRIVERS[0].id);
  const driver = DRIVERS.find((d) => d.id === me);
  const mine = store.orders.filter((o) => o.driverId === me && ["ROTA", "ENTREGUE"].includes(o.status));
  const open = store.orders.filter((o) => o.status === "AGUARDANDO");

  return (
    <div style={{ background: C.black, minHeight: "100%" }} className="p-4 pb-10">
      <div className="flex items-center justify-between mb-4">
        <Logo size={38} withText={false} />
        <select
          value={me} onChange={(e) => setMe(e.target.value)}
          className="rounded-lg px-2.5 py-1.5 outline-none"
          style={{ background: C.gray850, color: C.white, border: `1px solid ${C.gray800}`, fontSize: 12 }}
        >
          {DRIVERS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <h2 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 26, color: C.white, letterSpacing: "-0.02em" }}>
        🛵 MINHAS ENTREGAS
      </h2>
      <div style={{ color: "#7a7a7a", fontSize: 12, marginBottom: 16 }}>
        {driver.name} · {mine.filter((o) => o.status === "ROTA").length} em rota hoje
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
                <div className="mt-3"><Btn full onClick={() => store.assignDriver(o.id, me)}>ACEITAR ENTREGA</Btn></div>
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
// ============================================================

const ROLES = [
  { id: "cliente", label: "Cliente", icon: "🍔" },
  { id: "admin", label: "Admin", icon: "📊" },
  { id: "cozinha", label: "Cozinha", icon: "🔥" },
  { id: "expedicao", label: "Expedição", icon: "📦" },
  { id: "entregador", label: "Entregador", icon: "🛵" },
];

export default function App() {
  const [role, setRole] = useState("cliente");
  const [tab, setTab] = useState("inicio");
  const [orders, setOrders] = useState(seedOrders);
  const [products, setProducts] = useState(PRODUCTS);
  const [inventory, setInventory] = useState(INVENTORY);
  const [cart, setCart] = useState([]);
  const [coupon, setCoupon] = useState(null);
  const [myOrderId, setMyOrderId] = useState(null);
  const [open, setOpen] = useState(true);
  const [toastMsg, setToastMsg] = useState("");
  const [confetti, setConfetti] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const toast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2200);
  };

  const notify = (msg) => {
    setNotifications((n) => [{ id: uid(), msg, at: Date.now() }, ...n].slice(0, 20));
  };

  const store = {
    role, tab, setTab, orders, products, inventory, cart, coupon, setCoupon,
    myOrderId, open, setOpen, notifications, toast,

    addItem: (item) => setCart((c) => [...c, item]),
    removeItem: (id) => setCart((c) => c.filter((i) => i.id !== id)),
    setQty: (id, qty) =>
      setCart((c) => (qty <= 0 ? c.filter((i) => i.id !== id) : c.map((i) => (i.id === id ? { ...i, qty } : i)))),

    placeOrder: (order) => {
      setOrders((o) => [order, ...o]);
      setCart([]); setCoupon(null); setMyOrderId(order.id); setTab("pedidos");
      setConfetti(true); setTimeout(() => setConfetti(false), 2600);
      notify(`Novo pedido #${order.code} · ${brl(order.total)}`);
      beep(1040);
      toast(`Pedido #${order.code} enviado para a cozinha`);
      // Simula o webhook do gateway confirmando o Pix.
      setTimeout(() => {
        setOrders((os) => os.map((x) => (x.id === order.id && x.status === "NOVO" ? { ...x, status: "CONFIRMADO" } : x)));
      }, 4000);
    },

    setStatus: (id, status) =>
      setOrders((os) =>
        os.map((o) => {
          if (o.id !== id) return o;
          if (status === "PREPARO") notify(`Pedido #${o.code} entrou na chapa`);
          if (status === "PRONTO") { notify(`Pedido #${o.code} está pronto`); beep(760); }
          if (status === "ENTREGUE") notify(`Pedido #${o.code} entregue`);
          return { ...o, status, startedAt: o.startedAt || Date.now() };
        })
      ),

    advance: (id) =>
      setOrders((os) =>
        os.map((o) => {
          if (o.id !== id) return o;
          const i = FLOW.indexOf(o.status);
          const next = FLOW[i + 1] || o.status;
          return { ...o, status: next, startedAt: o.startedAt || Date.now() };
        })
      ),

    assignDriver: (id, driverId) => {
      setOrders((os) => os.map((o) => (o.id === id ? { ...o, driverId, status: "ROTA", startedAt: Date.now() } : o)));
      const d = DRIVERS.find((x) => x.id === driverId);
      toast(`${d.name} saiu para entrega`);
      notify(`${d.name} saiu para entrega`);
    },

    updateProduct: (id, patch) => setProducts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p))),

    moveStock: (id, delta) =>
      setInventory((inv) =>
        inv.map((i) => {
          if (i.id !== id) return i;
          const qty = Math.max(0, Math.round((i.qty + delta) * 10) / 10);
          if (qty <= i.min && i.qty > i.min) notify(`⚠️ Estoque baixo: ${i.name}`);
          return { ...i, qty };
        })
      ),

    injectExternal: (channel) => {
      const pool = products.filter((p) => p.available && !p.builder);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const names = ["Tiago Ramos", "Juliana Melo", "Diego Alves", "Camila Rocha"];
      const order = makeOrder({
        channel,
        customer: {
          name: names[Math.floor(Math.random() * names.length)],
          phone: "(81) 9" + Math.floor(10000000 + Math.random() * 89999999),
          addr: "Rua Projetada, 100 — Janga, Paulista/PE",
        },
        items: [{ id: uid(), productId: pick.id, name: pick.name, emoji: pick.emoji, qty: 1, unit: pick.promo || pick.price, opts: [], note: "" }],
        payment: channel === "IFOOD" ? "Cartão (iFood)" : "Cartão (99Food)",
      });
      setOrders((o) => [order, ...o]);
      notify(`Novo pedido ${CHANNELS[channel].label} #${order.code}`);
      beep(620);
      toast(`Pedido #${order.code} recebido do ${CHANNELS[channel].label}`);
    },
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;600;700;800;900&display=swap');
    @keyframes sarrofall { to { transform: translateY(105vh) rotate(720deg); opacity: 0 } }
    @keyframes sarropulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
    .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    ::-webkit-scrollbar { height: 6px; width: 6px }
    ::-webkit-scrollbar-thumb { background: #2d2d2d; border-radius: 9px }
    button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${C.yellow}; outline-offset: 2px }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important } }
  `;

  return (
    <div style={{ background: C.black, minHeight: "100vh", fontFamily: font.body, color: C.white }}>
      <style>{css}</style>

      <div
        className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto"
        style={{ background: C.gray900, borderBottom: `1px solid ${C.gray800}`, position: "sticky", top: 0, zIndex: 40 }}
      >
        <span style={{ color: "#5a5a5a", fontSize: 10, fontWeight: 800, marginRight: 4, whiteSpace: "nowrap" }}>VER COMO</span>
        {ROLES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRole(r.id)}
            className="shrink-0 rounded-lg px-2.5 py-1.5 font-bold"
            style={{
              background: role === r.id ? `linear-gradient(100deg, ${C.orange}, ${C.yellow})` : "transparent",
              color: role === r.id ? C.black : "#8a8a8a",
              border: `1px solid ${role === r.id ? "transparent" : C.gray800}`, fontSize: 11.5, whiteSpace: "nowrap",
            }}
          >
            {r.icon} {r.label}
          </button>
        ))}
      </div>

      {role === "cliente" && <ClientApp store={store} now={now} />}
      {role === "admin" && <AdminApp store={store} now={now} />}
      {role === "cozinha" && <KitchenApp store={store} now={now} />}
      {role === "expedicao" && <ExpeditionApp store={store} now={now} />}
      {role === "entregador" && <DriverApp store={store} now={now} />}

      <Toast msg={toastMsg} />
      <Confetti on={confetti} />
    </div>
  );
}

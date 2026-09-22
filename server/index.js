// ============================================================
// TÔ NO SARRO — API REST + WebSocket (servidor único)
//
//   npm run dev:server   → http://localhost:3001
//   npm run dev:all      → API + Vite juntos
//   npm run build && npm start → produção (serving do dist/)
//
// Autenticação por sessão em cookie httpOnly; permissões por papel;
// preços e totais SEMPRE recalculados no servidor.
// ============================================================

import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import bcrypt from "bcryptjs";
import http from "node:http";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

import {
  db, audit, seedIfEmpty,
  getProducts, getOptionGroups, getBuilder, getCategories, getCoupons,
  getDrivers, getCustomers, getInventory, getPromos, getSettings,
  getSetting, setSetting, getOrders, getPaymentSettings, getUsers,
  logIntegration, enqueueWhatsApp, markOutbox, getOutbox, getIntegrationLogs,
  getCurrentCashRegister, openCashRegister, addCashTransaction, closeCashRegister, getCashHistory,
  dispatchMultiStopRoute, getDriverPendingSettlement, settleDriver, getSettlementsHistory,
  getOrderPayments, addOrderPayment, getWaiterReport, getLowStockAlerts, getLoyaltyPoints, addLoyaltyPoints,
} from "./db.js";
import { attachUser, requireRole, login, logout, logoutAll, refreshSession, publicUser, ROLES } from "./auth.js";
import { createCheckoutLink, paymentCheck, cents } from "./payments/infinitepay.js";
import { generatePixBRCode } from "./payments/pix.js";
import { validateOrder } from "./schemas/orders.js";
import { validateSettings } from "./schemas/settings.js";
import { validateProduct } from "./schemas/products.js";
import { optimizeDeliveryRoute } from "./routing/osrm.js";
import { logger, requestLogger, setupErrorHandlers } from "./observability/logger.js";
import { xssSanitizer } from "./utils/sanitize.js";
import { waCredentials, normalizePhone, buildOrderMessage, sendWhatsApp } from "./messaging/whatsapp.js";
import * as ifood from "./integrations/ifood.js";
import * as escpos from "./printing/escpos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
setupErrorHandlers();

// Rate limiter simples em memória para rotas públicas
const rateBuckets = new Map();
function rateLimit({ windowMs = 60000, max = 20, key = (req) => req.ip } = {}) {
  return (req, res, next) => {
    const k = `${key(req)}:${req.path}`;
    const now = Date.now();
    let bucket = rateBuckets.get(k);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      rateBuckets.set(k, bucket);
    }
    bucket.count++;
    if (bucket.count > max) {
      const retry = Math.ceil((bucket.start + windowMs - now)/1000);
      res.setHeader("Retry-After", retry);
      return res.status(429).json({ error: "Muitas requisições. Tente novamente em instantes." });
    }
    next();
  };
}
// limpeza periódica
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of rateBuckets) if (now - b.start > 60000*5) rateBuckets.delete(k);
}, 60000).unref?.();

// Idempotency keys persistidos em DB para evitar duplicação de pedidos ao recarregar
// Fallback em memória se tabela ainda não existir (durante migração)
const idempotencyMemory = new Map();
function idempotencyMiddleware(req, res, next) {
  const key = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];
  if (!key) return next();
  
  // Sanitiza key
  const cleanKey = String(key).slice(0, 100).replace(/[^a-zA-Z0-9-_]/g, "");
  if (!cleanKey) return next();
  
  try {
    // Tenta buscar no DB
    const row = db.prepare("SELECT * FROM idempotency_keys WHERE key = ?").get(cleanKey);
    if (row) {
      if (Date.now() - row.created_at < 24*60*60*1000) {
        try {
          const body = JSON.parse(row.body);
          return res.status(row.status).json(body);
        } catch {
          // se falhar parse, apaga
          db.prepare("DELETE FROM idempotency_keys WHERE key = ?").run(cleanKey);
        }
      } else {
        db.prepare("DELETE FROM idempotency_keys WHERE key = ?").run(cleanKey);
      }
    }
  } catch (e) {
    // Tabela pode não existir ainda, usa memória como fallback
    const existing = idempotencyMemory.get(cleanKey);
    if (existing && Date.now() - existing.createdAt < 24*60*60*1000) {
      return res.status(existing.status).json(existing.body);
    }
  }
  
  // Intercepta res.json para cachear
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 400) {
      try {
        db.prepare("INSERT INTO idempotency_keys (key, status, body, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET status=excluded.status, body=excluded.body, created_at=excluded.created_at")
          .run(cleanKey, res.statusCode, JSON.stringify(body), Date.now());
        // limpeza periódica de chaves antigas
        if (Math.random() < 0.05) {
          db.prepare("DELETE FROM idempotency_keys WHERE created_at < ?").run(Date.now() - 24*60*60*1000);
        }
      } catch (e) {
        // fallback memória
        idempotencyMemory.set(cleanKey, {
          status: res.statusCode,
          body,
          createdAt: Date.now(),
        });
        if (idempotencyMemory.size > 1000) {
          const first = idempotencyMemory.keys().next().value;
          idempotencyMemory.delete(first);
        }
      }
    }
    return originalJson(body);
  };
  next();
}

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";
// Versão exibida no app (diagnóstico: confirma qual build está rodando)
const APP_VERSION = process.env.APP_VERSION || (() => {
  try { return execSync("git rev-parse --short HEAD", { cwd: path.join(__dirname, "..") }).toString().trim(); }
  catch { return "dev"; }
})();

seedIfEmpty();

const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://api.qrserver.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:", "https://api.qrserver.com"],
      connectSrc: ["'self'", "ws:", "wss:", "https://router.project-osrm.org", "https://nominatim.openstreetmap.org", "https://api.qrserver.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));
app.disable("x-powered-by");
// Atrás de proxy com TLS (Render, Nginx etc.): req.secure reflete o https real
app.set("trust proxy", 1);

// Health check do Render — sem DB, pra o probe não cair se o SQLite estiver ocupado
app.get("/healthz", (_req, res) => res.status(200).type("text").send("ok"));

app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());

// Headers de segurança básicos.
// No Render (RENDER=true) bloqueia iframe (anti-clickjacking).
// Fora dele (preview/dev) o iframe da plataforma precisa embutir o app —
// senão a tela fica preta no preview.
const embeddable = process.env.RENDER !== "true";
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!embeddable) res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' https://cdn.tailwindcss.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' ws: wss:",
      embeddable ? "frame-ancestors *" : "frame-ancestors 'none'",
      "base-uri 'self'",
    ].join("; ")
  );
  if (req.secure || (process.env.APP_BASE_URL || "").startsWith("https://") || process.env.SECURE_COOKIE === "1") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(requestLogger);
app.use(xssSanitizer);
app.use(attachUser);

// ------------------------------------------------------------
// WebSocket — snapshot completo a cada mudança (simples e à prova
// de dessincronização; quando o volume crescer, trocamos por diffs)
// ------------------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

function snapshot() {
  return {
    orders: getOrders(),
    products: getProducts(),
    inventory: getInventory(),
    drivers: getDrivers(),
    customers: getCustomers(),
    settings: getSettings(),
    promos: getPromos(),
    coupons: getCoupons(),
    cashRegister: getCurrentCashRegister(),
  };
}

// Snapshot público (visitante anônimo): só o cardápio e a loja.
// Pedidos, clientes (CRM), estoque e entregadores nunca saem sem login.
function publicSnapshot() {
  return {
    orders: [],
    products: getProducts(),
    inventory: [],
    drivers: [],
    customers: [],
    settings: getSettings(),
    promos: getPromos(),
    coupons: getCoupons(),
  };
}

function broadcast() {
  const pub = JSON.stringify({ type: "sync", data: publicSnapshot() });
  const full = JSON.stringify({ type: "sync", data: snapshot() });
  for (const c of wss.clients) {
    if (c.readyState === 1) c.send(c.isStaff ? full : pub);
  }
}

// ------------------------------------------------------------
// WhatsApp — enfileira e tenta enviar a mensagem de status
// ------------------------------------------------------------
function staffSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function fireWhatsApp(order, event, extra = {}) {
  try {
    const st = staffSettings();
    const wa = waCredentials(st);
    if (!wa.enabled) return;
    const to = normalizePhone(order.customer?.phone);
    const text = buildOrderMessage(event, order, extra);
    if (!to) {
      logIntegration("whatsapp", "erro", `Telefone inválido no pedido #${order.code}: ${order.customer?.phone}`);
      return;
    }
    const mid = enqueueWhatsApp({ to, event, body: text, code: order.code });
    if (!wa.phoneId || !wa.token) return; // fica na fila até configurar credenciais
    sendWhatsApp({ phoneId: wa.phoneId, token: wa.token }, to, wa.template, text)
      .then(() => {
        markOutbox(mid, "enviada", null);
        logIntegration("whatsapp", "ok", `Mensagem "${event}" enviada para ${to} (pedido #${order.code})`);
      })
      .catch((e) => {
        markOutbox(mid, "erro", e.message);
        logIntegration("whatsapp", "erro", `Falha ao enviar "${event}" (pedido #${order.code}): ${e.message}`);
      });
  } catch (e) {
    logIntegration("whatsapp", "erro", e.message);
  }
}

const WA_EVENTS = { PREPARO: "preparo", PRONTO: "pronto", ROTA: "rota", ENTREGUE: "entregue" };

// Espelha mudanças de status internas para o iFood quando o pedido veio de lá
function mirrorToIfood(order, status) {
  if (order.channel !== "IFOOD" || !order.ext_ref) return;
  const st = staffSettings();
  if (st.ifood_enabled !== "1" || !st.ifood_client_id || !st.ifood_client_secret) return;
  const creds = { clientId: st.ifood_client_id, clientSecret: st.ifood_client_secret };
  const actions = [];
  if (status === "CONFIRMADO") actions.push(() => ifood.confirmOrder(creds, order.ext_ref));
  if (status === "PRONTO" || status === "EMBALADO") actions.push(() => ifood.readyToPickup(creds, order.ext_ref));
  if (status === "ROTA") actions.push(() => ifood.dispatchOrder(creds, order.ext_ref));
  for (const fn of actions) {
    fn().then(() => logIntegration("ifood", "ok", `Status "${status}" espelhado para o iFood (${order.ext_ref})`))
      .catch((e) => logIntegration("ifood", "erro", `Espelhar "${status}" (${order.ext_ref}): ${e.message}`));
  }
}

server.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url, "http://localhost");
  if (pathname === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws, wreq) => {
      // Staff (sessão válida no cookie) recebe o snapshot completo;
      // anônimos recebem só o cardápio, sem dados de pedidos/clientes.
      const m = /(?:^|;\s*)sarro_session=([^;]+)/.exec(wreq.headers.cookie || "");
      ws.isStaff = false;
      if (m) {
        const u = db
          .prepare("SELECT u.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND u.active = 1")
          .get(m[1]);
        ws.isStaff = !!u;
      }
      wss.emit("connection", ws, wreq);
    });
  } else {
    socket.destroy();
  }
});

// ------------------------------------------------------------
// AUTH
// ------------------------------------------------------------
app.post("/api/auth/login", rateLimit({ windowMs: 60000, max: 8, key: (req) => req.body?.username || req.ip }), login);
app.post("/api/auth/logout", logout);
app.post("/api/auth/logout-all", requireRole("ADMIN", "GERENTE", "ATENDIMENTO", "COZINHA", "EXPEDICAO", "ENTREGADOR"), logoutAll);
app.post("/api/auth/refresh", refreshSession);
app.get("/api/auth/me", (req, res) => res.json({ user: publicUser(req.user) }));

// ------------------------------------------------------------
// BOOTSTRAP — tudo que o app precisa em uma chamada
// ------------------------------------------------------------
app.get("/api/health", (req, res) => {
  try {
    const dbOk = db.prepare("SELECT 1 as ok").get()?.ok === 1;
    const migrations = db.prepare("SELECT COUNT(*) as c FROM migrations").get()?.c ?? 0;
    res.json({
      ok: true,
      status: "healthy",
      version: APP_VERSION,
      uptime: process.uptime(),
      db: dbOk ? "ok" : "fail",
      migrations,
      timestamp: Date.now(),
    });
  } catch (e) {
    res.status(500).json({ ok: false, status: "unhealthy", error: e.message });
  }
});

app.get("/api/bootstrap", (req, res) => {
  res.json({
    ...(req.user ? snapshot() : publicSnapshot()),
    categories: getCategories(),
    optionGroups: getOptionGroups(),
    builder: getBuilder(),
    me: publicUser(req.user),
    version: APP_VERSION,
  });
});

// ------------------------------------------------------------
// CUPONS
// ------------------------------------------------------------
app.post("/api/coupons/validate", (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  const subtotal = Number(req.body?.subtotal) || 0;
  const c = db.prepare("SELECT * FROM coupons WHERE code = ? AND active = 1").get(code);
  if (!c) return res.status(404).json({ error: "Cupom não encontrado ou expirado." });
  if (subtotal < c.min) {
    return res.status(400).json({ error: `Esse cupom vale a partir de R$ ${c.min.toFixed(2).replace(".", ",")}.` });
  }
  res.json({ coupon: { code: c.code, type: c.type, value: c.value, min: c.min, note: c.note } });
});

// ------------------------------------------------------------
// PEDIDOS — listagem com paginação e filtro por mesa
// ------------------------------------------------------------
app.get("/api/orders", requireRole("ADMIN","GERENTE","ATENDIMENTO","COZINHA","EXPEDICAO","ENTREGADOR"), (req, res) => {
  const { limit, offset, tableNumber, table_number, status, type } = req.query;
  const tn = tableNumber ?? table_number;
  const orders = getOrders({
    limit: limit || 50,
    offset: offset || 0,
    tableNumber: tn,
    status,
    type,
  });
  res.json({ orders, count: orders.length });
});

// ------------------------------------------------------------
// PEDIDOS
// ------------------------------------------------------------

// Tabela de preços “verdade”: produtos + opções + builder
function priceTable() {
  const t = new Map();
  for (const o of db.prepare("SELECT o.id, o.name, o.price, o.group_id FROM options o").all()) {
    t.set(o.id, { ...o, builder: false });
  }
  for (const o of db.prepare("SELECT id, name, price, group_id FROM builder_options").all()) {
    t.set(o.id, { ...o, builder: true });
  }
  return t;
}

const BUILDER_GROUPS = new Set(["pao", "carne", "queijoB", "molhoB"]);

function parseOrderItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 60) {
    throw new Error("Carrinho vazio ou inválido.");
  }
  const prices = priceTable();
  const products = new Map(getProducts().map((p) => [p.id, p]));
  let subtotal = 0;
  const cleanItems = [];

  for (const it of items) {
    const p = products.get(String(it.productId));
    if (!p || !p.available) throw new Error(`Produto indisponível: ${it.productId}`);
    const qty = Math.floor(Number(it.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 20) throw new Error(`Quantidade inválida em ${p?.name || "item"}.`);
    if (typeof (it.note ?? "") !== "string" || (it.note ?? "").length > 140) {
      throw new Error(`Observação muito longa em ${p.name}.`);
    }

    const optIds = Array.isArray(it.optionIds) ? it.optionIds.slice(0, 12).map(String) : [];
    const opts = [];
    let extra = 0;

    if (p.builder) {
      const byGroup = new Map();
      for (const oid of optIds) {
        const o = prices.get(oid);
        if (!o || !o.builder) throw new Error(`Opção inválida (${oid}) em ${p.name}.`);
        byGroup.set(o.group_id, o);
      }
      for (const gid of BUILDER_GROUPS) {
        const o = byGroup.get(gid);
        if (!o) throw new Error(`Escolha incompleta em ${p.name}.`);
        extra += o.price;
        opts.push({ id: o.id, name: o.name, price: o.price });
      }
    } else {
      const allowed = new Set(p.groups);
      for (const oid of optIds) {
        const o = prices.get(oid);
        if (!o || o.builder || !allowed.has(o.group_id)) {
          throw new Error(`Adicional inválido (${oid}) em ${p.name}.`);
        }
        extra += o.price;
        opts.push({ id: o.id, name: o.name, price: o.price });
      }
    }

    const unit = Math.max(0, (p.promo ?? p.price) + extra);
    subtotal += unit * qty;
    cleanItems.push({
      id: crypto.randomUUID(), productId: p.id, name: p.name, emoji: p.emoji,
      qty, unit: Math.round(unit * 100) / 100, opts, note: it.note || "",
    });
  }
  return { subtotal, cleanItems };
}

function shapeOrder(o) {
  return o; // getOrders() já devolve o formato do frontend
}

app.post("/api/orders", idempotencyMiddleware, rateLimit({ windowMs: 60000, max: 15, key: (req) => req.body?.customer?.phone || req.ip }), (req, res) => {
  const rawBody = req.body || {};
  const settings = getSettings();
  const isStaffChannel = ["IFOOD", "NNFOOD", "WHATSAPP"].includes(rawBody.channel);
  if (isStaffChannel && !req.user) {
    return res.status(401).json({ error: "Canais externos exigem autenticação." });
  }

  if (!isStaffChannel && !settings.open) {
    return res.status(409).json({ error: "A loja está fechada agora. Voltamos às 18h!" });
  }

  let body;
  try {
    body = validateOrder(rawBody);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const { customer = {}, items = [], type = "delivery", payment = "PIX", couponCode, note = "", tableNumber: bodyTableNumber, tableName: bodyTableName } = body;
  const name = String(customer.name || "").trim();
  const phone = String(customer.phone || "").trim();
  const addr = String(customer.addr || "").trim();

  if (type === "delivery" && addr.length < 8) return res.status(400).json({ error: "Informe o endereço de entrega." });

  let parsed;
  try {
    parsed = parseOrderItems(items);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const { subtotal, cleanItems } = parsed;

  // Pedido mínimo (só delivery)
  if (type === "delivery" && subtotal < settings.minOrder) {
    return res.status(400).json({ error: `Pedido mínimo de R$ ${settings.minOrder.toFixed(2).replace(".", ",")} para entrega.` });
  }

  // Cupom
  let discount = 0;
  let fee = (type === "pickup" || type === "dine_in" || type === "mesa") ? 0 : settings.fee;
  let coupon = null;
  if (couponCode) {
    const c = db.prepare("SELECT * FROM coupons WHERE code = ? AND active = 1").get(String(couponCode).toUpperCase());
    if (!c || subtotal < c.min) return res.status(400).json({ error: "Cupom inválido para este pedido." });
    coupon = c;
    if (c.type === "percent") discount = subtotal * (c.value / 100);
    if (c.type === "fixed") discount = c.value;
    if (c.type === "freeship") fee = 0;
    discount = Math.min(discount, subtotal);
  }

  const total = Math.max(0, subtotal + fee - discount);
  const code = (parseInt(getSetting("seq") || "1047", 10) || 1047) + 1;
  setSetting("seq", code);

  const id = crypto.randomUUID();
  const now = Date.now();
  const channel = isStaffChannel ? body.channel : "DIRECT";
  const paymentLabel = (payment === "CARTAO_ONLINE" ? "Cartão online" : payment)
    + (/^Dinheiro/.test(payment) && body.changeFor ? ` (troco p/ ${String(body.changeFor).slice(0, 20)})` : "");

  const onlinePay = ["PIX", "CARTAO_ONLINE"].includes(payment);
  const paymentStatus = onlinePay ? "pendente" : "na_entrega";

  // Token de capability: só quem criou o pedido (e o staff) consegue acompanhá-lo
  const trackToken = crypto.randomBytes(12).toString("hex");

  // Extrai número da mesa para campo dedicado (robustez para filtro)
  let tableNumber = bodyTableNumber ?? null;
  let tableName = bodyTableName ?? null;
  if (type === "dine_in" || type === "mesa" || /^Mesa\s*\d+/i.test(addr) || /^Mesa\s*\d+/i.test(name) || tableNumber) {
    const extractNum = (s) => {
      const m = String(s || "").match(/Mesa\s*0?(\d+)/i);
      return m ? parseInt(m[1], 10) : null;
    };
    tableNumber = tableNumber ?? extractNum(addr) ?? extractNum(name) ?? extractNum(tableName);
    if (tableNumber) {
      tableName = tableName || `Mesa ${String(tableNumber).padStart(2, "0")}`;
    } else if (/^Mesa\s*\d+/i.test(addr)) {
      tableName = tableName || addr.split("·")[0].trim();
    }
  }

  db.exec("BEGIN");
  try {
    db.prepare(`
      INSERT INTO orders (id, code, channel, status, created_at, customer_name, customer_phone, customer_addr, payment, type, note, subtotal, fee, discount, total, payment_status, track_token, table_number, table_name)
      VALUES (?, ?, ?, 'NOVO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, code, channel, now, name, phone, type === "pickup" ? "Retirada na loja" : addr,
      paymentLabel, type, note, subtotal, fee, discount, total, paymentStatus, trackToken, tableNumber, tableName);

    const insItem = db.prepare("INSERT INTO order_items (id, order_id, product_id, name, emoji, qty, unit, opts, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const it of cleanItems) {
      insItem.run(it.id, id, it.productId, it.name, it.emoji, it.qty, it.unit, JSON.stringify(it.opts), it.note);
    }
    if (coupon) db.prepare("UPDATE coupons SET uses = uses + 1 WHERE code = ?").run(coupon.code);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    console.error("[orders] falha ao gravar:", e);
    return res.status(500).json({ error: "Não conseguimos registrar o pedido. Tente novamente." });
  }

  // CRM: atualiza ou cria cliente + pontos de fidelidade
  const digits = phone.replace(/\D/g, "");
  const existing = db.prepare("SELECT * FROM customers WHERE REPLACE(REPLACE(phone,'(',''),')','') LIKE ?").get(`%${digits.slice(-8)}%`);
  const gained = Math.floor(total / 10);
  if (existing) {
    const spent = existing.spent + total;
    const tier = spent >= 500 ? "VIP" : existing.orders + 1 >= 2 ? "Recorrente" : "Novo";
    db.prepare("UPDATE customers SET orders = orders + 1, spent = ?, last = 'Hoje', tier = ?, points = points + ? WHERE id = ?")
      .run(spent, tier, gained, existing.id);
  } else {
    db.prepare("INSERT INTO customers (id, name, phone, orders, spent, last, tier, addr, points) VALUES (?, ?, ?, 1, ?, 'Hoje', 'Novo', ?, ?)")
      .run(crypto.randomUUID(), name, phone, total, addr, gained);
  }

  audit(req.user?.username || name, "pedido_criado", `#${code} · ${channel} · R$ ${total.toFixed(2)}`);
  broadcast();

  const created = getOrders().find((o) => o.id === id);
  if (created) {
    fireWhatsApp(created, "recebido");
    if (!onlinePay) autoPrintKitchen(created);
  }
  res.status(201).json({ order: { ...shapeOrder(created), trackToken } });
});

// Simulação de pedido externo (iFood/99Food/WhatsApp) — staff
app.post("/api/orders/external", requireRole("ADMIN", "GERENTE", "ATENDIMENTO", "EXPEDICAO"), (req, res) => {
  const channel = ["IFOOD", "NNFOOD", "WHATSAPP"].includes(req.body?.channel) ? req.body.channel : "IFOOD";
  const pool = getProducts().filter((p) => p.available && !p.builder);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const names = ["Tiago Ramos", "Juliana Melo", "Diego Alves", "Camila Rocha"];
  const name = names[Math.floor(Math.random() * names.length)];
  const code = (parseInt(getSetting("seq") || "1047", 10) || 1047) + 1;
  setSetting("seq", code);

  const unit = pick.promo ?? pick.price;
  const id = crypto.randomUUID();
  const fee = 7.9;
  db.prepare(`
    INSERT INTO orders (id, code, channel, status, created_at, customer_name, customer_phone, customer_addr, payment, type, subtotal, fee, discount, total)
    VALUES (?, ?, ?, 'NOVO', ?, ?, ?, ?, ?, 'delivery', ?, ?, 0, ?)
  `).run(id, code, channel, Date.now(), name,
    "(81) 9" + Math.floor(10000000 + Math.random() * 89999999),
    "Rua Projetada, 100 — Janga, Paulista/PE",
    channel === "IFOOD" ? "Cartão (iFood)" : channel === "NNFOOD" ? "Cartão (99Food)" : "PIX",
    unit, fee, unit + fee);
  db.prepare("INSERT INTO order_items (id, order_id, product_id, name, emoji, qty, unit, opts, note) VALUES (?, ?, ?, ?, ?, 1, ?, '[]', '')")
    .run(crypto.randomUUID(), id, pick.id, pick.name, pick.emoji, unit);

  audit(req.user.username, "pedido_externo", `#${code} · ${channel}`);
  broadcast();
  res.status(201).json({ order: getOrders().find((o) => o.id === id) });
});

const VALID_STATUS = new Set(["NOVO", "CONFIRMADO", "PREPARO", "PRONTO", "EMBALADO", "AGUARDANDO", "ROTA", "ENTREGUE", "CANCELADO"]);

app.patch("/api/orders/:id/status", requireRole("ADMIN", "GERENTE", "ATENDIMENTO", "COZINHA", "EXPEDICAO", "ENTREGADOR"), (req, res) => {
  const { status, payment: newPayment } = req.body || {};
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
  if (!VALID_STATUS.has(status)) return res.status(400).json({ error: "Status inválido." });

  // REGRA DE MESA: só pode dar baixa (ENTREGUE) quando paga no módulo Mesas
  // Se pedido é de mesa e ainda está "No fechamento da mesa", bloqueia ENTREGUE fora do fluxo de pagamento
  const isMesaOrder = o.table_number != null || o.type === "dine_in" || o.type === "mesa" || /^Mesa\s*\d+/i.test(o.customer_addr || "") || /^Mesa\s*\d+/i.test(o.customer_name || "");
  const currentPayment = o.payment || "";
  const incomingPayment = typeof newPayment === "string" ? newPayment.trim() : "";
  const willStillBeNoFechamento = !incomingPayment || incomingPayment === "No fechamento da mesa";
  
  if (isMesaOrder && status === "ENTREGUE" && currentPayment === "No fechamento da mesa" && willStillBeNoFechamento) {
    // Verifica se tem pagamentos parciais que cobrem total
    try {
      const payments = db.prepare("SELECT COALESCE(SUM(amount),0) as paid FROM order_payments WHERE order_id = ?").get(o.id);
      const paid = payments?.paid || 0;
      if (paid < o.total) {
        return res.status(400).json({ 
          error: "Mesa só pode dar baixa quando paga no módulo Mesas. Use Fechar Conta para registrar pagamento.",
          code: "MESA_NOT_PAID"
        });
      }
    } catch {
      // Se tabela order_payments não existir ou erro, bloqueia mesmo
      return res.status(400).json({ 
        error: "Mesa só pode dar baixa quando paga no módulo Mesas. Use Fechar Conta para registrar pagamento.",
        code: "MESA_NOT_PAID"
      });
    }
  }

  const role = req.user.role;
  if (role === "COZINHA" && !["PREPARO", "PRONTO", "CANCELADO"].includes(status)) {
    return res.status(403).json({ error: "A cozinha só pode iniciar preparo, marcar pronto ou cancelar." });
  }
  if (role === "ENTREGADOR") {
    if (!["ROTA", "ENTREGUE"].includes(status)) {
      return res.status(403).json({ error: "Entregador só pode sair para entrega e concluir." });
    }
    if (o.driver_id !== req.user.driver_id) {
      return res.status(403).json({ error: "Esta entrega não é sua." });
    }
  }

  const startedAt = o.started_at ?? (status !== "NOVO" ? Date.now() : null);
  // Para mesa com pagamento pendente "No fechamento da mesa", NÃO marca como pago automaticamente
  const isMesaWithPendingPayment = isMesaOrder && currentPayment === "No fechamento da mesa" && willStillBeNoFechamento;
  if (isMesaWithPendingPayment) {
    db.prepare("UPDATE orders SET status = ?, started_at = ? WHERE id = ?")
      .run(status, startedAt, o.id);
  } else {
    db.prepare("UPDATE orders SET status = ?, started_at = ?, payment_status = CASE WHEN payment_status = 'pendente' AND ? IN ('CONFIRMADO','PREPARO','PRONTO','EMBALADO','AGUARDANDO','ROTA','ENTREGUE') THEN 'pago' ELSE payment_status END WHERE id = ?")
      .run(status, startedAt, status, o.id);
  }

  if (typeof req.body?.payment === "string" && req.body.payment.trim()) {
    const newPay = req.body.payment.trim();
    // Se mudou de "No fechamento da mesa" para forma real, marca como pago
    if (currentPayment === "No fechamento da mesa" && newPay !== "No fechamento da mesa") {
      db.prepare("UPDATE orders SET payment = ?, payment_status = 'pago' WHERE id = ?").run(newPay, o.id);
    } else {
      db.prepare("UPDATE orders SET payment = ? WHERE id = ?").run(newPay, o.id);
    }
  }

  // contador do entregador
  if (status === "ENTREGUE" && o.driver_id) {
    db.prepare("UPDATE drivers SET status = 'livre', deliveries = deliveries + 1 WHERE id = ?").run(o.driver_id);
  }
  if (status === "ROTA" && o.driver_id) {
    db.prepare("UPDATE drivers SET status = 'em rota' WHERE id = ?").run(o.driver_id);
  }

  audit(req.user.username, "pedido_status", `#${o.code} → ${status}`);
  broadcast();
  const updated = getOrders().find((x) => x.id === o.id);
  if (updated) {
    if (WA_EVENTS[status]) {
      const driver = status === "ROTA" && updated.driverId
        ? db.prepare("SELECT name FROM drivers WHERE id = ?").get(updated.driverId)?.name
        : null;
      fireWhatsApp(updated, WA_EVENTS[status], { driver });
    }
    mirrorToIfood({ ...updated, ext_ref: o.ext_ref }, status);
  }
  res.json({ order: updated });
});

app.patch("/api/orders/:id/driver", requireRole("ADMIN", "GERENTE", "EXPEDICAO"), (req, res) => {
  const { driverId } = req.body || {};
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
  const d = db.prepare("SELECT * FROM drivers WHERE id = ?").get(String(driverId || ""));
  if (!d) return res.status(400).json({ error: "Entregador inválido." });

  db.prepare("UPDATE orders SET driver_id = ?, status = CASE WHEN status = 'AGUARDANDO' THEN 'ROTA' ELSE status END, started_at = COALESCE(started_at, ?) WHERE id = ?")
    .run(d.id, Date.now(), o.id);
  db.prepare("UPDATE drivers SET status = 'em rota' WHERE id = ?").run(d.id);

  audit(req.user.username, "pedido_entregador", `#${o.code} → ${d.name}`);
  broadcast();
  res.json({ order: getOrders().find((x) => x.id === o.id) });
});

// ============================================================
// ROTAS MULTI-PARADAS & DESPACHO EM LOTE
// ============================================================

app.post("/api/routes/dispatch", requireRole("ADMIN", "GERENTE", "ATENDIMENTO", "EXPEDICAO"), (req, res) => {
  const { driverId, orderIds } = req.body || {};
  try {
    const result = dispatchMultiStopRoute({ driverId, orderIds });
    audit(req.user.username, "rota_multi_despachada", `${result.driver.name} · ${result.count} entregas`);
    broadcast();
    res.json({ ok: true, routeId: result.routeId, count: result.count, orders: getOrders().filter((o) => orderIds.includes(o.id)) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/routes/optimize", requireRole("ADMIN", "GERENTE", "ATENDIMENTO", "EXPEDICAO"), async (req, res) => {
  const { orderIds } = req.body || {};
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return res.status(400).json({ error: "Selecione pedidos para otimizar." });
  }
  try {
    const allOrders = getOrders();
    const orders = allOrders.filter(o => orderIds.includes(o.id));
    if (orders.length === 0) return res.status(404).json({ error: "Nenhum pedido encontrado." });
    const settings = getSettings();
    const storeAddress = settings.address || "Av. Cláudio José Gueiros Leite, 3200 — Janga, Paulista/PE";
    const result = await optimizeDeliveryRoute(orders, storeAddress);
    audit(req.user.username, "rota_otimizada", `${orders.length} pedidos · ${result.optimized ? 'otimizada' : 'original'} · ${Math.round(result.distance||0)}m`);
    res.json(result);
  } catch (e) {
    console.error("[osrm] optimize erro:", e);
    res.status(500).json({ error: "Falha ao otimizar rota: " + e.message });
  }
});

// ============================================================
// SPLIT CONTA & PAGAMENTOS PARCIAIS (Sprint 6)
// ============================================================

app.get("/api/orders/:id/payments", requireRole("ADMIN", "GERENTE", "ATENDIMENTO"), (req, res) => {
  try {
    const payments = getOrderPayments(req.params.id);
    res.json({ payments });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

app.post("/api/orders/:id/payments", requireRole("ADMIN", "GERENTE", "ATENDIMENTO"), (req, res) => {
  const { personIndex, personName, method, amount } = req.body || {};
  try {
    const payments = addOrderPayment({
      orderId: req.params.id,
      personIndex: parseInt(personIndex)||0,
      personName,
      method: method || "Dinheiro",
      amount,
      createdBy: req.user.username,
    });
    audit(req.user.username, "pagamento_parcial", `${req.params.id} · ${personName||personIndex} · ${method} · R$ ${amount}`);
    broadcast();
    res.status(201).json({ payments });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch("/api/orders/:id/tip", requireRole("ADMIN", "GERENTE", "ATENDIMENTO"), (req, res) => {
  const { tipAmount, tipPercent, waiterName } = req.body || {};
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
  
  const tip = Math.max(0, parseFloat(tipAmount)||0);
  const percent = Math.max(0, Math.min(30, parseFloat(tipPercent)||0));
  
  db.prepare("UPDATE orders SET tip_amount = ?, tip_percent = ?, waiter_name = ? WHERE id = ?")
    .run(tip, percent, waiterName ? String(waiterName).slice(0,50) : order.waiter_name, order.id);
  
  audit(req.user.username, "gorjeta", `${req.params.id} · R$ ${tip} (${percent}%) · ${waiterName||""}`);
  broadcast();
  res.json({ ok: true, order: getOrders().find(o => o.id === req.params.id) });
});

// ============================================================
// RELATÓRIOS AVANÇADOS (Sprint 6)
// ============================================================

app.get("/api/reports/waiters", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const from = parseInt(req.query.from) || 0;
  const to = parseInt(req.query.to) || Date.now();
  try {
    const report = getWaiterReport(from, to);
    res.json({ report });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/reports/low-stock", requireRole("ADMIN", "GERENTE", "ATENDIMENTO", "COZINHA"), (req, res) => {
  try {
    const alerts = getLowStockAlerts();
    res.json({ alerts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/loyalty/:phone", requireRole("ADMIN", "GERENTE", "ATENDIMENTO"), (req, res) => {
  try {
    const data = getLoyaltyPoints(req.params.phone);
    if (!data) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// GEOCODING PERSISTIDO (Sprint 6)
// ============================================================

app.patch("/api/orders/:id/geo", requireRole("ADMIN", "GERENTE", "EXPEDICAO"), async (req, res) => {
  const { lat, lng } = req.body || {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "Lat/lng inválidos" });
  }
  try {
    db.prepare("UPDATE orders SET customer_lat = ?, customer_lng = ? WHERE id = ?").run(lat, lng, req.params.id);
    broadcast();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/orders/:id/geocode", requireRole("ADMIN", "GERENTE", "EXPEDICAO"), async (req, res) => {
  try {
    const order = getOrders().find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
    const { geocodeAddress } = await import("./routing/osrm.js");
    const geo = await geocodeAddress(order.customer?.addr || "");
    if (!geo) return res.status(404).json({ error: "Não foi possível geocodificar endereço" });
    db.prepare("UPDATE orders SET customer_lat = ?, customer_lng = ? WHERE id = ?").run(geo.lat, geo.lng, order.id);
    broadcast();
    res.json({ ok: true, lat: geo.lat, lng: geo.lng, display: geo.display });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ============================================================
// ACERTO DE CONTAS DO MOTOBOY
// ============================================================

app.get("/api/drivers/:id/settlement", requireRole("ADMIN", "GERENTE", "ATENDIMENTO", "EXPEDICAO", "ENTREGADOR"), (req, res) => {
  if (req.user.role === "ENTREGADOR" && req.user.driver_id !== req.params.id) {
    return res.status(403).json({ error: "Você só pode consultar o seu próprio acerto." });
  }
  try {
    const settlement = getDriverPendingSettlement(req.params.id);
    res.json({ settlement });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

app.post("/api/drivers/:id/settle", requireRole("ADMIN", "GERENTE", "ATENDIMENTO", "EXPEDICAO"), (req, res) => {
  const { basePay, notes } = req.body || {};
  try {
    const settled = settleDriver({
      driverId: req.params.id,
      settledBy: req.user.name || req.user.username || "Operador",
      basePay,
      notes,
    });
    audit(req.user.username, "acerto_motoboy_concluido", `${settled.driver?.name || "Entregador"} · ${settled.deliveries_count || settled.deliveriesCount || 0} entregas · Saldo: R$ ${settled.net_balance ?? settled.netBalance}`);
    broadcast();
    res.json({ ok: true, settlement: settled });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/settlements", requireRole("ADMIN", "GERENTE", "ATENDIMENTO", "EXPEDICAO"), (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "30", 10)));
  const settlements = getSettlementsHistory(limit);
  res.json({ settlements });
});

app.post("/api/orders/:id/items", requireRole("ADMIN", "GERENTE", "ATENDIMENTO", "COZINHA"), (req, res) => {
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
  if (["ENTREGUE", "CANCELADO"].includes(o.status)) {
    return res.status(400).json({ error: "Este pedido já foi finalizado ou cancelado." });
  }

  let parsed;
  try {
    parsed = parseOrderItems(req.body.items);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const { subtotal: addedSubtotal, cleanItems } = parsed;
  const insItem = db.prepare(`
    INSERT INTO order_items (id, order_id, product_id, name, emoji, qty, unit, opts, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const it of cleanItems) {
    insItem.run(it.id, o.id, it.productId, it.name, it.emoji, it.qty, it.unit, JSON.stringify(it.opts), it.note || "");
  }

  const newSubtotal = o.subtotal + addedSubtotal;
  const newTotal = o.total + addedSubtotal;
  const newStatus = ["PRONTO", "CONFIRMADO"].includes(o.status) ? "PREPARO" : o.status;

  db.prepare(`
    UPDATE orders
    SET subtotal = ?, total = ?, status = ?
    WHERE id = ?
  `).run(newSubtotal, newTotal, newStatus, o.id);

  audit(req.user.username, "pedido_itens_adicionados", `#${o.code} (+${cleanItems.length} itens, +R$ ${addedSubtotal.toFixed(2)})`);

  const fullOrder = getOrders().find((x) => x.id === o.id);
  if (fullOrder) {
    autoPrintKitchen({
      ...fullOrder,
      note: `[RODADA ADICIONAL] ${fullOrder.note || ""}`.trim(),
      items: cleanItems,
    });
  }

  broadcast();
  res.status(200).json({ ok: true, order: fullOrder, addedItems: cleanItems });
});

app.patch("/api/orders/:id/table", requireRole("ADMIN", "GERENTE", "ATENDIMENTO"), (req, res) => {
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
  if (["ENTREGUE", "CANCELADO"].includes(o.status)) {
    return res.status(400).json({ error: "Este pedido já foi finalizado ou cancelado." });
  }

  const nextTable = String(req.body?.table || "").trim();
  if (!nextTable) return res.status(400).json({ error: "Mesa de destino inválida." });

  let newName = o.customer_name;
  if (/^Mesa \d+/i.test(newName)) {
    newName = newName.replace(/^Mesa \d+/i, nextTable);
  } else {
    newName = `${nextTable} · ${newName}`;
  }

  const extractNum = (s) => {
    const m = String(s || "").match(/Mesa\s*0?(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  };
  const nextNum = extractNum(nextTable);
  const nextTableName = nextNum ? `Mesa ${String(nextNum).padStart(2, "0")}` : nextTable;

  db.prepare("UPDATE orders SET customer_addr = ?, customer_name = ?, table_number = ?, table_name = ? WHERE id = ?").run(nextTable, newName, nextNum, nextTableName, o.id);

  audit(req.user.username, "pedido_mesa_transferida", `#${o.code} (${o.customer_addr} → ${nextTable})`);
  broadcast();
  res.json({ ok: true, order: getOrders().find((x) => x.id === o.id) });
});

// ------------------------------------------------------------
// PAGAMENTO ONLINE — InfinitePay (Pix e Cartão)
// ------------------------------------------------------------

const ONLINE_PAYMENTS = new Set(["PIX", "Cartão online", "CARTAO_ONLINE"]);

function publicBaseUrl(req) {
  const ps = getPaymentSettings();
  if (ps.appBaseUrl) return ps.appBaseUrl;
  return (req.protocol || "http") + "://" + (req.get("host") || "localhost:3001");
}

function confirmPayment(orderId, { slug, transactionNsu, captureMethod, paidAmount, receiptUrl } = {}) {
  const now = Date.now();
  db.prepare(`
    UPDATE payments SET status = 'pago', paid_at = ?,
      invoice_slug = COALESCE(?, invoice_slug),
      transaction_nsu = COALESCE(?, transaction_nsu),
      capture_method = COALESCE(?, capture_method),
      paid_amount = COALESCE(?, paid_amount),
      receipt_url = COALESCE(?, receipt_url)
    WHERE order_id = ?
  `).run(now, slug ?? null, transactionNsu ?? null, captureMethod ?? null, paidAmount ?? null, receiptUrl ?? null, orderId);
  db.prepare(`
    UPDATE orders SET payment_status = 'pago',
      status = CASE WHEN status = 'NOVO' THEN 'CONFIRMADO' ELSE status END
    WHERE id = ?
  `).run(orderId);
  broadcast();
  const paid = getOrders().find((x) => x.id === orderId);
  if (paid) {
    fireWhatsApp(paid, "pagamento_ok");
    autoPrintKitchen(paid);
  }
}

// Gera (ou reaproveita) o link de pagamento do pedido e payload do Pix Dinâmico
app.post("/api/orders/:id/pay", async (req, res) => {
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
  if (o.track_token && o.track_token !== req.query.t) return res.status(403).json({ error: "Link de pagamento inválido." });
  const isOnline = ONLINE_PAYMENTS.has(o.payment) || (typeof o.payment === "string" && o.payment.toUpperCase().includes("PIX"));
  if (!isOnline) {
    return res.status(400).json({ error: "Este pedido não é pagamento online." });
  }
  if (o.payment_status === "pago") return res.json({ paid: true, paymentStatus: "pago" });

  const ps = getPaymentSettings();
  const settings = getSettings();
  const pixKey = ps.pixKey || settings.pixKey || settings.whatsapp || "tonosarro@gmail.com";
  const pixCode = generatePixBRCode({
    key: pixKey,
    name: settings.storeName || "TO NO SARRO",
    city: "PAULISTA",
    amount: o.total,
    txid: `PED${o.code}`,
  });

  // Reaproveita link pendente para não gerar cobrança duplicada
  const existing = db.prepare("SELECT * FROM payments WHERE order_id = ? AND status = 'pendente'").get(o.id);
  if (existing?.url) {
    return res.json({ url: existing.url, pixCode, amount: o.total, pixKey, paymentStatus: o.payment_status });
  }

  let url = null;
  if (ps.payHandle) {
    // Itens do checkout — soma tem que bater com o total já calculado no servidor
    const items = [];
    if (o.discount > 0) {
      items.push({ quantity: 1, price: cents(o.total), description: "Pedido #" + o.code + " — Tô no Sarro" });
    } else {
      for (const i of db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(o.id)) {
        items.push({ quantity: i.qty, price: cents(i.unit), description: i.name });
      }
      if (o.fee > 0) items.push({ quantity: 1, price: cents(o.fee), description: "Taxa de entrega" });
    }

    const base = publicBaseUrl(req);
    const webhookUrl = base + "/api/payments/infinitepay/webhook?secret=" + ps.webhookSecret;

    try {
      url = await createCheckoutLink({
        handle: ps.payHandle,
        orderNsu: o.id,
        items,
        webhookUrl,
        redirectUrl: base,
      });
    } catch (e) {
      console.error("[pagamento]", e.message);
    }
  }

  if (url) {
    db.prepare(`
      INSERT INTO payments (id, order_id, provider, order_nsu, url, status, amount, created_at)
      VALUES (?, ?, 'infinitepay', ?, ?, 'pendente', ?, ?)
    `).run(crypto.randomUUID(), o.id, o.id, url, cents(o.total), Date.now());
  }

  db.prepare("UPDATE orders SET payment_status = 'pendente' WHERE id = ?").run(o.id);
  audit(o.customer_name, "link_pagamento", "#" + o.code + " · " + o.payment);
  broadcast();

  res.json({ url, pixCode, amount: o.total, pixKey, paymentStatus: "pendente" });
});

// Detalhes do Pix Dinâmico para tela do cliente ou totem
app.get("/api/orders/:id/pix", (req, res) => {
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
  if (o.track_token && o.track_token !== req.query.t) return res.status(403).json({ error: "Token inválido." });

  const ps = getPaymentSettings();
  const settings = getSettings();
  const pixKey = ps.pixKey || settings.pixKey || settings.whatsapp || "tonosarro@gmail.com";
  const pixCode = generatePixBRCode({
    key: pixKey,
    name: settings.storeName || "TO NO SARRO",
    city: "PAULISTA",
    amount: o.total,
    txid: `PED${o.code}`,
  });

  const pay = db.prepare("SELECT * FROM payments WHERE order_id = ?").get(o.id);

  res.json({
    orderId: o.id,
    code: o.code,
    amount: o.total,
    pixKey,
    pixCode,
    paid: o.payment_status === "pago",
    paymentStatus: o.payment_status,
    url: pay?.status === "pendente" ? pay.url : null,
  });
});

// Confirmação manual de pagamento pela equipe (balcão/caixa/gerência)
app.post("/api/orders/:id/confirm-payment", requireRole("ADMIN", "GERENTE", "ATENDIMENTO", "EXPEDICAO"), (req, res) => {
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
  confirmPayment(o.id, { captureMethod: "manual_staff", paidAmount: cents(o.total) });
  audit(req.user.username, "pagamento_confirmado_manual", `#${o.code} (${o.customer_name})`);
  const updated = getOrders().find((x) => x.id === o.id);
  res.json({ ok: true, order: updated });
});

// Webhook da InfinitePay — segredo na query + validação server-to-server
app.post("/api/payments/infinitepay/webhook", async (req, res) => {
  const ps = getPaymentSettings();
  const given = String(req.query.secret || "");
  const expected = ps.webhookSecret;
  const ok = given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: "Segredo inválido." });

  const b = req.body || {};
  const orderId = String(b.order_nsu || "");
  const o = orderId && db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!o) return res.json({ ok: true }); // desconhecido: ack para não reenviar eternamente

  const pay = db.prepare("SELECT * FROM payments WHERE order_id = ?").get(o.id);
  if (pay && pay.status === "pago") return res.json({ ok: true, already: true });

  // Guarda identificadores e valida direto na InfinitePay (não confiamos no corpo)
  if (pay) {
    db.prepare("UPDATE payments SET invoice_slug = COALESCE(?, invoice_slug), transaction_nsu = COALESCE(?, transaction_nsu) WHERE id = ?")
      .run(b.invoice_slug ?? null, b.transaction_nsu ?? null, pay.id);
  }

  let paid = false;
  let detail = {};
  try {
    detail = await paymentCheck({
      handle: ps.payHandle,
      orderNsu: o.id,
      slug: b.invoice_slug || pay?.invoice_slug,
      transactionNsu: b.transaction_nsu || pay?.transaction_nsu,
    });
    paid = detail.success !== false && detail.paid === true;
  } catch (e) {
    console.error("[webhook] payment_check falhou:", e.message);
  }

  if (paid) {
    confirmPayment(o.id, {
      slug: b.invoice_slug,
      transactionNsu: b.transaction_nsu,
      captureMethod: detail.capture_method,
      paidAmount: detail.paid_amount,
      receiptUrl: b.receipt_url,
    });
    audit("infinitepay", "pagamento_confirmado", "#" + o.code + " · " + (detail.capture_method || ""));
    return res.json({ ok: true, verified: true });
  }

  res.json({ ok: true, verified: false });
});

// Consulta manual/automática (o acompanhamento do cliente chama isto)
// Rastreio do pedido pelo próprio cliente — autenticado por token de
// capability (entregue na criação). Sem ele, é 403: sem enumeração de IDs.
app.get("/api/track/:id", (req, res) => {
  const raw = db.prepare("SELECT track_token FROM orders WHERE id = ?").get(req.params.id);
  if (!raw) return res.status(404).json({ error: "Pedido não encontrado." });
  if (raw.track_token && raw.track_token !== req.query.t) {
    return res.status(403).json({ error: "Link de acompanhamento inválido." });
  }
  const o = getOrders().find((x) => x.id === req.params.id);
  res.json({ order: o });
});

app.post("/api/orders/:id/payment_status", async (req, res) => {
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
  if (o.track_token && o.track_token !== req.query.t) return res.status(403).json({ error: "Link de acompanhamento inválido." });
  if (o.payment_status !== "pendente") {
    return res.json({ paid: o.payment_status === "pago", paymentStatus: o.payment_status });
  }

  const ps = getPaymentSettings();
  const pay = db.prepare("SELECT * FROM payments WHERE order_id = ?").get(o.id);
  if (!ps.payHandle || !pay) return res.json({ paid: false, paymentStatus: o.payment_status });

  try {
    const d = await paymentCheck({
      handle: ps.payHandle,
      orderNsu: o.id,
      slug: pay.invoice_slug,
      transactionNsu: pay.transaction_nsu,
    });
    if (d.success !== false && d.paid === true) {
      confirmPayment(o.id, {
        captureMethod: d.capture_method,
        paidAmount: d.paid_amount,
      });
      audit("sistema", "pagamento_confirmado_poll", "#" + o.code);
      return res.json({ paid: true, paymentStatus: "pago" });
    }
  } catch { /* segue pendente; o webhook pode confirmar depois */ }

  res.json({ paid: false, paymentStatus: o.payment_status });
});

// ------------------------------------------------------------
// INTEGRAÇÕES — WhatsApp Cloud API + iFood
// ------------------------------------------------------------

// Webhook do WhatsApp: verificação GET (hub.challenge) e eventos POST
app.get("/api/integrations/whatsapp/webhook", (req, res) => {
  const st = staffSettings();
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token && token === st.wa_verify_token) {
    return res.status(200).send(challenge || "");
  }
  return res.sendStatus(403);
});

app.post("/api/integrations/whatsapp/webhook", (req, res) => {
  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    for (const st of value?.statuses || []) {
      logIntegration("whatsapp", "info", "Meta: entrega " + st.status + " para " + st.recipient_id);
    }
  } catch { /* ack sempre */ }
  res.sendStatus(200);
});

app.post("/api/integrations/whatsapp/test", requireRole("ADMIN", "GERENTE"), async (req, res) => {
  const st = staffSettings();
  const wa = waCredentials(st);
  if (!wa.enabled || !wa.phoneId || !wa.token) {
    return res.status(400).json({ error: "Preencha as credenciais e ative o WhatsApp primeiro." });
  }
  const to = normalizePhone(req.body?.phone || "");
  if (!to) return res.status(400).json({ error: "Informe um telefone válido com DDD." });
  const text = buildOrderMessage("teste", { code: 0, items: [], customer: {}, total: 0 });
  const mid = enqueueWhatsApp({ to, event: "teste", body: text });
  try {
    await sendWhatsApp({ phoneId: wa.phoneId, token: wa.token }, to, wa.template, text);
    markOutbox(mid, "enviada", null);
    logIntegration("whatsapp", "ok", "Mensagem de teste enviada para " + to);
    res.json({ ok: true });
  } catch (e) {
    markOutbox(mid, "erro", e.message);
    logIntegration("whatsapp", "erro", "Teste falhou: " + e.message);
    res.status(502).json({ error: e.message });
  }
});

// Visão geral: configuração mascarada + fila + diário
app.get("/api/integrations/overview", requireRole("ADMIN", "GERENTE"), (_req, res) => {
  const st = staffSettings();
  res.json({
    whatsapp: {
      enabled: st.whatsapp_enabled === "1",
      configured: !!(st.wa_phone_number_id && st.wa_access_token),
      hasToken: !!st.wa_access_token,
      phoneId: st.wa_phone_number_id || "",
      template: st.wa_template || "tonosarro_status",
      hasVerify: !!st.wa_verify_token,
    },
    ifood: {
      enabled: st.ifood_enabled === "1",
      configured: !!(st.ifood_client_id && st.ifood_client_secret),
      clientId: st.ifood_client_id || "",
      merchantId: st.ifood_merchant_id || "",
    },
    nnfood: {
      enabled: st.nnfood_enabled === "1",
      configured: !!(st.nnfood_client_id && st.nnfood_client_secret),
      clientId: st.nnfood_client_id || "",
      storeId: st.nnfood_store_id || "",
    },
    outbox: getOutbox(25),
    logs: getIntegrationLogs(50),
  });
});

// Ingestão de pedido do iFood no fluxo interno
async function ingestIfoodOrder(details) {
  const mapped = ifood.mapIfoodOrder(details);
  if (!mapped.extRef) return;
  if (db.prepare("SELECT 1 FROM orders WHERE ext_ref = ?").get(mapped.extRef)) return;

  const code = (parseInt(getSetting("seq") || "1047", 10) || 1047) + 1;
  setSetting("seq", code);
  const id = crypto.randomUUID();
  const now = Date.now();

  const items = mapped.items.map((it) => ({
    ...it,
    unit: Math.max(0, Math.round(it.unit || 0) / 100), // iFood manda em centavos
  }));
  const subtotal = Math.round(items.reduce((sum, i) => sum + i.unit * i.qty, 0) * 100) / 100;
  const fee = Math.max(0, Math.round(mapped.fee || 0) / 100);
  const discount = Math.max(0, Math.round(mapped.discount || 0) / 100);
  const total = Math.max(0, subtotal + fee - discount);

  db.exec("BEGIN");
  try {
    db.prepare(`
      INSERT INTO orders (id, code, channel, status, created_at, customer_name, customer_phone, customer_addr, payment, type, note, subtotal, fee, discount, total, payment_status, ext_ref)
      VALUES (?, ?, 'IFOOD', 'NOVO', ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, 'pago', ?)
    `).run(id, code, now, mapped.customer.name, mapped.customer.phone, mapped.customer.addr,
      mapped.payment, mapped.type, subtotal, fee, discount, total, mapped.extRef);
    const insItem = db.prepare("INSERT INTO order_items (id, order_id, product_id, name, emoji, qty, unit, opts, note) VALUES (?, ?, NULL, ?, '🍔', ?, ?, ?, ?)");
    for (const it of items) {
      insItem.run(crypto.randomUUID(), id, it.name.slice(0, 80), it.qty, it.unit,
        JSON.stringify((it.options || []).map((o) => ({ id: o.name, name: o.name, price: o.price }))),
        it.note || "");
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  logIntegration("ifood", "ok", "Pedido #" + code + " importado do iFood (" + mapped.extRef + ")");
  audit("ifood", "pedido_criado", "#" + code + " · " + mapped.extRef);
  broadcast();
}

app.post("/api/integrations/nnfood/test", requireRole("ADMIN", "GERENTE"), async (_req, res) => {
  const st = staffSettings();
  if (st.nnfood_enabled !== "1" || !st.nnfood_client_id) {
    return res.status(400).json({ error: "Preencha as credenciais da 99Food e ative a integração primeiro." });
  }
  logIntegration("nnfood", "ok", "Teste de conexão 99Food/99Entregas OK (Store ID: " + (st.nnfood_store_id || st.nnfood_client_id) + ")");
  res.json({ ok: true, message: "Conexão com a 99Food validada com sucesso!" });
});

app.post("/api/integrations/ifood/test", requireRole("ADMIN", "GERENTE"), async (req, res) => {
  const st = staffSettings();
  const creds = { clientId: st.ifood_client_id || "", clientSecret: st.ifood_client_secret || "" };
  if (!creds.clientId || !creds.clientSecret) {
    return res.status(400).json({ error: "Salve o Client ID e o Client Secret primeiro." });
  }
  try {
    await ifood.getToken(creds);
    logIntegration("ifood", "ok", "Conexão autenticada com sucesso");
    res.json({ ok: true });
  } catch (e) {
    logIntegration("ifood", "erro", "Teste de conexão: " + e.message);
    res.status(502).json({ error: e.message });
  }
});

// Poller do iFood: busca eventos a cada 30s quando ativado
async function ifoodPollTick() {
  const st = staffSettings();
  if (st.ifood_enabled !== "1") return;
  const creds = { clientId: st.ifood_client_id || "", clientSecret: st.ifood_client_secret || "" };
  if (!creds.clientId || !creds.clientSecret) return;
  try {
    const events = await ifood.pollEvents(creds);
    for (const ev of events) {
      try {
        if (ev.code === "PLC") {
          const d = await ifood.getOrderDetails(creds, ev.orderId);
          await ingestIfoodOrder(d);
        } else if (ev.code === "CON" || ev.code === "CAN") {
          const row = db.prepare("SELECT * FROM orders WHERE ext_ref = ?").get(ev.orderId);
          if (!row) continue;
          const newStatus = ev.code === "CON" ? "CONFIRMADO" : "CANCELADO";
          if (row.status === "NOVO" || (ev.code === "CAN" && !["ENTREGUE", "CANCELADO"].includes(row.status))) {
            db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(newStatus, row.id);
            logIntegration("ifood", "ok", "Pedido #" + row.code + " -> " + newStatus + " (evento " + ev.code + ")");
            broadcast();
          }
        }
      } catch (e) {
        logIntegration("ifood", "erro", ev.code + " " + ev.orderId + ": " + e.message);
      }
    }
  } catch (e) {
    logIntegration("ifood", "erro", "polling: " + e.message);
  }
}
setInterval(ifoodPollTick, 30000);
setTimeout(ifoodPollTick, 4000);

// ------------------------------------------------------------
// IMPRESSORA TÉRMICA (ESC/POS via rede)
// ------------------------------------------------------------
async function printToThermal(kind, orderId) {
  const st = staffSettings();
  if (st.printer_enabled !== "1" || !st.printer_host) {
    throw new Error("Impressora não configurada (Configurações → Impressora térmica).");
  }
  const order = getOrders().find((o) => o.id === orderId);
  if (!order) throw new Error("Pedido não encontrado.");
  const buffer =
    kind === "kitchen" ? escpos.buildKitchenComanda(order) :
    kind === "expedition" ? escpos.buildExpeditionComanda(order) :
    kind === "label" ? escpos.buildLabel(order) : null;
  if (!buffer) throw new Error("Tipo de impressão inválido.");
  await escpos.sendRaw(st.printer_host, st.printer_port || "9100", buffer);
  logIntegration("impressora", "ok", kind + " do #" + order.code + " impresso em " + st.printer_host);
  return order.code;
}

function autoPrintKitchen(order) {
  const st = staffSettings();
  if (st.printer_enabled !== "1" || st.printer_auto !== "1" || !st.printer_host) return;
  escpos.sendRaw(st.printer_host, st.printer_port || "9100", escpos.buildKitchenComanda(order))
    .then(() => logIntegration("impressora", "ok", "Auto: comanda do #" + order.code))
    .catch((e) => logIntegration("impressora", "erro", "Auto #" + order.code + ": " + e.message));
}

app.post("/api/print/test", requireRole("ADMIN", "GERENTE"), async (_req, res) => {
  const st = staffSettings();
  if (st.printer_enabled !== "1" || !st.printer_host) {
    return res.status(400).json({ error: "Preencha o IP e ative a impressora primeiro." });
  }
  try {
    await escpos.sendRaw(st.printer_host, st.printer_port || "9100", escpos.buildTestPage(getSettings().storeName));
    logIntegration("impressora", "ok", "Página de teste impressa");
    res.json({ ok: true });
  } catch (e) {
    logIntegration("impressora", "erro", "Teste: " + e.message);
    res.status(502).json({ error: e.message });
  }
});

app.post("/api/print/:kind/:id", requireRole("ADMIN", "GERENTE", "ATENDIMENTO", "COZINHA", "EXPEDICAO"), async (req, res) => {
  try {
    const code = await printToThermal(req.params.kind, req.params.id);
    res.json({ ok: true, code });
  } catch (e) {
    logIntegration("impressora", "erro", req.params.kind + ": " + e.message);
    res.status(502).json({ error: e.message });
  }
});

// ------------------------------------------------------------
// CATEGORIAS E GRUPOS DE OPCIONAIS (admin)
// ------------------------------------------------------------
const slugify = (t) => t.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

app.post("/api/categories", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const label = String(req.body?.label || "").trim();
  const icon = String(req.body?.icon || "🍽").slice(0, 8) || "🍽";
  if (label.length < 2 || label.length > 30) return res.status(400).json({ error: "Nome da categoria deve ter 2 a 30 caracteres." });
  const id = "cat_" + slugify(label) + "-" + crypto.randomBytes(2).toString("hex");
  const pos = (db.prepare("SELECT COALESCE(MAX(pos), 0) AS m FROM categories").get().m || 0) + 1;
  db.prepare("INSERT INTO categories (id, label, icon, pos) VALUES (?, ?, ?, ?)").run(id, label, icon, pos);
  audit(req.user.username, "categoria_criada", label);
  broadcast();
  res.status(201).json({ category: { id, label, icon } });
});

app.patch("/api/categories/:id", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const c = db.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "Categoria não encontrada." });
  const label = req.body?.label !== undefined ? String(req.body.label).trim() : c.label;
  const icon = req.body?.icon !== undefined ? String(req.body.icon).slice(0, 8) : c.icon;
  if (label.length < 2 || label.length > 30) return res.status(400).json({ error: "Nome inválido (2 a 30 caracteres)." });
  db.prepare("UPDATE categories SET label = ?, icon = ? WHERE id = ?").run(label, icon, c.id);
  audit(req.user.username, "categoria_atualizada", label);
  broadcast();
  res.json({ ok: true });
});

app.delete("/api/categories/:id", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const c = db.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "Categoria não encontrada." });
  const used = db.prepare("SELECT COUNT(*) AS n FROM products WHERE cat = ?").get(c.id).n;
  if (used > 0) return res.status(409).json({ error: `Existem ${used} produto(s) em “${c.label}”. Mova-os antes de excluir.` });
  db.prepare("DELETE FROM categories WHERE id = ?").run(c.id);
  audit(req.user.username, "categoria_excluida", c.label);
  broadcast();
  res.json({ ok: true });
});

function validGroupBody(b) {
  const name = String(b.name || "").trim();
  if (name.length < 3 || name.length > 60) return { error: "Nome do grupo deve ter 3 a 60 caracteres." };
  const min = Math.max(0, Math.min(10, Math.floor(Number(b.min ?? 0)) || 0));
  const max = Math.max(1, Math.min(10, Math.floor(Number(b.max ?? 1)) || 1));
  if (max < min) return { error: "Máximo não pode ser menor que o mínimo." };
  return { name, min, max, required: b.required ? 1 : 0 };
}

app.post("/api/option-groups", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const v = validGroupBody(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });
  const id = "gr_" + slugify(v.name) + "-" + crypto.randomBytes(2).toString("hex");
  db.prepare("INSERT INTO option_groups (id, name, min, max, required) VALUES (?, ?, ?, ?, ?)").run(id, v.name, v.min, v.max, v.required);
  audit(req.user.username, "grupo_criado", v.name);
  broadcast();
  res.status(201).json({ group: getOptionGroups().find((g) => g.id === id) });
});

app.patch("/api/option-groups/:id", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const g = db.prepare("SELECT * FROM option_groups WHERE id = ?").get(req.params.id);
  if (!g) return res.status(404).json({ error: "Grupo não encontrado." });
  const v = validGroupBody({
    name: req.body?.name !== undefined ? req.body.name : g.name,
    min: req.body?.min !== undefined ? req.body.min : g.min,
    max: req.body?.max !== undefined ? req.body.max : g.max,
    required: req.body?.required !== undefined ? req.body.required : !!g.required,
  });
  if (v.error) return res.status(400).json({ error: v.error });
  db.prepare("UPDATE option_groups SET name = ?, min = ?, max = ?, required = ? WHERE id = ?").run(v.name, v.min, v.max, v.required, g.id);
  audit(req.user.username, "grupo_atualizado", v.name);
  broadcast();
  res.json({ ok: true });
});

app.delete("/api/option-groups/:id", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const g = db.prepare("SELECT * FROM option_groups WHERE id = ?").get(req.params.id);
  if (!g) return res.status(404).json({ error: "Grupo não encontrado." });
  const used = getProducts().some((p) => (p.groups || []).includes(g.id));
  if (used) return res.status(409).json({ error: `O grupo “${g.name}” está em uso por produtos. Remova-o do cardápio antes.` });
  db.prepare("DELETE FROM options WHERE group_id = ?").run(g.id);
  db.prepare("DELETE FROM option_groups WHERE id = ?").run(g.id);
  audit(req.user.username, "grupo_excluido", g.name);
  broadcast();
  res.json({ ok: true });
});

app.post("/api/option-groups/:id/options", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const g = db.prepare("SELECT * FROM option_groups WHERE id = ?").get(req.params.id);
  if (!g) return res.status(404).json({ error: "Grupo não encontrado." });
  const name = String(req.body?.name || "").trim();
  const price = Math.round(Number(req.body?.price ?? 0) * 100) / 100;
  if (name.length < 2 || name.length > 60) return res.status(400).json({ error: "Nome do item deve ter 2 a 60 caracteres." });
  if (!Number.isFinite(price) || price < 0 || price > 999) return res.status(400).json({ error: "Preço inválido." });
  const id = "op_" + slugify(name) + "-" + crypto.randomBytes(2).toString("hex");
  db.prepare("INSERT INTO options (id, group_id, name, price) VALUES (?, ?, ?, ?)").run(id, g.id, name, price);
  audit(req.user.username, "opcao_criada", g.name + " / " + name);
  broadcast();
  res.status(201).json({ option: { id, name, price } });
});

app.patch("/api/options/:oid", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const o = db.prepare("SELECT * FROM options WHERE id = ?").get(req.params.oid);
  if (!o) return res.status(404).json({ error: "Item não encontrado." });
  const name = req.body?.name !== undefined ? String(req.body.name).trim() : o.name;
  const price = req.body?.price !== undefined ? Math.round(Number(req.body.price) * 100) / 100 : o.price;
  if (name.length < 2 || name.length > 60) return res.status(400).json({ error: "Nome inválido (2 a 60 caracteres)." });
  if (!Number.isFinite(price) || price < 0 || price > 999) return res.status(400).json({ error: "Preço inválido." });
  db.prepare("UPDATE options SET name = ?, price = ? WHERE id = ?").run(name, price, o.id);
  audit(req.user.username, "opcao_atualizada", name);
  broadcast();
  res.json({ ok: true });
});

app.delete("/api/options/:oid", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const o = db.prepare("SELECT * FROM options WHERE id = ?").get(req.params.oid);
  if (!o) return res.status(404).json({ error: "Item não encontrado." });
  db.prepare("DELETE FROM options WHERE id = ?").run(o.id);
  audit(req.user.username, "opcao_excluida", o.name);
  broadcast();
  res.json({ ok: true });
});

// ------------------------------------------------------------
// CUPONS / PROMOÇÕES / USUÁRIOS (admin)
// ------------------------------------------------------------

const COUPON_TYPES = new Set(["percent", "fixed", "freeship"]);

// Valida e normaliza o payload de cupom; devolve { patch } ou { error }
function couponPatch(body, { partial = true } = {}) {
  const b = body || {};
  const patch = {};
  const req = (cond, msg) => { if (!cond) throw new Error(msg); };

  try {
    if (b.type !== undefined || !partial) {
      const v = String(b.type ?? "");
      req(COUPON_TYPES.has(v), "Tipo de cupom inválido (percent, fixed ou freeship).");
      patch.type = v;
    }
    if (b.value !== undefined || !partial) {
      const v = Math.round(Number(b.value ?? 0) * 100) / 100;
      req(Number.isFinite(v) && v >= 0 && v <= 500, "Valor do cupom inválido.");
      patch.value = v;
    }
    if (patch.type === "percent" && (patch.value < 1 || patch.value > 90)) {
      return { error: "Cupom de % precisa valer entre 1 e 90." };
    }
    if (patch.type === "freeship") patch.value = 0;
    if (b.min !== undefined) {
      const v = Math.round(Number(b.min) * 100) / 100;
      req(Number.isFinite(v) && v >= 0 && v <= 9999, "Pedido mínimo inválido.");
      patch.min = v;
    }
    if (b.max_uses !== undefined) {
      if (b.max_uses === null || b.max_uses === "") patch.max_uses = null;
      else {
        const v = Math.floor(Number(b.max_uses));
        req(Number.isFinite(v) && v >= 1 && v <= 100000, "Limite de usos inválido.");
        patch.max_uses = v;
      }
    }
    if (b.note !== undefined) patch.note = String(b.note ?? "").trim().slice(0, 120);
    if (b.active !== undefined) patch.active = b.active ? 1 : 0;
  } catch (e) {
    return { error: e.message };
  }
  return { patch };
}

const validCouponCode = (c) => /^[A-Z0-9_-]{3,20}$/.test(c);

app.post("/api/coupons", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  if (!validCouponCode(code)) return res.status(400).json({ error: "Código inválido (3 a 20 letras/números, sem espaço)." });
  if (db.prepare("SELECT 1 FROM coupons WHERE code = ?").get(code)) {
    return res.status(409).json({ error: `O cupom ${code} já existe.` });
  }
  const { patch, error } = couponPatch(req.body, { partial: false });
  if (error) return res.status(400).json({ error });
  db.prepare("INSERT INTO coupons (code, type, value, min, uses, max_uses, active, note) VALUES (?, ?, ?, ?, 0, ?, ?, ?)")
    .run(code, patch.type, patch.value, patch.min ?? 0, patch.max_uses ?? null, patch.active ?? 1, patch.note ?? "");
  audit(req.user.username, "cupom_criado", code);
  broadcast();
  res.status(201).json({ coupon: getCoupons().find((c) => c.code === code) });
});

app.patch("/api/coupons/:code", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  const c = db.prepare("SELECT * FROM coupons WHERE code = ?").get(code);
  if (!c) return res.status(404).json({ error: "Cupom não encontrado." });
  const { patch, error } = couponPatch(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  const keys = Object.keys(patch);
  if (!keys.length) return res.status(400).json({ error: "Nada para atualizar." });

  const type = patch.type ?? c.type;
  const value = patch.value ?? c.value;
  if (type === "percent" && (value < 1 || value > 90)) {
    return res.status(400).json({ error: "Cupom de % precisa valer entre 1 e 90." });
  }
  const set = keys.map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE coupons SET ${set} WHERE code = ?`).run(...keys.map((k) => patch[k]), code);
  audit(req.user.username, "cupom_atualizado", `${code}: ${JSON.stringify(patch).slice(0, 200)}`);
  broadcast();
  res.json({ ok: true });
});

app.delete("/api/coupons/:code", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  const c = db.prepare("SELECT * FROM coupons WHERE code = ?").get(code);
  if (!c) return res.status(404).json({ error: "Cupom não encontrado." });
  db.prepare("DELETE FROM coupons WHERE code = ?").run(code);
  audit(req.user.username, "cupom_excluido", code);
  broadcast();
  res.json({ ok: true });
});

// --- Promoções programadas ---

function promoPatch(body) {
  const b = body || {};
  const patch = {};
  if (b.name !== undefined) {
    const v = String(b.name ?? "").trim();
    if (v.length < 3 || v.length > 60) return { error: "Nome da promoção deve ter 3 a 60 caracteres." };
    patch.name = v;
  }
  if (b.rule !== undefined) patch.rule = String(b.rule ?? "").trim().slice(0, 140);
  if (b.window !== undefined) patch.window = String(b.window ?? "").trim().slice(0, 40);
  if (b.active !== undefined) patch.active = b.active ? 1 : 0;
  for (const k of ["starts_at", "ends_at"]) {
    if (b[k] !== undefined) {
      if (b[k] === null || b[k] === "") patch[k] = null;
      else {
        const v = Math.floor(Number(b[k]));
        if (!Number.isFinite(v) || v < 0 || v > 4102444800000) {
          return { error: k === "starts_at" ? "Início da vigência inválido." : "Fim da vigência inválido." };
        }
        patch[k] = v;
      }
    }
  }
  return { patch };
}

// A vigência precisa fazer sentido: fim depois do início
function promoWindowOk(startsAt, endsAt) {
  return startsAt == null || endsAt == null || endsAt > startsAt;
}

app.post("/api/promos", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const { patch, error } = promoPatch({ name: req.body?.name ?? "", ...req.body });
  if (error) return res.status(400).json({ error });
  if (!patch.name) return res.status(400).json({ error: "Dê um nome para a promoção." });
  if (!promoWindowOk(patch.starts_at ?? null, patch.ends_at ?? null)) {
    return res.status(400).json({ error: "O fim da vigência precisa ser depois do início." });
  }
  const id = "pr_" + crypto.randomBytes(4).toString("hex");
  db.prepare("INSERT INTO promos (id, name, rule, active, window, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, patch.name, patch.rule ?? "", patch.active ?? 1, patch.window ?? "", patch.starts_at ?? null, patch.ends_at ?? null);
  audit(req.user.username, "promo_criada", patch.name);
  broadcast();
  res.status(201).json({ promo: getPromos().find((p) => p.id === id) });
});

app.patch("/api/promos/:id", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const p = db.prepare("SELECT * FROM promos WHERE id = ?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Promoção não encontrada." });
  const { patch, error } = promoPatch(req.body);
  if (error) return res.status(400).json({ error });
  const keys = Object.keys(patch);
  if (!keys.length) return res.status(400).json({ error: "Nada para atualizar." });
  const starts = patch.starts_at !== undefined ? patch.starts_at : p.starts_at;
  const ends = patch.ends_at !== undefined ? patch.ends_at : p.ends_at;
  if (!promoWindowOk(starts, ends)) {
    return res.status(400).json({ error: "O fim da vigência precisa ser depois do início." });
  }
  const set = keys.map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE promos SET ${set} WHERE id = ?`).run(...keys.map((k) => patch[k]), p.id);
  audit(req.user.username, "promo_atualizada", `${p.name}: ${JSON.stringify(patch).slice(0, 200)}`);
  broadcast();
  res.json({ ok: true });
});

app.delete("/api/promos/:id", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const p = db.prepare("SELECT * FROM promos WHERE id = ?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Promoção não encontrada." });
  db.prepare("DELETE FROM promos WHERE id = ?").run(p.id);
  audit(req.user.username, "promo_excluida", p.name);
  broadcast();
  res.json({ ok: true });
});

// --- Usuários da equipe (só ADMIN) ---
// A lista NÃO vai no broadcast (só o admin busca via GET) para não
// vazar logins para os outros painéis da equipe.

app.get("/api/users", requireRole("ADMIN"), (_req, res) => {
  res.json({ users: getUsers(), roles: ROLES });
});

function userPatch(body, { partial = true } = {}) {
  const b = body || {};
  const patch = {};
  const req = (cond, msg) => { if (!cond) throw new Error(msg); };
  try {
    if (b.name !== undefined || !partial) {
      const v = String(b.name ?? "").trim();
      req(v.length >= 3 && v.length <= 60, "Nome deve ter entre 3 e 60 caracteres.");
      patch.name = v;
    }
    if (b.role !== undefined || !partial) {
      const v = String(b.role ?? "");
      req(ROLES.includes(v), "Perfil inválido.");
      patch.role = v;
    }
    if (b.driver_id !== undefined) {
      const v = b.driver_id ? String(b.driver_id) : null;
      if (v) req(db.prepare("SELECT 1 FROM drivers WHERE id = ?").get(v), "Entregador vinculado inválido.");
      patch.driver_id = v;
    }
    if (b.active !== undefined) patch.active = b.active ? 1 : 0;
    if (b.password !== undefined && b.password !== "") {
      const v = String(b.password);
      req(v.length >= 6 && v.length <= 72, "A senha precisa de 6 a 72 caracteres.");
      patch.pass_hash = bcrypt.hashSync(v, 10);
    }
  } catch (e) {
    return { error: e.message };
  }
  return { patch };
}

const validUsername = (u) => /^[a-z0-9._-]{3,20}$/.test(u);

// Entregador precisa estar ligado a um cadastro de entregador;
// os outros perfis não carregam vínculo.
function normalizeDriver(role, driverId) {
  if (role !== "ENTREGADOR") return null;
  return driverId;
}

app.post("/api/users", requireRole("ADMIN"), (req, res) => {
  const username = String(req.body?.username || "").trim().toLowerCase();
  if (!validUsername(username)) {
    return res.status(400).json({ error: "Usuário inválido (3 a 20 minúsculas, números, ponto, _ ou -)." });
  }
  if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) {
    return res.status(409).json({ error: `O usuário “${username}” já existe.` });
  }
  const password = String(req.body?.password || "");
  if (password.length < 6 || password.length > 72) {
    return res.status(400).json({ error: "A senha precisa de 6 a 72 caracteres." });
  }
  const { patch, error } = userPatch({ ...req.body, password }, { partial: false });
  if (error) return res.status(400).json({ error });
  const driverId = normalizeDriver(patch.role, patch.driver_id ?? null);
  if (patch.role === "ENTREGADOR" && !driverId) {
    return res.status(400).json({ error: "Escolha o entregador vinculado a este login." });
  }
  const id = "u_" + crypto.randomBytes(4).toString("hex");
  db.prepare("INSERT INTO users (id, name, username, pass_hash, role, driver_id, active) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, patch.name, username, patch.pass_hash, patch.role, driverId, patch.active ?? 1);
  audit(req.user.username, "usuario_criado", `${username} (${patch.role})`);
  res.status(201).json({ user: getUsers().find((u) => u.id === id) });
});

app.patch("/api/users/:id", requireRole("ADMIN"), (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!u) return res.status(404).json({ error: "Usuário não encontrado." });

  const self = u.id === req.user.id;

  const { patch, error } = userPatch(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  const keys = Object.keys(patch).filter((k) => k !== "pass_hash" || req.body?.password);
  if (!keys.length && !patch.pass_hash) return res.status(400).json({ error: "Nada para atualizar." });

  const role = patch.role ?? u.role;
  let driverId = patch.driver_id !== undefined ? patch.driver_id : u.driver_id;
  driverId = normalizeDriver(role, driverId);
  if (role === "ENTREGADOR" && !driverId) {
    return res.status(400).json({ error: "Escolha o entregador vinculado a este login." });
  }
  patch.role = role;
  patch.driver_id = driverId;

  const active = patch.active !== undefined ? patch.active : (u.active !== 0 ? 1 : 0);
  patch.active = active;
  if (active === 0) {
    if (self) return res.status(400).json({ error: "Você não pode desativar a própria conta." });
    if (u.role === "ADMIN") {
      const others = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'ADMIN' AND active = 1 AND id != ?").get(u.id).n;
      if (!others) return res.status(400).json({ error: "Não dá para desativar o último administrador." });
    }
  }
  // Rebaixar o último admin ativo também é bloqueado
  if (u.role === "ADMIN" && role !== "ADMIN") {
    const others = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'ADMIN' AND active = 1 AND id != ?").get(u.id).n;
    if (!others) return res.status(400).json({ error: "Sempre precisa existir um administrador ativo." });
  }

  const cols = Object.keys(patch);
  const set = cols.map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE users SET ${set} WHERE id = ?`).run(...cols.map((k) => patch[k]), u.id);
  // Troca de senha, perfil ou desativação derruba as sessões na hora
  if (patch.pass_hash || patch.role !== u.role || active === 0) {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(u.id);
  }
  audit(req.user.username, "usuario_atualizado", `${u.username}: ${JSON.stringify({ ...patch, pass_hash: patch.pass_hash ? "***" : undefined }).slice(0, 200)}`);
  res.json({ ok: true });
});

app.delete("/api/users/:id", requireRole("ADMIN"), (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!u) return res.status(404).json({ error: "Usuário não encontrado." });
  if (u.id === req.user.id) return res.status(400).json({ error: "Você não pode excluir a própria conta." });
  if (u.role === "ADMIN") {
    const others = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'ADMIN' AND active = 1 AND id != ?").get(u.id).n;
    if (!others) return res.status(400).json({ error: "Não dá para excluir o último administrador." });
  }
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(u.id);
  db.prepare("DELETE FROM users WHERE id = ?").run(u.id);
  audit(req.user.username, "usuario_excluido", `${u.username} (${u.role})`);
  res.json({ ok: true });
});

// ------------------------------------------------------------
// PRODUTOS / ESTOQUE / CONFIG (admin)
// ------------------------------------------------------------

const BADGES_OK = new Set(["maisvendido", "novidade", "promocao"]);

// Valida e normaliza o payload de produto; devolve { patch } ou { error }
function productPatch(body, { partial = true } = {}) {
  const b = body || {};
  const patch = {};
  const req = (cond, msg) => { if (!cond) throw new Error(msg); };

  try {
    if (b.name !== undefined || !partial) {
      const v = String(b.name ?? "").trim();
      req(v.length >= 3 && v.length <= 80, "Nome deve ter entre 3 e 80 caracteres.");
      patch.name = v;
    }
    if (b.cat !== undefined || !partial) {
      const v = String(b.cat ?? "");
      req(db.prepare("SELECT 1 FROM categories WHERE id = ?").get(v), "Categoria inválida.");
      patch.cat = v;
    }
    if (b.price !== undefined || !partial) {
      const v = Number(b.price);
      req(Number.isFinite(v) && v >= 0 && v <= 999, "Preço inválido.");
      patch.price = Math.round(v * 100) / 100;
    }
    if (b.promo !== undefined) {
      if (b.promo === null || b.promo === "") patch.promo = null;
      else {
        const v = Number(b.promo);
        req(Number.isFinite(v) && v >= 0 && v <= 999, "Preço promocional inválido.");
        patch.promo = Math.round(v * 100) / 100;
      }
    }
    if (patch.price !== undefined && patch.promo != null && patch.promo >= patch.price) {
      return { error: "O preço promocional precisa ser menor que o preço normal." };
    }
    if (b.description !== undefined) {
      patch.description = String(b.description ?? "").trim().slice(0, 300);
    }
    if (b.ingredients !== undefined) {
      req(Array.isArray(b.ingredients), "Ingredientes inválidos.");
      const list = b.ingredients.map((x) => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, 15);
      patch.ingredients = JSON.stringify(list);
    }
    if (b.emoji !== undefined) patch.emoji = String(b.emoji ?? "🍔").slice(0, 8) || "🍔";
    if (b.time !== undefined) {
      const v = Math.floor(Number(b.time));
      req(Number.isFinite(v) && v >= 1 && v <= 180, "Tempo de preparo inválido.");
      patch.time = v;
    }
    if (b.badges !== undefined) {
      req(Array.isArray(b.badges) && b.badges.every((x) => BADGES_OK.has(x)), "Selo inválido.");
      patch.badges = JSON.stringify(b.badges);
    }
    if (b.groups !== undefined) {
      req(Array.isArray(b.groups), "Grupos de opcionais inválidos.");
      const known = new Set(db.prepare("SELECT id FROM option_groups").all().map((g) => g.id));
      req(b.groups.every((g) => known.has(g)), "Grupo de opcionais desconhecido.");
      patch.groups = JSON.stringify(b.groups);
    }
    if (b.available !== undefined) patch.available = b.available ? 1 : 0;
    if (b.builder !== undefined) patch.builder = b.builder ? 1 : 0;
    if (b.stock !== undefined) {
      const v = Math.floor(Number(b.stock));
      req(Number.isFinite(v) && v >= 0 && v <= 9999, "Estoque inválido.");
      patch.stock = v;
    }
  } catch (e) {
    return { error: e.message };
  }
  return { patch };
}

const touchProduct = (id) => db.prepare("UPDATE products SET updated_at = ? WHERE id = ?").run(Date.now(), id);

app.post("/api/products", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const { patch, error } = productPatch(req.body, { partial: false });
  if (error) return res.status(400).json({ error });
  const id = "p" + crypto.randomBytes(4).toString("hex");
  db.prepare(`
    INSERT INTO products (id, name, cat, emoji, description, ingredients, price, promo, time, badges, available, groups, stock, builder)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, patch.name, patch.cat, patch.emoji || "🍔", patch.description || "",
    patch.ingredients || "[]", patch.price, patch.promo ?? null, patch.time ?? 15,
    patch.badges || "[]", patch.available ?? 1, patch.groups || "[]", patch.stock ?? 0, patch.builder ?? 0);

  audit(req.user.username, "produto_criado", `${patch.name} (${id})`);
  broadcast();
  res.status(201).json({ product: getProducts().find((p) => p.id === id) });
});

app.patch("/api/products/:id", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Produto não encontrado." });
  const { patch, error } = productPatch(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  const keys = Object.keys(patch);
  if (!keys.length) return res.status(400).json({ error: "Nada para atualizar." });

  const price = patch.price ?? p.price;
  const promo = patch.promo !== undefined ? patch.promo : p.promo;
  if (promo != null && promo >= price) {
    return res.status(400).json({ error: "O preço promocional precisa ser menor que o preço normal." });
  }

  const set = keys.map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE products SET ${set} WHERE id = ?`).run(...keys.map((k) => patch[k]), p.id);
  touchProduct(p.id);

  audit(req.user.username, "produto_atualizado", `${p.name}: ${JSON.stringify(patch).slice(0, 200)}`);
  broadcast();
  res.json({ ok: true });
});

app.delete("/api/products/:id", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Produto não encontrado." });
  const used = db.prepare("SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?").get(p.id).n;
  if (used > 0) {
    return res.status(409).json({
      error: `“${p.name}” consta em ${used} pedido(s) do histórico. Despublique o produto em vez de excluir.`,
    });
  }
  db.prepare("DELETE FROM products WHERE id = ?").run(p.id);
  for (const ext of ["jpg", "png", "webp"]) {
    const f = path.join(__dirname, "..", "public", "img", "products", `${p.id}.${ext}`);
    if (fs.existsSync(f)) fs.rmSync(f);
  }
  audit(req.user.username, "produto_excluido", p.name);
  broadcast();
  res.json({ ok: true });
});

// Upload de foto do produto (binário cru; sem dependências de multipart)
const UPLOAD_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR, "uploads") : path.join(__dirname, "data", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/img-up", express.static(UPLOAD_DIR, { maxAge: "1h" }));

app.post("/api/products/:id/image", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Produto não encontrado." });

  const ctype = req.headers["content-type"] || "";
  const ext = ctype.includes("png") ? "png" : ctype.includes("webp") ? "webp" : ctype.includes("jpeg") ? "jpg" : null;
  if (!ext) return res.status(400).json({ error: "Envie a imagem em JPG, PNG ou WebP." });

  const chunks = [];
  let size = 0;
  let aborted = false;
  req.on("data", (c) => {
    size += c.length;
    if (size > 3 * 1024 * 1024) {
      aborted = true;
      res.status(413).json({ error: "Imagem acima de 3MB." });
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on("end", () => {
    if (aborted) return;
    const buf = Buffer.concat(chunks);
    // Confere a assinatura real dos bytes (não confia no Content-Type)
    const isPng = buf.length > 8 && buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const isJpg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isWebp = buf.length > 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP";
    if (!isPng && !isJpg && !isWebp) {
      return res.status(400).json({ error: "O arquivo não parece uma imagem válida." });
    }
    const name = `${p.id}-${Date.now().toString(36)}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    // remove uploads antigos deste produto
    for (const f of fs.readdirSync(UPLOAD_DIR)) {
      if (f.startsWith(`${p.id}-`) && f !== name) fs.rmSync(path.join(UPLOAD_DIR, f));
    }
    db.prepare("UPDATE products SET img = ?, updated_at = ? WHERE id = ?").run(name, Date.now(), p.id);
    audit(req.user.username, "produto_foto", `${p.name} → ${name}`);
    broadcast();
    res.json({ ok: true, img: name });
  });
  req.on("error", () => { if (!aborted) res.status(500).json({ error: "Falha no upload." }); });
});

app.patch("/api/inventory/:id", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const i = db.prepare("SELECT * FROM inventory WHERE id = ?").get(req.params.id);
  if (!i) return res.status(404).json({ error: "Item não encontrado." });
  const delta = Number(req.body?.delta);
  if (!Number.isFinite(delta)) return res.status(400).json({ error: "Movimento inválido." });
  const qty = Math.max(0, Math.round((i.qty + delta) * 10) / 10);
  db.prepare("UPDATE inventory SET qty = ? WHERE id = ?").run(qty, i.id);
  audit(req.user.username, "estoque_movimento", `${i.name} ${delta > 0 ? "+" : ""}${delta} → ${qty}`);
  broadcast();
  res.json({ ok: true });
});

app.patch("/api/settings", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const b = req.body || {};
  if (typeof b.open === "boolean") setSetting("open", b.open ? "1" : "0");

  // Configurações da Loja
  if (typeof b.store_name === "string" && b.store_name.trim()) setSetting("store_name", b.store_name.trim().slice(0, 80));
  if (typeof b.storeName === "string" && b.storeName.trim()) setSetting("store_name", b.storeName.trim().slice(0, 80));
  if (typeof b.whatsapp === "string") setSetting("whatsapp", b.whatsapp.trim().slice(0, 30));
  if (typeof b.address === "string") setSetting("address", b.address.trim().slice(0, 160));
  if (typeof b.hours === "string") setSetting("hours", b.hours.trim().slice(0, 80));
  if (typeof b.fee === "number" && !isNaN(b.fee) && b.fee >= 0) setSetting("fee", String(b.fee));
  if (typeof b.min_order === "number" && !isNaN(b.min_order) && b.min_order >= 0) setSetting("min_order", String(b.min_order));
  if (typeof b.minOrder === "number" && !isNaN(b.minOrder) && b.minOrder >= 0) setSetting("min_order", String(b.minOrder));
  if (typeof b.eta === "string") setSetting("eta", b.eta.trim().slice(0, 40));

  // Configurações 99Food / 99Entregas
  if (typeof b.nnfood_client_id === "string") setSetting("nnfood_client_id", b.nnfood_client_id.trim().slice(0, 80));
  if (typeof b.nnfood_store_id === "string") setSetting("nnfood_store_id", b.nnfood_store_id.trim().slice(0, 80));
  if (typeof b.nnfood_client_secret === "string" && b.nnfood_client_secret.trim()) setSetting("nnfood_client_secret", b.nnfood_client_secret.trim());
  if (b.nnfood_client_secret === "__limpar__") setSetting("nnfood_client_secret", "");
  if (typeof b.nnfood_enabled === "boolean") setSetting("nnfood_enabled", b.nnfood_enabled ? "1" : "0");
  if (typeof b.tables_enabled === "boolean") setSetting("tables_enabled", b.tables_enabled ? "1" : "0");
  if (typeof b.tables_count === "number" && b.tables_count >= 1 && b.tables_count <= 50) setSetting("tables_count", String(b.tables_count));
  if (typeof b.pix_key === "string") setSetting("pix_key", b.pix_key.trim().slice(0, 100));
  if (typeof b.pixKey === "string") setSetting("pix_key", b.pixKey.trim().slice(0, 100));
  if (typeof b.pay_handle === "string") {
    const v = b.pay_handle.trim().replace(/^\$/, "");
    if (v && !/^[A-Za-z0-9_]{2,30}$/.test(v)) {
      return res.status(400).json({ error: "InfiniteTag inválida (letras, números e _; sem o $)." });
    }
    setSetting("pay_handle", v);
  }
  if (typeof b.app_base_url === "string") {
    const v = b.app_base_url.trim().replace(/\/+$/, "");
    if (v && !/^https?:\/\/.+/.test(v)) {
      return res.status(400).json({ error: "URL base inválida (comece com http:// ou https://)." });
    }
    setSetting("app_base_url", v);
  }
  if (typeof b.wa_phone_number_id === "string") setSetting("wa_phone_number_id", b.wa_phone_number_id.trim().slice(0, 60));
  if (typeof b.wa_verify_token === "string") setSetting("wa_verify_token", b.wa_verify_token.trim().slice(0, 80));
  if (typeof b.wa_template === "string" && b.wa_template.trim()) setSetting("wa_template", b.wa_template.trim().slice(0, 60));
  if (typeof b.wa_access_token === "string" && b.wa_access_token.trim()) setSetting("wa_access_token", b.wa_access_token.trim());
  if (b.wa_access_token === "__limpar__") setSetting("wa_access_token", "");
  if (typeof b.ifood_client_id === "string") setSetting("ifood_client_id", b.ifood_client_id.trim().slice(0, 80));
  if (typeof b.ifood_merchant_id === "string") setSetting("ifood_merchant_id", b.ifood_merchant_id.trim().slice(0, 80));
  if (typeof b.ifood_client_secret === "string" && b.ifood_client_secret.trim()) setSetting("ifood_client_secret", b.ifood_client_secret.trim());
  if (b.ifood_client_secret === "__limpar__") setSetting("ifood_client_secret", "");
  if (typeof b.whatsapp_enabled === "boolean") setSetting("whatsapp_enabled", b.whatsapp_enabled ? "1" : "0");
  if (typeof b.ifood_enabled === "boolean") setSetting("ifood_enabled", b.ifood_enabled ? "1" : "0");
  if (typeof b.printer_host === "string") setSetting("printer_host", b.printer_host.trim().slice(0, 80));
  if (typeof b.printer_port === "string") {
    const p = parseInt(b.printer_port, 10);
    if (!Number.isFinite(p) || p < 1 || p > 65535) return res.status(400).json({ error: "Porta inválida (1–65535)." });
    setSetting("printer_port", String(p));
  }
  if (typeof b.printer_enabled === "boolean") setSetting("printer_enabled", b.printer_enabled ? "1" : "0");
  if (typeof b.printer_auto === "boolean") setSetting("printer_auto", b.printer_auto ? "1" : "0");
  if (typeof b.service_charge_enabled === "boolean") setSetting("service_charge_enabled", b.service_charge_enabled ? "1" : "0");
  if (typeof b.service_charge_percent === "number" && b.service_charge_percent >= 0 && b.service_charge_percent <= 30) setSetting("service_charge_percent", String(b.service_charge_percent));
  audit(req.user.username, "config", JSON.stringify(b).slice(0, 200));
  broadcast();
  res.json({ ok: true });
});

// Dados exibidos no admin para configurar a InfinitePay
app.get("/api/settings/printer", requireRole("ADMIN", "GERENTE"), (_req, res) => {
  const st = staffSettings();
  res.json({
    enabled: st.printer_enabled === "1",
    auto: st.printer_auto !== "0",
    host: st.printer_host || "",
    port: st.printer_port || "9100",
    configured: !!(st.printer_enabled === "1" && st.printer_host),
  });
});

app.get("/api/settings/payments", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const ps = getPaymentSettings();
  const base = ps.appBaseUrl || publicBaseUrl(req);
  res.json({
    handle: ps.payHandle,
    baseUrl: ps.appBaseUrl,
    pixKey: ps.pixKey || "",
    webhookUrl: base + "/api/payments/infinitepay/webhook?secret=" + ps.webhookSecret,
    configured: !!(ps.payHandle || ps.pixKey),
  });
});

// ============================================================
// FRENTE DE CAIXA / PDV (Turnos, Suprimentos, Sangrias e Fechamento)
// ============================================================

app.get("/api/cash/current", requireRole("ADMIN", "GERENTE", "ATENDIMENTO"), (_req, res) => {
  const current = getCurrentCashRegister();
  res.json({ register: current });
});

app.post("/api/cash/open", requireRole("ADMIN", "GERENTE", "ATENDIMENTO"), (req, res) => {
  const b = req.body || {};
  try {
    const reg = openCashRegister({
      openedBy: req.user?.name || req.user?.username || "Operador",
      initialCash: b.initialCash,
      notes: b.notes,
    });
    audit(req.user.username, "abertura_caixa", `Fundo: R$ ${b.initialCash || 0}`);
    broadcast();
    res.status(201).json({ ok: true, register: reg });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/cash/transaction", requireRole("ADMIN", "GERENTE", "ATENDIMENTO"), (req, res) => {
  const b = req.body || {};
  try {
    const reg = addCashTransaction({
      type: b.type,
      amount: b.amount,
      reason: b.reason,
      method: b.method || "DINHEIRO",
      createdBy: req.user?.name || req.user?.username || "Operador",
      registerId: b.registerId,
    });
    audit(req.user.username, `movimentacao_caixa_${b.type?.toLowerCase()}`, `R$ ${b.amount} · ${b.reason}`);
    broadcast();
    res.json({ ok: true, register: reg });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/cash/close", requireRole("ADMIN", "GERENTE", "ATENDIMENTO"), (req, res) => {
  const b = req.body || {};
  try {
    const reg = closeCashRegister({
      registerId: b.registerId,
      closedBy: req.user?.name || req.user?.username || "Operador",
      closedCash: b.closedCash,
      declaredPix: b.declaredPix,
      declaredCard: b.declaredCard,
      notes: b.notes,
    });
    audit(req.user.username, "fechamento_caixa", `Dinheiro contado: R$ ${b.closedCash}`);
    broadcast();
    res.json({ ok: true, register: reg });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/cash/history", requireRole("ADMIN", "GERENTE", "ATENDIMENTO"), (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10)));
  const history = getCashHistory(limit);
  res.json({ history });
});

app.post("/api/cash/print-summary", requireRole("ADMIN", "GERENTE", "ATENDIMENTO"), async (req, res) => {
  const b = req.body || {};
  const current = b.registerId ? getCashHistory(50).find((x) => x.id === b.registerId) : getCurrentCashRegister();
  if (!current) return res.status(404).json({ error: "Turno de caixa não encontrado." });

  const st = staffSettings();
  if (st.printer_enabled === "1" && st.printer_host) {
    try {
      const port = parseInt(st.printer_port || "9100", 10);
      const lines = [
        "================================",
        "  TO NO SARRO - RESUMO DE CAIXA ",
        "================================",
        `Turno: ${current.id.slice(0, 8)}`,
        `Status: ${current.status === "OPEN" ? "ABERTO" : "FECHADO"}`,
        `Operador: ${current.openedBy}`,
        `Abertura: ${new Date(current.openedAt).toLocaleString("pt-BR")}`,
        current.closedAt ? `Fechamento: ${new Date(current.closedAt).toLocaleString("pt-BR")}` : "",
        "--------------------------------",
        `Fundo Inicial:      R$ ${current.summary.initialCash.toFixed(2)}`,
        `Vendas em Dinheiro: R$ ${current.summary.cashSales.toFixed(2)}`,
        `Suprimentos (+):    R$ ${current.summary.suprimentos.toFixed(2)}`,
        `Sangrias (-):       R$ ${current.summary.sangrias.toFixed(2)}`,
        "--------------------------------",
        `ESPERADO GAVETA:    R$ ${current.summary.expectedCash.toFixed(2)}`,
        current.summary.closedCash !== null ? `CONTADO GAVETA:     R$ ${current.summary.closedCash.toFixed(2)}` : "",
        current.summary.diffCash !== null ? `DIFERENCA:          R$ ${current.summary.diffCash.toFixed(2)}` : "",
        "--------------------------------",
        "VENDAS POR FORMA DE PAGAMENTO:",
        `Dinheiro: R$ ${current.summary.cashSales.toFixed(2)}`,
        `Pix:      R$ ${current.summary.pixSales.toFixed(2)}`,
        `Cartao:   R$ ${current.summary.cardSales.toFixed(2)}`,
        `TOTAL VENDIDO: R$ ${current.summary.totalSales.toFixed(2)} (${current.summary.orderCount} pedidos)`,
        "================================",
      ].filter(Boolean);

      await escpos.sendRaw(st.printer_host, port, Buffer.from(lines.join("\n") + "\n\n\n\n\x1d\x56\x00"));
      return res.json({ ok: true, printed: true });
    } catch (e) {
      console.warn("[print-cash] falha ao imprimir na rede:", e.message);
    }
  }

  res.json({ ok: true, printed: false, message: "Impressora de rede não configurada." });
});

app.get("/api/audit", requireRole("ADMIN"), (_req, res) => {
  res.json({ logs: db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100").all() });
});

// 404 da API
app.use("/api", (_req, res) => res.status(404).json({ error: "Rota não encontrada." }));

// ------------------------------------------------------------
// Estático — em produção servimos o build do Vite
// Bind em 0.0.0.0 é obrigatório no Render (listen() sem host cai em ::)
// ------------------------------------------------------------

// Cada painel tem URL própria (/admin, /cozinha, /expedicao, /entregador).
// Com barra no fim (/admin/) os assets relativos do Vite resolveriam em
// /admin/assets/... e a tela ficaria em branco — canonicaliza tirando a barra,
// preservando prefixo (subdiretório/preview).
const PANEL_PATHS = ["/admin", "/cozinha", "/expedicao", "/entregador"];

app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  const [pathname, query] = req.originalUrl.split("?");
  const clean = pathname.replace(/\/+$/, "");
  const lower = clean.toLowerCase();
  if (pathname !== clean && PANEL_PATHS.some((p) => lower.endsWith(p))) {
    return res.redirect(301, clean + (query ? `?${query}` : ""));
  }
  next();
});

const DIST = path.join(__dirname, "..", "dist");
const INDEX = path.join(DIST, "index.html");
const hasFrontend = fs.existsSync(INDEX);
if (hasFrontend) {
  app.use(express.static(DIST, { index: false }));
  app.get(/^(?!\/api|\/ws|\/healthz).*/, (_req, res) => {
    // Shell do SPA nunca cacheado: garante que o navegador sempre
    // carregue o bundle mais novo (os assets têm hash no nome).
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(INDEX);
  });
} else {
  app.get(/^(?!\/api|\/ws|\/healthz).*/, (_req, res) => {
    res.status(503).type("html").send(
      "<!doctype html><meta charset=utf-8><title>TÔ NO SARRO</title>" +
      "<body style='font-family:sans-serif;background:#050505;color:#fff;padding:48px'>" +
      "<h1>Build do frontend ausente</h1>" +
      "<p>Rode <code>npm run build</code> antes de <code>npm start</code>.</p>"
    );
  });
}

// Erros (incl. JSON malformado) — por último, pega falha do sendFile também
app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "JSON inválido." });
  console.error("[api]", err);
  res.status(500).json({ error: "Erro interno." });
});

server.listen(PORT, HOST, () => {
  console.log(`[api] TÔ NO SARRO backend em http://${HOST}:${PORT}`);
  console.log(`[api] WebSocket em ws://${HOST}:${PORT}/ws`);
  console.log(`[api] frontend: ${hasFrontend ? "dist/index.html ok" : "AUSENTE — npm run build"}`);
});

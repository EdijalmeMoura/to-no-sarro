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
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

import {
  db, audit, seedIfEmpty,
  getProducts, getOptionGroups, getBuilder, getCategories, getCoupons,
  getDrivers, getCustomers, getInventory, getPromos, getSettings,
  getSetting, setSetting, getOrders, getPaymentSettings,
  logIntegration, enqueueWhatsApp, markOutbox, getOutbox, getIntegrationLogs,
} from "./db.js";
import { attachUser, requireRole, login, logout, publicUser } from "./auth.js";
import { createCheckoutLink, paymentCheck, cents } from "./payments/infinitepay.js";
import { waCredentials, normalizePhone, buildOrderMessage, sendWhatsApp } from "./messaging/whatsapp.js";
import * as ifood from "./integrations/ifood.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

seedIfEmpty();

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());

// Headers de segurança básicos
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

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
  };
}

function broadcast() {
  const msg = JSON.stringify({ type: "sync", data: snapshot() });
  for (const c of wss.clients) {
    if (c.readyState === 1) c.send(msg);
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
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else {
    socket.destroy();
  }
});

// ------------------------------------------------------------
// AUTH
// ------------------------------------------------------------
app.post("/api/auth/login", login);
app.post("/api/auth/logout", logout);
app.get("/api/auth/me", (req, res) => res.json({ user: publicUser(req.user) }));

// ------------------------------------------------------------
// BOOTSTRAP — tudo que o app precisa em uma chamada
// ------------------------------------------------------------
app.get("/api/bootstrap", (_req, res) => {
  res.json({
    ...snapshot(),
    categories: getCategories(),
    optionGroups: getOptionGroups(),
    builder: getBuilder(),
    me: publicUser(_req.user),
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

function shapeOrder(o) {
  return o; // getOrders() já devolve o formato do frontend
}

app.post("/api/orders", (req, res) => {
  const body = req.body || {};
  const settings = getSettings();
  const isStaffChannel = ["IFOOD", "NNFOOD", "WHATSAPP"].includes(body.channel);
  if (isStaffChannel && !req.user) {
    return res.status(401).json({ error: "Canais externos exigem autenticação." });
  }

  if (!isStaffChannel && !settings.open) {
    return res.status(409).json({ error: "A loja está fechada agora. Voltamos às 18h!" });
  }

  const { customer = {}, items = [], type = "delivery", payment = "PIX", couponCode, note = "" } = body;
  const name = String(customer.name || "").trim();
  const phone = String(customer.phone || "").trim();
  const addr = String(customer.addr || "").trim();

  if (name.length < 3) return res.status(400).json({ error: "Informe seu nome completo." });
  if (phone.replace(/\D/g, "").length < 10) return res.status(400).json({ error: "WhatsApp inválido." });
  if (!["delivery", "pickup"].includes(type)) return res.status(400).json({ error: "Tipo de pedido inválido." });
  if (type === "delivery" && addr.length < 8) return res.status(400).json({ error: "Informe o endereço de entrega." });
  const PM_METHODS = new Set(["PIX", "CARTAO_ONLINE", "Cartão", "Dinheiro"]);
  if (!PM_METHODS.has(payment)) {
    return res.status(400).json({ error: "Forma de pagamento inválida." });
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > 60) {
    return res.status(400).json({ error: "Carrinho vazio ou inválido." });
  }
  if (typeof note !== "string" || note.length > 200) return res.status(400).json({ error: "Observação muito longa." });

  const prices = priceTable();
  const products = new Map(getProducts().map((p) => [p.id, p]));
  let subtotal = 0;
  const cleanItems = [];

  for (const it of items) {
    const p = products.get(String(it.productId));
    if (!p || !p.available) return res.status(400).json({ error: `Produto indisponível: ${it.productId}` });
    const qty = Math.floor(Number(it.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 20) return res.status(400).json({ error: `Quantidade inválida em ${p.name}.` });
    if (typeof (it.note ?? "") !== "string" || (it.note ?? "").length > 140) {
      return res.status(400).json({ error: `Observação muito longa em ${p.name}.` });
    }

    const optIds = Array.isArray(it.optionIds) ? it.optionIds.slice(0, 12).map(String) : [];
    const opts = [];
    let extra = 0;

    if (p.builder) {
      const byGroup = new Map();
      for (const oid of optIds) {
        const o = prices.get(oid);
        if (!o || !o.builder) return res.status(400).json({ error: `Opção inválida (${oid}) em ${p.name}.` });
        byGroup.set(o.group_id, o);
      }
      for (const gid of BUILDER_GROUPS) {
        const o = byGroup.get(gid);
        if (!o) return res.status(400).json({ error: `Escolha incompleta em ${p.name}.` });
        extra += o.price;
        opts.push({ id: o.id, name: o.name, price: o.price });
      }
    } else {
      const allowed = new Set(p.groups);
      for (const oid of optIds) {
        const o = prices.get(oid);
        if (!o || o.builder || !allowed.has(o.group_id)) {
          return res.status(400).json({ error: `Adicional inválido (${oid}) em ${p.name}.` });
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

  // Pedido mínimo (só delivery)
  if (type === "delivery" && subtotal < settings.minOrder) {
    return res.status(400).json({ error: `Pedido mínimo de R$ ${settings.minOrder.toFixed(2).replace(".", ",")} para entrega.` });
  }

  // Cupom
  let discount = 0;
  let fee = type === "pickup" ? 0 : settings.fee;
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

  db.exec("BEGIN");
  try {
    db.prepare(`
      INSERT INTO orders (id, code, channel, status, created_at, customer_name, customer_phone, customer_addr, payment, type, note, subtotal, fee, discount, total, payment_status)
      VALUES (?, ?, ?, 'NOVO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, code, channel, now, name, phone, type === "pickup" ? "Retirada na loja" : addr,
      paymentLabel, type, note, subtotal, fee, discount, total, paymentStatus);

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
  if (created) fireWhatsApp(created, "recebido");
  res.status(201).json({ order: shapeOrder(created) });
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
  const { status } = req.body || {};
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
  if (!VALID_STATUS.has(status)) return res.status(400).json({ error: "Status inválido." });

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
  db.prepare("UPDATE orders SET status = ?, started_at = ?, payment_status = CASE WHEN payment_status = 'pendente' AND ? IN ('CONFIRMADO','PREPARO','PRONTO','EMBALADO','AGUARDANDO','ROTA','ENTREGUE') THEN 'pago' ELSE payment_status END WHERE id = ?")
    .run(status, startedAt, status, o.id);

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

// ------------------------------------------------------------
// PAGAMENTO ONLINE — InfinitePay (Pix e Cartão)
// ------------------------------------------------------------

const ONLINE_PAYMENTS = new Set(["PIX", "Cartão online"]);

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
  if (paid) fireWhatsApp(paid, "pagamento_ok");
}

// Gera (ou reaproveita) o link de pagamento do pedido
app.post("/api/orders/:id/pay", async (req, res) => {
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
  if (!ONLINE_PAYMENTS.has(o.payment)) {
    return res.status(400).json({ error: "Este pedido não é pagamento online." });
  }
  if (o.payment_status === "pago") return res.json({ paid: true });

  const ps = getPaymentSettings();
  if (!ps.payHandle) {
    return res.status(409).json({ error: "Pagamento online ainda não configurado. Informe a InfiniteTag da InfinitePay no admin (Configurações)." });
  }

  // Reaproveita link pendente para não gerar cobrança duplicada
  const existing = db.prepare("SELECT * FROM payments WHERE order_id = ? AND status = 'pendente'").get(o.id);
  if (existing?.url) return res.json({ url: existing.url });

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

  let url;
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
    return res.status(502).json({ error: "InfinitePay indisponível agora. Tente de novo em instantes." });
  }

  db.prepare(`
    INSERT INTO payments (id, order_id, provider, order_nsu, url, status, amount, created_at)
    VALUES (?, ?, 'infinitepay', ?, ?, 'pendente', ?, ?)
  `).run(crypto.randomUUID(), o.id, o.id, url, cents(o.total), Date.now());
  db.prepare("UPDATE orders SET payment_status = 'pendente' WHERE id = ?").run(o.id);
  audit(o.customer_name, "link_pagamento", "#" + o.code + " · " + o.payment);
  broadcast();

  res.json({ url });
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
app.post("/api/orders/:id/payment_status", async (req, res) => {
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
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
const UPLOAD_DIR = path.join(__dirname, "data", "uploads");
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
    const name = `${p.id}-${Date.now().toString(36)}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.concat(chunks));
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
  audit(req.user.username, "config", JSON.stringify(b).slice(0, 200));
  broadcast();
  res.json({ ok: true });
});

// Dados exibidos no admin para configurar a InfinitePay
app.get("/api/settings/payments", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const ps = getPaymentSettings();
  const base = ps.appBaseUrl || publicBaseUrl(req);
  res.json({
    handle: ps.payHandle,
    baseUrl: ps.appBaseUrl,
    webhookUrl: base + "/api/payments/infinitepay/webhook?secret=" + ps.webhookSecret,
    configured: !!ps.payHandle,
  });
});

app.get("/api/audit", requireRole("ADMIN"), (_req, res) => {
  res.json({ logs: db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100").all() });
});

// 404 da API
app.use("/api", (_req, res) => res.status(404).json({ error: "Rota não encontrada." }));

// Erros (incl. JSON malformado)
app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "JSON inválido." });
  console.error("[api]", err);
  res.status(500).json({ error: "Erro interno." });
});

// ------------------------------------------------------------
// Estático — em produção servimos o build do Vite
// ------------------------------------------------------------
const DIST = path.join(__dirname, "..", "dist");
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^(?!\/api|\/ws).*/, (_req, res) => res.sendFile(path.join(DIST, "index.html")));
}

server.listen(PORT, () => {
  console.log(`[api] TÔ NO SARRO backend em http://localhost:${PORT}`);
  console.log(`[api] WebSocket em ws://localhost:${PORT}/ws`);
});

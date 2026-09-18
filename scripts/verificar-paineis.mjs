// ============================================================
// Teste de fumaça dos painéis por URL — roda o app REAL (bundle
// esbuild) dentro do jsdom, contra a API local.
//
//   npm run check:paineis
//
// Confere: raiz = cardápio do cliente (sem login da equipe);
// /admin, /cozinha, /expedicao, /entregador = login do painel
// certo e, com sessão, o painel certo; APIs de cupons, promoções,
// usuários e refresh de pedidos. Não faz parte do build.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BASE = process.env.BASE || "http://localhost:3001";
const APP = path.join(ROOT, "dist", "check", "app-iife.js");
const code = fs.readFileSync(APP, "utf8");

// Sobe a API se ela ainda não estiver no ar (e derruba no fim).
let child = null;
async function garantirApi() {
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(`${BASE}/healthz`);
      if (r.ok) return;
    } catch { /* ainda não subiu */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log("  · API fora do ar — subindo `node server/index.js`…");
  child = spawn(process.execPath, ["server/index.js"], { cwd: ROOT, stdio: "ignore" });
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(`${BASE}/healthz`)).ok) return;
    } catch { /* aguarda */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("A API não subiu em http://localhost:3001");
}
await garantirApi();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, total = 0;
const ok = (name, cond, extra = "") => {
  total++;
  if (cond) console.log(`  ✅ ${name}`);
  else { fails++; console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ""}`); }
};

// Sessão (cookie) compartilhada entre as "páginas" do teste
let cookie = "";
async function apiLogin(username, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const sc = r.headers.getSetCookie?.() || [];
  cookie = sc.map((c) => c.split(";")[0]).join("; ");
  return r.ok;
}

async function render(pathname) {
  const vc = new VirtualConsole(); // silencia ruído do jsdom
  const dom = new JSDOM(
    `<!doctype html><html><body><div id="root"></div></body></html>`,
    { url: BASE + pathname, runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc }
  );
  const { window } = dom;
  // fetch com cookie jar + URL absoluta
  window.fetch = (url, opts = {}) => {
    const headers = { ...(opts.headers || {}) };
    if (cookie) headers.cookie = cookie;
    return fetch(new URL(url.toString(), BASE), { ...opts, headers, redirect: "follow" })
      .then((res) => res);
  };
  window.WebSocket = WebSocket;
  window.scrollTo = () => {};
  const errs = [];
  window.addEventListener("error", (e) => errs.push(String(e.message)));
  window.eval(code);

  const text = () => window.document.body.textContent || "";
  for (let i = 0; i < 60; i++) {
    await sleep(100);
    if (!text().includes("ACENDENDO A CHAPA") && text().length > 40) break;
  }
  await sleep(250);
  return { window, text, errs, pathname: () => window.location.pathname };
}

const novoPainel = async (path, esperado) => {
  const { window, text, errs, pathname } = await render(path);
  ok(`${path} mostra o login de ${esperado}`, text().includes("ÁREA DA EQUIPE") && text().includes(`Painel de ${esperado}`), text().slice(0, 90).replace(/\s+/g, " "));
  ok(`${path} não vaza o cardápio do cliente`, !text().includes("Clube do Sarro"));
  ok(`${path} sem erro de JS`, errs.length === 0, errs[0]);
  window.close();
};

console.log("\n1) Cliente na raiz — sem login da equipe");
{
  const { window, text, errs, pathname } = await render("/");
  ok("/ abre o cardápio", /TÔ NO SARRO|Sarro Burger|Cardápio/i.test(text()));
  ok("/ NÃO pede login da equipe", !text().includes("ÁREA DA EQUIPE"));
  ok("/ sem erro de JS", errs.length === 0, errs[0]);
  ok("barra de atalhos oculta no cardápio", !window.document.querySelector('a[href="/cozinha"]') && !text().includes("SMART FOOD SYSTEM ·"));
  // clicar em "Área da equipe" no rodapé leva para /admin pedindo login
  const linkAdmin = window.document.querySelector('a[href="/admin"]');
  if (linkAdmin) linkAdmin.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await sleep(400);
  ok("clique em Área da equipe muda a URL para /admin", pathname() === "/admin", pathname());
  ok("clique em Área da equipe mostra o login", text().includes("ÁREA DA EQUIPE"));
  window.close();
}

console.log("\n2) Painéis por URL — login certo em cada um");
await novoPainel("/admin", "Admin");
await novoPainel("/cozinha", "Cozinha");
await novoPainel("/expedicao", "Expedição");
await novoPainel("/entregador", "Entregador");

console.log("\n3) Logado — cada URL cai no painel certo");
for (const [path, conta, marca] of [
  ["/admin", ["admin", "admin123"], "Relatório|Visão geral|Pedidos"],
  ["/cozinha", ["cozinha", "cozinha123"], "KDS|COZINHA|Fila"],
  ["/expedicao", ["expedicao", "expedicao123"], "Expedição|Despacho|Pronto"],
  ["/entregador", ["rafael", "entregador123"], "Entrega|Rota|Corridas"],
]) {
  cookie = "";
  await apiLogin(conta[0], conta[1]);
  const { window, text, errs, pathname } = await render(path);
  ok(`${path} entra direto no painel (${conta[0]})`, !text().includes("ÁREA DA EQUIPE"), text().slice(0, 90).replace(/\s+/g, " "));
  ok(`${path} renderiza conteúdo do painel`, new RegExp(marca, "i").test(text()));
  ok(`${path} sem erro de JS`, errs.length === 0, errs[0]);
  window.close();
}

console.log("\n4) APIs — cupons, promoções, usuários e refresh de pedidos");
{
  const req = async (method, path, body, jar) => {
    const r = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", ...(jar ? { cookie: jar } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = {};
    try { data = await r.json(); } catch { /* vazio */ }
    return { status: r.status, ok: r.ok, data };
  };
  const loginJar = async (u, pw) => {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: pw }),
    });
    const sc = r.headers.getSetCookie?.() || [];
    return { ok: r.ok, status: r.status, jar: sc.map((c) => c.split(";")[0]).join("; ") };
  };
  const admin = (await loginJar("admin", "admin123")).jar;
  const gerente = (await loginJar("gerente", "gerente123")).jar;
  const tag = String(Date.now() % 100000);
  const boot = async () => (await req("GET", "/api/bootstrap", undefined, admin)).data;

  // Cupons (6)
  const CCODE = `TST${tag}`;
  const c1 = await req("POST", "/api/coupons", { code: CCODE, type: "percent", value: 10, min: 40, note: "check" }, admin);
  ok("cria cupom (201)", c1.status === 201 && c1.data.coupon?.code === CCODE, JSON.stringify(c1.data).slice(0, 80));
  const c2 = await req("POST", "/api/coupons", { code: `${CCODE}X`, type: "percent", value: 99 }, admin);
  ok("rejeita percent > 90 (400)", c2.status === 400);
  const c3 = await req("POST", "/api/coupons", { code: CCODE, type: "fixed", value: 5 }, admin);
  ok("rejeita código duplicado (409)", c3.status === 409);
  const c4 = await req("PATCH", `/api/coupons/${CCODE}`, { active: false }, admin);
  ok("pausa cupom", c4.ok);
  const c5 = await req("POST", "/api/coupons/validate", { code: CCODE, subtotal: 100 });
  ok("cupom pausado não valida no checkout", !c5.ok);
  const c6 = await req("DELETE", `/api/coupons/${CCODE}`, undefined, admin);
  const c6b = await boot();
  ok("exclui cupom e some do refresh", c6.ok && !c6b.coupons.some((c) => c.code === CCODE));

  // Promoções programadas (6)
  const t0 = Date.now();
  const p1 = await req("POST", "/api/promos",
    { name: `Check ${tag}`, rule: "validação automática", window: "só no teste", starts_at: t0, ends_at: t0 + 3600000 }, admin);
  const PID = p1.data.promo?.id;
  ok("cria promoção com vigência", p1.status === 201 && p1.data.promo?.startsAt === t0, JSON.stringify(p1.data).slice(0, 100));
  const p2 = await req("POST", "/api/promos", { name: `Check ruim ${tag}`, starts_at: t0 + 5000, ends_at: t0 }, admin);
  ok("rejeita fim antes do início (400)", p2.status === 400);
  const p3 = await req("PATCH", `/api/promos/${PID}`, { rule: "editada pelo check" }, admin);
  ok("edita promoção", p3.ok);
  const p4 = await req("PATCH", `/api/promos/${PID}`, { active: false }, admin);
  ok("pausa promoção", p4.ok);
  const p5 = await boot();
  ok("promoção aparece no refresh", p5.promos.some((x) => x.id === PID));
  const p6 = await req("DELETE", `/api/promos/${PID}`, undefined, admin);
  ok("exclui promoção", p6.ok);

  // Usuários (7 — só admin)
  const u1 = await req("GET", "/api/users", undefined, admin);
  ok("lista usuários sem vazar hash", u1.ok && !JSON.stringify(u1.data).includes("pass_hash") && "lastLoginAt" in (u1.data.users?.[0] || {}));
  const UNAME = `tst${tag}`;
  const u2 = await req("POST", "/api/users", { name: "Check User", username: UNAME, password: "check12345", role: "COZINHA" }, admin);
  const UID = u2.data.user?.id;
  ok("cria usuário", u2.status === 201 && !!UID, JSON.stringify(u2.data).slice(0, 80));
  const u3 = await req("POST", "/api/users", { name: "X", username: UNAME, password: "check12345", role: "COZINHA" }, admin);
  ok("rejeita login duplicado (409)", u3.status === 409);
  const u4 = await req("GET", "/api/users", undefined, gerente);
  ok("gerente não acessa gestão (403)", u4.status === 403);
  const uJar = (await loginJar(UNAME, "check12345")).jar;
  const u5 = await req("PATCH", `/api/users/${UID}`, { password: "nova12345" }, admin);
  const u5me = await req("GET", "/api/auth/me", undefined, uJar);
  ok("troca de senha derruba a sessão", u5.ok && u5me.data.user === null);
  const u6a = await req("PATCH", `/api/users/${UID}`, { active: false }, admin);
  const u6b = await loginJar(UNAME, "nova12345");
  const u6c = await req("PATCH", `/api/users/${UID}`, { active: true }, admin);
  ok("desativar bloqueia o login (403)", u6a.ok && u6b.status === 403 && u6c.ok, `login=${u6b.status}`);
  const u7a = await req("DELETE", `/api/users/${UID}`, undefined, admin);
  const u7b = await req("DELETE", "/api/users/u1", undefined, admin);
  ok("exclui usuário e bloqueia auto-exclusão", u7a.ok && u7b.status === 400);

  // Refresh de pedidos (3)
  const o1 = await req("POST", "/api/orders", {
    customer: { name: "Teste Refresh", phone: "(81) 99999-1111", addr: "Rua Teste, 100 — Janga" },
    items: [{ productId: "p1", qty: 2, optionIds: [], note: "" }],
    type: "delivery", payment: "Dinheiro",
  });
  ok("cria pedido via API", o1.status === 201 && !!o1.data.order?.id, JSON.stringify(o1.data).slice(0, 100));
  const o2 = await boot();
  ok("pedido aparece no refresh", o2.orders.some((o) => o.id === o1.data.order?.id));
  const o3 = await req("PATCH", `/api/orders/${o1.data.order.id}/status`, { status: "CONFIRMADO" }, admin);
  const o3b = await boot();
  ok("muda status e refresh reflete", o3.ok && o3b.orders.find((o) => o.id === o1.data.order.id)?.status === "CONFIRMADO");
}

console.log(fails === 0 ? `\n🎉 tudo verde — ${total} checagens\n` : `\n💥 ${fails} falha(s) em ${total}\n`);
child?.kill();
process.exit(fails === 0 ? 0 : 1);

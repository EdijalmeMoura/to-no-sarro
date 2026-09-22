// ============================================================
// Teste de fumaça dos painéis por URL — roda o app REAL (bundle
// esbuild) dentro do jsdom, contra a API local.
//
//   npm run check:paineis
//
// Confere: raiz = cardápio do cliente (sem login da equipe);
// /admin, /cozinha, /expedicao, /entregador = login do painel
// certo e, com sessão, o painel certo. Não faz parte do build.
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
let fails = 0;
const ok = (name, cond, extra = "") => {
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

console.log("\n1) Cliente na raiz — cardápio limpo, sem login da equipe");
{
  const { window, text, errs } = await render("/");
  ok("/ abre o cardápio", /TÔ NO SARRO|Sarro Burger|Cardápio/i.test(text()));
  ok("/ NÃO pede login da equipe", !text().includes("ÁREA DA EQUIPE"));
  // por design a barra de atalhos da equipe é só do ADMIN; na raiz o
  // cardápio fica 100% limpo para pedido
  ok("/ não mostra a barra da equipe para o cliente", !text().includes("SMART FOOD SYSTEM"));
  ok("/ sem erro de JS", errs.length === 0, errs[0]);
  window.close();
}

console.log("\n2) Painéis por URL — login certo em cada um");
await novoPainel("/admin", "Admin");
await novoPainel("/cozinha", "Cozinha");
await novoPainel("/expedicao", "Expedição");
await novoPainel("/entregador", "Entregador");
await novoPainel("/paineltv", "Painel TV");

console.log("\n2b) Admin logado — barra com atalho para cada painel");
{
  cookie = "";
  await apiLogin("admin", "admin123");
  const { window, text, errs, pathname } = await render("/admin");
  const atalhos = ["/admin", "/cozinha", "/expedicao", "/entregador", "/paineltv"];
  ok("barra do admin tem os atalhos dos painéis", atalhos.every((p) => window.document.querySelector(`a[href="${p}"]`)), text().slice(0, 80).replace(/\s+/g, " "));
  ok("atalho do entregador aponta para /entregador", !!window.document.querySelector('a[href="/entregador"]'));
  window.document.querySelector('a[href="/entregador"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await sleep(500);
  ok("clique no atalho muda a URL para /entregador", pathname() === "/entregador", pathname());
  ok("admin cai no login do entregador (perfil dele não tem acesso)", text().includes("ÁREA DA EQUIPE"), text().slice(0, 80).replace(/\s+/g, " "));
  ok("/admin sem erro de JS", errs.length === 0, errs[0]);
  window.close();
}

console.log("\n3) Logado — cada URL cai no painel certo");
for (const [path, conta, marca] of [
  ["/admin", ["admin", "admin123"], "Relatório|Visão geral|Pedidos"],
  ["/cozinha", ["cozinha", "cozinha123"], "KDS|COZINHA|Fila"],
  ["/expedicao", ["expedicao", "expedicao123"], "Expedição|Despacho|Pronto"],
  ["/entregador", ["rafael", "entregador123"], "MINHAS ENTREGAS"],
  ["/paineltv", ["admin", "admin123"], "PAINEL|SENHAS|Ordem de Produção|TV"],
]) {
  cookie = "";
  await apiLogin(conta[0], conta[1]);
  const { window, text, errs, pathname } = await render(path);
  ok(`${path} entra direto no painel (${conta[0]})`, !text().includes("ÁREA DA EQUIPE"), text().slice(0, 90).replace(/\s+/g, " "));
  ok(`${path} renderiza conteúdo do painel`, new RegExp(marca, "i").test(text()));
  ok(`${path} sem erro de JS`, errs.length === 0, errs[0]);
  window.close();
}

console.log("\n4) Área do entregador — aceite de corrida no /entregador");
{
  const asUser = (path, opts = {}) => fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}), ...(cookie ? { cookie } : {}) },
  });

  const anon = await fetch(`${BASE}/api/bootstrap`).then((r) => r.json());
  const produto = anon.products.find((x) => x.active !== 0) || anon.products[0];
  const minimo = Math.max(1, Math.ceil((anon.settings?.min_order || 25) / (produto.price || produto.preco || 10)));
  const criado = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: "DIRECT",
      type: "delivery",
      payment: "Dinheiro",
      customer: { name: "Teste Fumaça Sarro", phone: "(81) 99000-7777", addr: "Rua do Teste, 123 — Janga, Paulista/PE" },
      items: [{ productId: produto.id, qty: minimo }],
    }),
  });
  const corpo = await criado.json();
  const oid = corpo?.order?.id;
  ok("pedido de teste criado para o fluxo da entrega", !!oid, JSON.stringify(corpo).slice(0, 120));
  if (!oid) {
    console.log("  ⚠️ sem pedido de teste — pulando o resto do bloco 4");
  } else {
    // rafael → d1: atribuir para OUTRO motoboy tem que continuar proibido
    cookie = "";
    await apiLogin("rafael", "entregador123");
    const alheio = await asUser(`/api/orders/${oid}/driver`, { method: "PATCH", body: JSON.stringify({ driverId: "d2" }) });
    ok("entregador NÃO atribui a corrida para outro motoboy", alheio.status === 403, `HTTP ${alheio.status}`);

    const cedo = await asUser(`/api/orders/${oid}/driver`, { method: "PATCH", body: JSON.stringify({ driverId: "d1" }) });
    ok("entregador NÃO aceita o que a expedição ainda não liberou", cedo.status === 403, `HTTP ${cedo.status}`);

    // a expedição libera a corrida para retirada pelo motoboy
    cookie = "";
    await apiLogin("expedicao", "expedicao123");
    const liberado = await asUser(`/api/orders/${oid}/status`, { method: "PATCH", body: JSON.stringify({ status: "AGUARDANDO" }) });
    ok("expedição libera o pedido para entrega", liberado.status === 200, `HTTP ${liberado.status}`);

    cookie = "";
    await apiLogin("rafael", "entregador123");
    const self = await asUser(`/api/orders/${oid}/driver`, { method: "PATCH", body: JSON.stringify({ driverId: "d1" }) });
    ok("entregador ACEITA a própria corrida", self.status === 200, `HTTP ${self.status}`);

    // bootstrap anonônimo não devolve pedidos (snapshot público) — usa a sessão do motoboy
    const aceito = await asUser("/api/bootstrap").then((r) => r.json());
    const o = aceito.orders.find((x) => x.id === oid);
    ok("pedido aceito aparece na lista do motoboy", o?.status === "ROTA" && o?.driverId === "d1", `${o?.status}/${o?.driverId}`);

    const status = await asUser(`/api/orders/${oid}/status`, { method: "PATCH", body: JSON.stringify({ status: "CANCELADO" }) });
    ok("entregador NÃO cancela pedido pela área dele", status.status === 403, `HTTP ${status.status}`);

    const acerto = await asUser("/api/drivers/d1/settlement");
    ok("entregador consulta o próprio acerto", acerto.status === 200, `HTTP ${acerto.status}`);
    const fechar = await asUser("/api/drivers/d1/settle", { method: "POST", body: JSON.stringify({ basePay: 0, notes: "teste" }) });
    ok("fechar acerto continua sendo papel da loja", fechar.status === 403, `HTTP ${fechar.status}`);

    // e o painel renderiza a corrida aceita, com as ações do motoboy
    const { window, text, errs } = await render("/entregador");
    ok("/entregador lista a corrida aceita", text().includes(`#${o?.code}`), text().slice(0, 80).replace(/\s+/g, " "));
    ok("/entregador mostra as ações do motoboy", ["CHEGUEI NO LOCAL", "PEDIDO ENTREGUE", "VER ROTA", "PROBLEMA"].every((a) => text().includes(a)), text().slice(0, 120).replace(/\s+/g, " "));
    ok("/entregador mostra o aviso de cobrança", text().includes("COBRAR EM DINHEIRO"));
    ok("/entregador não mostra as entregas de outro motoboy", !text().includes("Jonas") && !text().includes("Bia"));

    const botaoAcerto = [...window.document.querySelectorAll("button")].find((b) => /Meu Acerto/.test(b.textContent));
    ok("/entregador tem o atalho do próprio acerto", !!botaoAcerto);
    botaoAcerto?.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await sleep(700);
    const textoAcerto = text();
    ok("/entregador abre o acerto de turno", textoAcerto.includes("ACERTO DE ENTREGADOR") && textoAcerto.includes("Rafael"), textoAcerto.slice(0, 80).replace(/\s+/g, " "));
    ok("/entregador NÃO pode quitar o próprio acerto", !textoAcerto.includes("QUITAR & FECHAR ACERTO"));
    ok("/entregador sem erro de JS", errs.length === 0, errs[0]);
    window.close();

    // limpa o pedido de teste para não sujar o banco do dev
    cookie = "";
    await apiLogin("admin", "admin123");
    await asUser(`/api/orders/${oid}/status`, { method: "PATCH", body: JSON.stringify({ status: "CANCELADO" }) });
  }
}

console.log("\n5) Admin > Entregadores — acertos e preview da área do motoboy");
{
  cookie = "";
  await apiLogin("admin", "admin123");
  const { window, text, errs } = await render("/admin");
  const nav = [...window.document.querySelectorAll("button")].find((b) => /Entregadores\s*$/.test(b.textContent.trim()));
  ok("sidebar do admin tem a seção Entregadores", !!nav);
  nav?.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await sleep(700);
  const tela = text();
  ok("seção abre com a gestão de rotas e acertos", tela.includes("gestão de rotas e acertos"), tela.slice(0, 80).replace(/\s+/g, " "));
  ok("admin vê o preview da área do entregador", tela.includes("MINHAS ENTREGAS"));
  ok("admin fecha o acerto de cada motoboy", [...window.document.querySelectorAll("button")].some((b) => /Fechar acerto/.test(b.textContent)));
  const hist = [...window.document.querySelectorAll("button")].find((b) => /Histórico de acertos/.test(b.textContent));
  ok("admin tem o histórico de acertos", !!hist);
  hist?.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await sleep(600);
  ok("histórico de acertos abre", text().includes("HISTÓRICO DE ACERTOS DE ENTREGADORES"));
  ok("/admin > entregadores sem erro de JS", errs.length === 0, errs[0]);
  window.close();
}

console.log(fails === 0 ? "\n🎉 tudo verde\n" : `\n💥 ${fails} falha(s)\n`);
child?.kill();
process.exit(fails === 0 ? 0 : 1);

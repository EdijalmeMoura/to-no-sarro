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

console.log("\n1) Cliente na raiz — sem login da equipe");
{
  const { window, text, errs, pathname } = await render("/");
  ok("/ abre o cardápio", /TÔ NO SARRO|Sarro Burger|Cardápio/i.test(text()));
  ok("/ NÃO pede login da equipe", !text().includes("ÁREA DA EQUIPE"));
  ok("/ sem erro de JS", errs.length === 0, errs[0]);
  ok("barra tem os atalhos dos painéis", ["/admin", "/cozinha", "/expedicao", "/entregador"].every((p) => window.document.querySelector(`a[href="${p}"]`)));
  // clicar em "Admin" leva para /admin pedindo login
  window.document.querySelector('a[href="/admin"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await sleep(400);
  ok("clique em Admin muda a URL para /admin", pathname() === "/admin", pathname());
  ok("clique em Admin mostra o login", text().includes("ÁREA DA EQUIPE"));
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

console.log(fails === 0 ? "\n🎉 tudo verde\n" : `\n💥 ${fails} falha(s)\n`);
child?.kill();
process.exit(fails === 0 ? 0 : 1);

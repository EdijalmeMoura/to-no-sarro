import React, { useState, useEffect, useMemo, useRef } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";
import ServiceChargeCard from "./ServiceChargeCard.jsx";

function AdminIntegrations({ store }) {
  const [ov, setOv] = useState(null);
  const [wa, setWa] = useState({ phone_number_id: "", token: "", verify: "", template: "tonosarro_status" });
  const [iff, setIff] = useState({ client_id: "", secret: "", merchant_id: "" });
  const [nn, setNn] = useState({ client_id: "", secret: "", store_id: "" });
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

  const saveNn = async (enabledDelta) => {
    setBusy("nn");
    try {
      const body = {
        nnfood_client_id: nn.client_id || undefined,
        nnfood_store_id: nn.store_id || undefined,
        nnfood_client_secret: nn.secret || undefined,
      };
      if (typeof enabledDelta === "boolean") body.nnfood_enabled = enabledDelta;
      Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
      await api("/api/settings", { method: "PATCH", body });
      setNn({ client_id: "", secret: "", store_id: "" });
      await load();
      say(enabledDelta === undefined ? "Credenciais da 99Food salvas ✓" : enabledDelta ? "99Food ativada ✓" : "99Food pausada");
    } catch (e) { say(e.message); }
    setBusy("");
  };

  const testNn = async () => {
    setBusy("tnn");
    try {
      await api("/api/integrations/nnfood/test", { method: "POST" });
      say("Conexão com a 99Food/99Entregas OK ✓");
      await load();
    } catch (e) { say(e.message); await load(); }
    setBusy("");
  };

  const w = ov?.whatsapp || {};
  const f = ov?.ifood || {};
  const n = ov?.nnfood || {};

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

        {/* 99FOOD & 99ENTREGAS */}
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>🟡 99Food & 99Entregas — API oficial</span>
            <span
              className="rounded-full px-2.5 py-1 font-bold"
              style={{
                fontSize: 10,
                background: n.configured ? `${C.green}1f` : `${C.yellow}1f`,
                color: n.configured ? C.green : C.yellow,
                border: `1px solid ${n.configured ? C.green : C.yellow}44`,
              }}
            >
              {n.configured ? (n.enabled ? "ATIVO" : "CONFIGURADO · PAUSADO") : "FALTA CREDENCIAL"}
            </span>
          </div>
          <p style={{ color: "#8a8a8a", fontSize: 11.5, marginTop: 6, lineHeight: 1.5 }}>
            Recebimento de pedidos da <strong style={{ color: "#FFD400" }}>99Food</strong> direto na cozinha e despacho integrado via <strong style={{ color: "#FFD400" }}>99Entregas</strong>.
            Insira suas credenciais de parceiro da plataforma 99 para habilitar a sincronização.
          </p>
          <div className="grid md:grid-cols-3 gap-2 mt-3">
            <input value={nn.client_id} onChange={(e) => setNn({ ...nn, client_id: e.target.value })}
              placeholder={n.clientId ? `Client ID: ${n.clientId}` : "Client ID / App Key"} className="rounded-lg px-2.5 py-2 outline-none" style={inField} />
            <input value={nn.secret} onChange={(e) => setNn({ ...nn, secret: e.target.value })} type="password"
              placeholder={n.configured ? "Secret •••• salvo (deixe vazio p/ manter)" : "Client Secret / App Secret"} className="rounded-lg px-2.5 py-2 outline-none" style={inField} />
            <input value={nn.store_id} onChange={(e) => setNn({ ...nn, store_id: e.target.value })}
              placeholder={n.storeId ? `Store ID: ${n.storeId}` : "Store ID da loja na 99"} className="rounded-lg px-2.5 py-2 outline-none" style={inField} />
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Btn small disabled={busy === "nn"} onClick={() => saveNn(undefined)}>Salvar credenciais</Btn>
            <Btn small variant={n.enabled ? "dark" : "green"} disabled={busy === "nn"} onClick={() => saveNn(!n.enabled)}>
              {n.enabled ? "⏸ Pausar" : "▶ Ativar 99Food"}
            </Btn>
            <Btn small variant="dark" disabled={busy === "tnn" || !n.configured} onClick={testNn}>
              {busy === "tnn" ? "…" : "Testar conexão"}
            </Btn>
            <Btn small variant="dark" onClick={() => store.injectExternal("NNFOOD")}>
              + Simular pedido 99Food
            </Btn>
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


export default AdminIntegrations;

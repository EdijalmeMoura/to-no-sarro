import React, { useState, useEffect } from "react";
import { C } from "../../constants/theme.js";
import { api } from "../../utils/api.js";
import { Card, Btn } from "../ui/index.jsx";

function WaIcon({ size = 16, color = "#25D366" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export default function AdminIntegrations({ store }) {
  const [ov, setOv] = useState(null);
  const [wa, setWa] = useState({ phone_number_id: "", token: "", verify: "", template: "tonosarro_status" });
  const [iff, setIff] = useState({ client_id: "", secret: "", merchant_id: "" });
  const [nn, setNn] = useState({ client_id: "", secret: "", store_id: "" });
  const [testPhone, setTestPhone] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const load = () => api("/api/integrations/overview").then(setOv).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, []);
  const say = (m) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };
  const inField = { background: C.black, border: `1px solid ${C.gray800}`, color: C.white, fontSize: 12 };
  const saveWa = async (enabledDelta) => {
    setBusy("wa");
    try {
      const body = { wa_phone_number_id: wa.phone_number_id || undefined, wa_verify_token: wa.verify || undefined, wa_template: wa.template || undefined, wa_access_token: wa.token || undefined };
      if (typeof enabledDelta === "boolean") body.whatsapp_enabled = enabledDelta;
      Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
      await api("/api/settings", { method: "PATCH", body });
      setWa({ phone_number_id: "", token: "", verify: "", template: wa.template });
      await load(); say(enabledDelta === undefined ? "Credenciais salvas ✓" : enabledDelta ? "WhatsApp ativado ✓" : "WhatsApp pausado");
    } catch (e) { say(e.message); } setBusy("");
  };
  const saveIfood = async (enabledDelta) => {
    setBusy("if");
    try {
      const body = { ifood_client_id: iff.client_id || undefined, ifood_merchant_id: iff.merchant_id || undefined, ifood_client_secret: iff.secret || undefined };
      if (typeof enabledDelta === "boolean") body.ifood_enabled = enabledDelta;
      Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
      await api("/api/settings", { method: "PATCH", body });
      setIff({ client_id: "", secret: "", merchant_id: "" }); await load(); say("iFood salvo ✓");
    } catch (e) { say(e.message); } setBusy("");
  };
  const testWa = async () => { setBusy("twa"); try { await api("/api/integrations/whatsapp/test", { method: "POST", body: { phone: testPhone } }); say("Teste disparado"); await load(); } catch (e) { say(e.message); } setBusy(""); };
  const testIfood = async () => { setBusy("tif"); try { await api("/api/integrations/ifood/test", { method: "POST" }); say("iFood OK ✓"); await load(); } catch (e) { say(e.message); } setBusy(""); };
  const saveNn = async (enabledDelta) => {
    setBusy("nn");
    try {
      const body = { nnfood_client_id: nn.client_id || undefined, nnfood_store_id: nn.store_id || undefined, nnfood_client_secret: nn.secret || undefined };
      if (typeof enabledDelta === "boolean") body.nnfood_enabled = enabledDelta;
      Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
      await api("/api/settings", { method: "PATCH", body });
      setNn({ client_id: "", secret: "", store_id: "" }); await load(); say("99Food salvo ✓");
    } catch (e) { say(e.message); } setBusy("");
  };
  const testNn = async () => { setBusy("tnn"); try { await api("/api/integrations/nnfood/test", { method: "POST" }); say("99Food OK ✓"); await load(); } catch (e) { say(e.message); } setBusy(""); };
  const w = ov?.whatsapp || {}; const f = ov?.ifood || {}; const n = ov?.nnfood || {};
  return (
    <div className="space-y-4">
      {msg && <div className="rounded-xl px-3 py-2.5" style={{ background: `${C.orange}18`, color: C.orange, fontSize: 12.5, fontWeight: 700 }}>{msg}</div>}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2" style={{ color: C.white, fontWeight: 900, fontSize: 15 }}><WaIcon /> WhatsApp Cloud API</span>
            <span className="rounded-full px-2.5 py-1 font-bold" style={{ fontSize: 10, background: w.configured ? `${C.green}1f` : `${C.yellow}1f`, color: w.configured ? C.green : C.yellow }}>{w.configured ? (w.enabled ? "ATIVO" : "PAUSADO") : "FALTA CREDENCIAL"}</span>
          </div>
          <div className="mt-3 space-y-2">
            <input value={wa.phone_number_id} onChange={(e) => setWa({ ...wa, phone_number_id: e.target.value })} placeholder={w.phoneId ? `Phone ID: ${w.phoneId}` : "Phone Number ID"} className="w-full rounded-lg px-2.5 py-2 outline-none" style={inField} />
            <input value={wa.token} onChange={(e) => setWa({ ...wa, token: e.target.value })} type="password" placeholder="Access Token" className="w-full rounded-lg px-2.5 py-2 outline-none" style={inField} />
            <input value={wa.verify} onChange={(e) => setWa({ ...wa, verify: e.target.value })} type="password" placeholder="Verify Token" className="w-full rounded-lg px-2.5 py-2 outline-none" style={inField} />
            <input value={wa.template} onChange={(e) => setWa({ ...wa, template: e.target.value })} placeholder="Template" className="w-full rounded-lg px-2.5 py-2 outline-none" style={inField} />
          </div>
          <div className="flex gap-2 mt-3">
            <Btn small disabled={busy === "wa"} onClick={() => saveWa(undefined)}>Salvar</Btn>
            <Btn small variant={w.enabled ? "dark" : "green"} disabled={busy === "wa"} onClick={() => saveWa(!w.enabled)}>{w.enabled ? "⏸ Pausar" : "▶ Ativar"}</Btn>
          </div>
          {w.enabled && (
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.gray800}` }}>
              <div className="flex gap-2">
                <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="(81) 99999-0000" className="flex-1 rounded-lg px-2.5 py-2 outline-none" style={inField} />
                <Btn small disabled={busy === "twa" || !testPhone} onClick={testWa}>{busy === "twa" ? "…" : "Enviar teste"}</Btn>
              </div>
            </div>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between"><span style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>🔴 iFood</span><span className="rounded-full px-2.5 py-1 font-bold" style={{ fontSize: 10, background: f.configured ? `${C.green}1f` : `${C.yellow}1f`, color: f.configured ? C.green : C.yellow }}>{f.configured ? (f.enabled ? "ATIVO" : "PAUSADO") : "FALTA"}</span></div>
          <div className="mt-3 space-y-2">
            <input value={iff.client_id} onChange={(e) => setIff({ ...iff, client_id: e.target.value })} placeholder="Client ID" className="w-full rounded-lg px-2.5 py-2 outline-none" style={inField} />
            <input value={iff.secret} onChange={(e) => setIff({ ...iff, secret: e.target.value })} type="password" placeholder="Client Secret" className="w-full rounded-lg px-2.5 py-2 outline-none" style={inField} />
            <input value={iff.merchant_id} onChange={(e) => setIff({ ...iff, merchant_id: e.target.value })} placeholder="Merchant ID" className="w-full rounded-lg px-2.5 py-2 outline-none" style={inField} />
          </div>
          <div className="flex gap-2 mt-3"><Btn small onClick={() => saveIfood(undefined)}>Salvar</Btn><Btn small variant={f.enabled ? "dark" : "green"} onClick={() => saveIfood(!f.enabled)}>{f.enabled ? "⏸" : "▶ Ativar"}</Btn><Btn small variant="dark" onClick={testIfood}>Testar</Btn></div>
        </Card>
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between"><span style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>🟡 99Food & 99Entregas</span><span className="rounded-full px-2.5 py-1 font-bold" style={{ fontSize: 10, background: n.configured ? `${C.green}1f` : `${C.yellow}1f`, color: n.configured ? C.green : C.yellow }}>{n.configured ? (n.enabled ? "ATIVO" : "PAUSADO") : "FALTA"}</span></div>
          <div className="grid md:grid-cols-3 gap-2 mt-3">
            <input value={nn.client_id} onChange={(e) => setNn({ ...nn, client_id: e.target.value })} placeholder="Client ID" className="rounded-lg px-2.5 py-2 outline-none" style={inField} />
            <input value={nn.secret} onChange={(e) => setNn({ ...nn, secret: e.target.value })} type="password" placeholder="Secret" className="rounded-lg px-2.5 py-2 outline-none" style={inField} />
            <input value={nn.store_id} onChange={(e) => setNn({ ...nn, store_id: e.target.value })} placeholder="Store ID" className="rounded-lg px-2.5 py-2 outline-none" style={inField} />
          </div>
          <div className="flex gap-2 mt-3"><Btn small onClick={() => saveNn(undefined)}>Salvar</Btn><Btn small variant={n.enabled ? "dark" : "green"} onClick={() => saveNn(!n.enabled)}>{n.enabled ? "⏸" : "▶ Ativar"}</Btn><Btn small variant="dark" onClick={testNn}>Testar</Btn><Btn small variant="dark" onClick={() => store.injectExternal("NNFOOD")}>+ Simular pedido 99Food</Btn></div>
        </Card>
      </div>
      <Card className="p-4">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14, marginBottom: 8 }}>📤 Fila de mensagens</div>
        <div className="space-y-2">{(ov?.outbox || []).length === 0 && <div style={{ color: "#6a6a6a", fontSize: 12 }}>Nenhuma mensagem ainda</div>}{(ov?.outbox || []).map((m) => (<div key={m.id} className="rounded-xl p-3" style={{ background: C.black, border: `1px solid ${C.gray800}` }}><div style={{ color: "#9a9a9a", fontSize: 10.5 }}>{m.to} · {new Date(m.at).toLocaleTimeString("pt-BR")}</div><div style={{ color: "#d0d0d0", fontSize: 12, whiteSpace: "pre-wrap" }}>{m.body}</div></div>))}</div>
      </Card>
      <Card className="p-4">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14, marginBottom: 8 }}>📜 Diário</div>
        <div className="space-y-1">{(ov?.logs || []).map((l) => (<div key={l.id} className="flex gap-2" style={{ fontSize: 11.5 }}><span style={{ color: "#5a5a5a" }}>{new Date(l.at).toLocaleTimeString("pt-BR")}</span><span style={{ color: l.level === "erro" ? C.red : "#c0c0c0" }}>{l.msg}</span></div>))}</div>
      </Card>
    </div>
  );
}

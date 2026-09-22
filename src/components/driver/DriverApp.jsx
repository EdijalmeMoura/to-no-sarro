// ============================================================
// ÁREA DO ENTREGADOR — /entregador
//
// O que o motoboy faz aqui, na ordem do turno:
//   1. vê o que a expedição liberou e ACEITA a entrega
//   2. abre a rota no Google Maps / Waze (rota composta multi-parada
//      quando a loja despachou mais de uma entrega na mesma volta)
//   3. avisa o cliente no WhatsApp que chegou
//   4. confirma a entrega já com a regra de cobrança na tela
//      (já pago online / cartão na maquininha / dinheiro)
//   5. relata problema com ações prontas (cliente não atende,
//      endereço errado, suporte da loja)
//   6. confere o próprio acerto de turno (o fechamento é da loja)
//
// `driverOverride` é usado pelo preview do admin (/admin > Entregadores).
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import { C, font } from "../../constants/theme.js";
import { brl, elapsed } from "../../utils/format.js";
import { buildGoogleMapsMultiStopUrl } from "../../utils/print.js";
import { playRouteAlert } from "../../utils/sound.js";
import { Card, Btn, StatusPill, SyncBadge, Logo } from "../ui/index.jsx";
import DriverSettlementModal from "./DriverSettlementModal.jsx";
import SettlementsHistoryModal from "./SettlementsHistoryModal.jsx";

const cleanPhone = (phone) => {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.length >= 10 && !d.startsWith("55")) d = "55" + d;
  return d;
};

const openExternal = (url) => {
  if (typeof window !== "undefined" && window.open) window.open(url, "_blank", "noopener");
};

const openMaps = (addr, type = "google") => {
  const enc = encodeURIComponent(addr || "");
  openExternal(
    type === "waze"
      ? `https://waze.com/ul?q=${enc}&navigate=yes`
      : `https://www.google.com/maps/dir/?api=1&destination=${enc}`
  );
};

const openWhatsApp = (phone, msg = "") => {
  const p = cleanPhone(phone);
  if (!p) return;
  openExternal(`https://wa.me/${p}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`);
};

// Corridas que já são do motoboy, mas o pedido ainda está na casa
// (NOVO → EMBALADO): a loja pré-atribuiu e ele só espera a liberação.
const waitingForRelease = (orders, meId) =>
  orders.filter((o) => o.driverId === meId && !["ROTA", "ENTREGUE", "CANCELADO"].includes(o.status));

// O que o motoboy precisa fazer com o dinheiro na porta do cliente.
// Compara de forma tolerante porque o pagamento chega escrito de vários
// jeitos ("Pix", "PIX", "Cartão (iFood)", "No fechamento da mesa") e a
// loja também paga mesa adiantado pelo PDV.
function paymentHint(o) {
  const p = String(o.payment || "").toUpperCase();
  if (o.paymentStatus === "pago" || /PIX|ONLINE|IFOOD|99FOOD|QUERO|APP/.test(p)) {
    return { tone: "paid", label: "🟢 JÁ PAGO ONLINE — não cobrar nada do cliente!" };
  }
  if (/MESA|FECHAMENTO/.test(p)) {
    return { tone: "paid", label: "🍽️ MESA — cobrança no fechamento do salão, não aqui" };
  }
  if (/CART|DEB|CRED|MAQUIN/.test(p)) {
    return { tone: "cash", label: `💳 COBRAR NO CARTÃO — passar ${brl(o.total)} na maquininha` };
  }
  return { tone: "cash", label: `💵 COBRAR EM DINHEIRO — receber ${brl(o.total)} em espécie` };
}

export default function DriverApp({ store, now, driverOverride = null, preview = false }) {
  // O entregador logado enxerga só o que é dele (o servidor valida de novo).
  // Sem entregador vinculado ao login não existe "minhas entregas" — mostrar
  // as do primeiro motoboy da lista vazaria o trabalho de outro colega.
  const meDriver = driverOverride || store.drivers.find((d) => d.id === store.me?.driverId) || null;
  const meId = meDriver?.id;
  const isStaff = ["ADMIN", "GERENTE", "ATENDIMENTO", "EXPEDICAO"].includes(store.me?.role);

  const mine = store.orders.filter(
    (o) => o.driverId === meId && ["ROTA", "ENTREGUE"].includes(o.status)
  );
  const open = store.orders.filter((o) => o.status === "AGUARDANDO" && o.type === "delivery" && !o.driverId);
  // aceitas / pré-atribuídas pela loja, mas o pedido ainda está na casa
  const waiting = waitingForRelease(store.orders, meId);
  const activeRouteOrders = mine
    .filter((o) => o.status === "ROTA")
    .sort((a, b) => (a.routeSeq || 0) - (b.routeSeq || 0));

  const [arrivedMap, setArrivedMap] = useState({});
  const [routeModal, setRouteModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [problemModal, setProblemModal] = useState(null);
  const [showSettlement, setShowSettlement] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [accepting, setAccepting] = useState(null);

  // Toque de aviso quando cai uma entrega NOVA em rota para este motoboy.
  const seenRotas = useRef(null);
  useEffect(() => {
    const ids = activeRouteOrders.map((o) => o.id);
    if (seenRotas.current === null) {
      seenRotas.current = ids;
      return;
    }
    const novas = ids.filter((id) => !seenRotas.current.includes(id));
    seenRotas.current = ids;
    if (novas.length > 0) playRouteAlert(3);
  }, [activeRouteOrders.map((o) => o.id).join("|")]);

  const copyAddress = (addr) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(addr)
        .then(() => store.toast("Endereço copiado! 📋"))
        .catch(() => store.toast("Endereço: " + addr));
    } else {
      store.toast("Endereço: " + addr);
    }
  };

  const handleAccept = async (o) => {
    if (!meId) return;
    setAccepting(o.id);
    const aceito = await store.assignDriver(o.id, meId);
    if (aceito === false) store.toast("Não foi possível aceitar esta entrega");
    setAccepting(null);
  };

  const handleArrived = (o) => {
    setArrivedMap((prev) => ({ ...prev, [o.id]: true }));
    const msg = `Olá, ${o.customer?.name || "cliente"}! 🛵 Sou o entregador do Tô no Sarro. Já cheguei no seu endereço (${o.customer?.addr || ""}) com o pedido #${o.code}. Estou no portão/portaria te aguardando! 🔥`;
    openWhatsApp(o.customer?.phone, msg);
    store.toast(`📍 Chegada registrada no pedido #${o.code}!`);
  };

  const confirmDelivery = (o, thankYou) => {
    store.setStatus(o.id, "ENTREGUE");
    if (thankYou) {
      const msg = `Olá, ${o.customer?.name}! Seu pedido #${o.code} do Tô no Sarro foi entregue. Bom apetite e muito obrigado pela preferência! Se puder nos avaliar com 5 estrelas, ficaremos gratos! ⭐⭐⭐⭐⭐`;
      openWhatsApp(o.customer?.phone, msg);
    }
    store.toast(`🎉 Pedido #${o.code} entregue!`);
    setConfirmModal(null);
  };

  const storePhone = store.settings?.whatsapp || store.settings?.phone || "";
  const firstName = meDriver?.name?.split(" ")[0] || "Entregador";

  return (
    <div style={{ background: C.black, minHeight: "100%" }} className="p-4 pb-10">
      {/* CABEÇALHO */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <Logo size={38} />
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="rounded-lg px-2.5 py-1.5 font-bold truncate"
            style={{ background: C.gray850, color: C.white, border: `1px solid ${C.gray800}`, fontSize: 12 }}
          >
            🛵 {meDriver ? `${firstName} · ${meDriver.vehicle}` : "sem vínculo"}
          </span>
          {meDriver && (
            <button
              onClick={() => setShowSettlement(true)}
              className="shrink-0 rounded-lg px-2.5 py-1.5 font-bold text-xs flex items-center gap-1.5 active:scale-95"
              style={{ background: "#16653433", color: C.green, border: `1px solid ${C.green}55` }}
            >
              🤝 {isStaff ? "Acerto" : "Meu Acerto"}
            </button>
          )}
          {isStaff && meDriver && (
            <button
              onClick={() => setShowHistory(true)}
              className="shrink-0 rounded-lg px-2.5 py-1.5 font-bold text-xs"
              style={{ background: C.gray850, color: "#c0c0c0", border: `1px solid ${C.gray800}` }}
            >
              📋 Acertos
            </button>
          )}
          {store.me && !preview && (
            <button
              onClick={store.logout}
              className="shrink-0 rounded-lg px-2 py-1 font-bold"
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
        {meDriver?.name || "Entregador"} · {activeRouteOrders.length} em rota hoje
        {meDriver?.phone ? ` · ${meDriver.phone}` : ""}
      </div>

      {/* LOGIN SEM ENTREGADOR VINCULADO */}
      {!meDriver && (
        <Card className="p-5 mb-4" style={{ borderColor: `${C.yellow}55` }}>
          <div style={{ color: C.yellowLight, fontWeight: 900, fontSize: 14, marginBottom: 6 }}>
            ⚠️ Este login não está vinculado a um entregador
          </div>
          <div style={{ color: "#a0a0a0", fontSize: 12.5, lineHeight: 1.5 }}>
            Peça ao administrador para abrir <strong style={{ color: C.white }}>Admin → Configurações → Usuários e permissões</strong>,
            editar o usuário e escolher o entregador em <em>Entregador vinculado</em>. Sem isso a loja não sabe
            de quem são as corridas e o acerto de turno não fecha.
          </div>
        </Card>
      )}

      {/* ROTA COMPOSTA MULTI-PARADAS */}
      {activeRouteOrders.length >= 2 && (
        <div
          className="mb-5 p-4 rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #1c1917, #292524)",
            border: `2px solid ${C.orange}`,
            boxShadow: "0 6px 20px rgba(255,107,0,0.15)",
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl shrink-0">🛵</span>
              <div className="min-w-0">
                <div style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>
                  ROTA COMPOSTA MULTI-PARADAS ({activeRouteOrders.length} entregas)
                </div>
                <div style={{ color: "#a0a0a0", fontSize: 11 }}>
                  Siga a sequência de paradas para entregar mais rápido
                </div>
              </div>
            </div>
            <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-black" style={{ background: C.orange, color: C.black }}>
              EM ANDAMENTO
            </span>
          </div>

          <div className="space-y-1.5 my-3">
            {activeRouteOrders.map((ro, idx) => (
              <div
                key={ro.id}
                className="p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs"
                style={{ background: C.gray900, border: `1px solid ${C.gray800}` }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px]"
                    style={{ background: C.orange, color: C.black }}
                  >
                    {ro.routeSeq || idx + 1}
                  </span>
                  <span className="shrink-0" style={{ color: C.white, fontWeight: 800 }}>#{ro.code}</span>
                  <span className="truncate" style={{ color: "#c0c0c0" }}>
                    {ro.customer?.name} ({ro.customer?.addr?.split(",")[0]})
                  </span>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span style={{ color: C.yellowLight, fontWeight: 800 }}>{brl(ro.total)}</span>
                  <span style={{ color: "#8a8a8a", fontSize: 10 }}>({ro.payment})</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => openExternal(buildGoogleMapsMultiStopUrl(activeRouteOrders, store.settings?.address))}
            className="w-full py-3.5 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 transition active:scale-95 shadow-lg"
            style={{ background: "#4285F4" }}
          >
            🗺️ INICIAR NAVEGAÇÃO MULTI-PARADAS NO GOOGLE MAPS
          </button>
        </div>
      )}

      {/* ACEITAS / PRÉ-ATRIBUÍDAS — o pedido ainda está na casa */}
      {waiting.length > 0 && (
        <div className="mb-5">
          <div style={{ color: "#8ab4f8", fontWeight: 900, fontSize: 13, marginBottom: 8 }}>
            Aguardando a loja liberar ({waiting.length})
          </div>
          <div className="space-y-2">
            {waiting.map((o) => (
              <Card key={o.id} className="p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>#{o.code}</span>
                    <StatusPill status={o.status} small />
                  </div>
                  <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 13 }}>{brl(o.total)}</span>
                </div>
                <div style={{ color: "#9a9a9a", fontSize: 12, marginTop: 4 }}>{o.customer?.addr}</div>
                <div className="mt-2 flex gap-2">
                  <Btn small variant="dark" onClick={() => setRouteModal(o)}>🗺 VER ROTA</Btn>
                  <Btn small variant="dark" onClick={() => openWhatsApp(o.customer?.phone, `Olá, ${o.customer?.name}! Sou o entregador do Tô no Sarro, sobre o pedido #${o.code}.`)}>
                    💬 WhatsApp
                  </Btn>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* DISPONÍVEIS PARA ACEITAR */}
      {open.length > 0 && (
        <div className="mb-5">
          <div style={{ color: C.yellowLight, fontWeight: 900, fontSize: 13, marginBottom: 8 }}>
            Disponíveis para aceitar ({open.length})
          </div>
          <div className="space-y-2">
            {open.map((o) => (
              <Card key={o.id} className="p-3.5" style={{ borderColor: `${C.yellow}44` }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>#{o.code}</span>
                  <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 14 }}>{brl(o.total)}</span>
                </div>
                <div style={{ color: "#9a9a9a", fontSize: 12, marginTop: 4 }}>{o.customer?.addr}</div>
                <div style={{ color: "#7a7a7a", fontSize: 11, marginTop: 2 }}>
                  {o.payment} · {elapsed(o.startedAt || o.createdAt, now)} na espera
                </div>
                <div className="mt-3 flex gap-2">
                  <Btn full onClick={() => handleAccept(o)} disabled={!meId || accepting === o.id}>
                    {accepting === o.id ? "ACEITANDO…" : "ACEITAR ENTREGA"}
                  </Btn>
                  <Btn variant="dark" onClick={() => openWhatsApp(o.customer?.phone)} disabled={!o.customer?.phone}>
                    💬
                  </Btn>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* MINHAS ENTREGAS */}
      <div className="space-y-3">
        {mine.length === 0 && open.length === 0 && waiting.length === 0 && (
          <Card className="p-8 text-center">
            <div style={{ fontSize: 40 }}>🛵</div>
            <div style={{ color: C.white, fontWeight: 800, marginTop: 10 }}>Sem entregas por enquanto</div>
            <div style={{ color: "#8a8a8a", fontSize: 12.5, marginTop: 4 }}>
              Assim que a expedição liberar um pedido, ele aparece aqui e toca o aviso sonoro.
            </div>
          </Card>
        )}

        {mine.map((o) => {
          const done = o.status === "ENTREGUE";
          const isArrived = !!arrivedMap[o.id];
          const hint = paymentHint(o);
          return (
            <Card key={o.id} className="p-4" style={{ borderColor: done ? C.gray800 : `${C.orange}55`, opacity: done ? 0.6 : 1 }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 20 }}>#{o.code}</span>
                  {!!o.routeSeq && o.routeSeq > 1 && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-black shrink-0" style={{ background: C.orange, color: C.black }}>
                      {o.routeSeq}ª PARADA
                    </span>
                  )}
                  {isArrived && !done && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold shrink-0"
                      style={{ background: "#16653433", color: C.green, border: `1px solid ${C.green}55` }}
                    >
                      📍 No local
                    </span>
                  )}
                </div>
                <StatusPill status={o.status} small />
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-2 py-1.5" style={{ borderBottom: `1px solid ${C.gray850}` }}>
                  <span style={{ color: "#7a7a7a" }}>Cliente</span>
                  <span style={{ color: C.white, fontWeight: 700, textAlign: "right" }}>{o.customer?.name}</span>
                </div>

                <div className="flex justify-between items-center gap-2 py-1.5" style={{ borderBottom: `1px solid ${C.gray850}` }}>
                  <span className="shrink-0" style={{ color: "#7a7a7a" }}>Endereço</span>
                  <div className="text-right max-w-[70%]">
                    <div style={{ color: C.white, fontWeight: 600 }}>{o.customer?.addr}</div>
                    {!done && (
                      <button
                        onClick={() => setRouteModal(o)}
                        className="mt-0.5 font-bold text-xs inline-flex items-center gap-1"
                        style={{ color: C.orange, background: "none", border: "none", padding: 0, cursor: "pointer" }}
                      >
                        🗺️ Ver mapa / GPS
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center gap-2 py-1.5" style={{ borderBottom: `1px solid ${C.gray850}` }}>
                  <span style={{ color: "#7a7a7a" }}>Telefone</span>
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: C.white, fontWeight: 600 }}>{o.customer?.phone}</span>
                    {!done && (
                      <>
                        <button
                          onClick={() => openWhatsApp(o.customer?.phone, `Olá, ${o.customer?.name}! Sou o entregador do Tô no Sarro, sobre o pedido #${o.code}.`)}
                          className="rounded px-1.5 py-0.5 font-bold text-xs"
                          style={{ background: "#25D36622", color: "#25D366", border: "1px solid #25D36644" }}
                        >
                          💬 Zap
                        </button>
                        <a
                          href={`tel:${cleanPhone(o.customer?.phone)}`}
                          className="rounded px-1.5 py-0.5 font-bold text-xs"
                          style={{ background: C.gray800, color: C.white, textDecoration: "none" }}
                        >
                          📞
                        </a>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex justify-between gap-2 py-1.5" style={{ borderBottom: `1px solid ${C.gray850}` }}>
                  <span style={{ color: "#7a7a7a" }}>Valor & Pagamento</span>
                  <span style={{ color: C.yellowLight, fontWeight: 800, textAlign: "right" }}>
                    {brl(o.total)} · {o.payment}
                  </span>
                </div>

                {!!o.note && (
                  <div className="flex justify-between gap-2 py-1.5" style={{ borderBottom: `1px solid ${C.gray850}` }}>
                    <span style={{ color: "#7a7a7a" }}>Obs do pedido</span>
                    <span style={{ color: C.white, textAlign: "right" }}>{o.note}</span>
                  </div>
                )}

                <div className="flex justify-between py-1.5">
                  <span style={{ color: "#7a7a7a" }}>Saiu há</span>
                  <span style={{ color: C.white, fontWeight: 600 }}>{elapsed(o.startedAt || o.createdAt, now)}</span>
                </div>
              </div>

              {!done && hint && (
                <div
                  className="mt-3 p-2 rounded-lg text-center font-bold text-[11px]"
                  style={{
                    background: hint.tone === "paid" ? "#16653433" : "#854d0e33",
                    border: `1px solid ${hint.tone === "paid" ? C.green : C.yellow}`,
                    color: hint.tone === "paid" ? C.green : C.yellowLight,
                  }}
                >
                  {hint.label}
                </div>
              )}

              {!done && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Btn variant={isArrived ? "green" : "dark"} onClick={() => handleArrived(o)}>
                    {isArrived ? "📍 NO LOCAL (REAVISAR)" : "CHEGUEI NO LOCAL"}
                  </Btn>
                  <Btn variant="green" onClick={() => setConfirmModal(o)}>PEDIDO ENTREGUE</Btn>
                  <Btn variant="dark" onClick={() => setRouteModal(o)}>🗺 VER ROTA</Btn>
                  <Btn variant="danger" onClick={() => setProblemModal(o)}>PROBLEMA</Btn>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* MODAL 1 — ROTA (Google Maps / Waze / copiar) */}
      {routeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.82)" }}>
          <Card className="w-full max-w-md p-5 space-y-4" style={{ border: `1px solid ${C.orange}55`, background: C.gray900 }}>
            <div className="flex items-center justify-between">
              <div style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 22 }}>
                🗺️ ROTA — PEDIDO #{routeModal.code}
              </div>
              <button onClick={() => setRouteModal(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="p-3.5 rounded-xl" style={{ background: C.gray850 }}>
              <div style={{ color: "#8a8a8a", fontSize: 11 }}>Destino de Entrega</div>
              <div style={{ color: C.white, fontWeight: 800, fontSize: 14, marginTop: 4 }}>{routeModal.customer?.name}</div>
              <div style={{ color: C.yellowLight, fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>{routeModal.customer?.addr}</div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => { openMaps(routeModal.customer?.addr, "google"); setRouteModal(null); }}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-white transition active:scale-95"
                style={{ background: "#4285F4" }}
              >
                🗺️ Abrir no Google Maps
              </button>
              <button
                onClick={() => { openMaps(routeModal.customer?.addr, "waze"); setRouteModal(null); }}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-black transition active:scale-95"
                style={{ background: "#33CCFF" }}
              >
                🚗 Abrir no Waze
              </button>
              <button
                onClick={() => copyAddress(routeModal.customer?.addr)}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold transition active:scale-95"
                style={{ background: C.gray800, color: "#c0c0c0", border: `1px solid ${C.gray700}`, fontSize: 12.5 }}
              >
                📋 Copiar Endereço
              </button>
            </div>

            <Btn full variant="dark" onClick={() => setRouteModal(null)}>Voltar</Btn>
          </Card>
        </div>
      )}

      {/* MODAL 2 — CONFIRMAR ENTREGA COM CONFERÊNCIA DE COBRANÇA */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.82)" }}>
          <Card className="w-full max-w-md p-5 space-y-4" style={{ border: `2px solid ${C.green}`, background: C.gray900 }}>
            <div className="flex items-center justify-between">
              <div style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 22 }}>
                ✅ CONFIRMAR ENTREGA #{confirmModal.code}
              </div>
              <button onClick={() => setConfirmModal(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="p-3.5 rounded-xl space-y-2 text-xs" style={{ background: C.gray850 }}>
              <div className="flex justify-between gap-2">
                <span style={{ color: "#8a8a8a" }}>Cliente:</span>
                <span style={{ color: C.white, fontWeight: 700, textAlign: "right" }}>{confirmModal.customer?.name}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span style={{ color: "#8a8a8a" }}>Endereço:</span>
                <span style={{ color: C.white, textAlign: "right", maxWidth: "70%" }}>{confirmModal.customer?.addr}</span>
              </div>
              <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${C.gray800}` }}>
                <span style={{ color: "#8a8a8a" }}>Total do pedido:</span>
                <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 15 }}>{brl(confirmModal.total)}</span>
              </div>
            </div>

            {(() => {
              const h = paymentHint(confirmModal);
              return (
                <div
                  className="p-3 rounded-xl text-center font-bold text-xs"
                  style={{
                    background: h.tone === "paid" ? "#16653433" : "#854d0e33",
                    border: `1px solid ${h.tone === "paid" ? C.green : C.yellow}`,
                    color: h.tone === "paid" ? C.green : C.yellowLight,
                  }}
                >
                  {h.label}
                </div>
              );
            })()}

            <div className="space-y-2 pt-2">
              <button
                onClick={() => confirmDelivery(confirmModal, false)}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-black text-black transition active:scale-95"
                style={{ background: C.green, fontSize: 14 }}
              >
                ✅ CONFIRMAR ENTREGA
              </button>
              <button
                onClick={() => confirmDelivery(confirmModal, true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold transition active:scale-95 text-xs"
                style={{ background: "#25D36622", color: "#25D366", border: `1px solid #25D36666` }}
              >
                💬 Confirmar e agradecer no WhatsApp
              </button>
              <Btn full variant="dark" onClick={() => setConfirmModal(null)}>Cancelar</Btn>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 3 — PROBLEMA NA ENTREGA */}
      {problemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.82)" }}>
          <Card className="w-full max-w-md p-5 space-y-4" style={{ border: `2px solid ${C.red}`, background: C.gray900 }}>
            <div className="flex items-center justify-between">
              <div style={{ color: C.red, fontFamily: font.display, fontStyle: "italic", fontSize: 22 }}>
                ⚠️ RELATAR PROBLEMA #{problemModal.code}
              </div>
              <button onClick={() => setProblemModal(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div style={{ color: "#a0a0a0", fontSize: 12 }}>
              Escolha uma ação rápida para resolver com o cliente ou acionar a loja:
            </div>

            <div className="space-y-2.5">
              <div className="p-3 rounded-xl" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
                <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>📵 Cliente não atende telefone / interfone</div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => openWhatsApp(problemModal.customer?.phone, `Olá, ${problemModal.customer?.name}! Sou o entregador do Tô no Sarro com seu pedido #${problemModal.code}. Já estou no portão/portaria mas não consegui contato. Me responde aqui, por favor! 🛵`)}
                    className="flex-1 py-1.5 rounded-lg font-bold text-xs"
                    style={{ background: "#25D366", color: C.black }}
                  >
                    💬 WhatsApp
                  </button>
                  <a
                    href={`tel:${cleanPhone(problemModal.customer?.phone)}`}
                    className="flex-1 py-1.5 rounded-lg font-bold text-xs text-center flex items-center justify-center"
                    style={{ background: C.gray700, color: C.white, textDecoration: "none" }}
                  >
                    📞 Ligar
                  </a>
                </div>
              </div>

              <div className="p-3 rounded-xl" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
                <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>📍 Endereço não localizado ou incompleto</div>
                <button
                  onClick={() => openWhatsApp(problemModal.customer?.phone, `Olá, ${problemModal.customer?.name}! Sou o entregador do Tô no Sarro com o pedido #${problemModal.code}. Estou na sua rua mas não localizei o endereço (${problemModal.customer?.addr}). Pode me mandar a localização em tempo real ou um ponto de referência?`)}
                  className="w-full mt-2 py-1.5 rounded-lg font-bold text-xs"
                  style={{ background: C.gray700, color: C.yellowLight }}
                >
                  💬 Pedir localização no WhatsApp
                </button>
              </div>

              <div className="p-3 rounded-xl" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
                <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>🚨 Problema na rota ou na maquininha (falar com a loja)</div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => openWhatsApp(storePhone, `🚨 SUPORTE ENTREGA: ${firstName} no pedido #${problemModal.code} (${problemModal.customer?.name}) precisa de suporte com a entrega!`)}
                    className="flex-1 py-1.5 rounded-lg font-bold text-xs"
                    style={{ background: "#EF444422", color: "#EF4444", border: "1px solid #EF444466" }}
                  >
                    💬 WhatsApp da Loja
                  </button>
                  <a
                    href={`tel:${cleanPhone(storePhone)}`}
                    className="flex-1 py-1.5 rounded-lg font-bold text-xs text-center flex items-center justify-center"
                    style={{ background: C.gray700, color: C.white, textDecoration: "none" }}
                  >
                    📞 Ligar p/ Loja
                  </a>
                </div>
              </div>
            </div>

            <Btn full variant="dark" onClick={() => setProblemModal(null)}>Fechar</Btn>
          </Card>
        </div>
      )}

      {/* ACERTO DO TURNO — o motoboy só consulta; quem fecha é a loja */}
      {showSettlement && meDriver && (
        <DriverSettlementModal
          driver={meDriver}
          store={store}
          readOnly={!isStaff}
          onClose={() => setShowSettlement(false)}
        />
      )}
      {showHistory && <SettlementsHistoryModal store={store} onClose={() => setShowHistory(false)} />}
    </div>
  );
}

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";

function DriverApp({ store, now }) {
  // O entregador logado enxerga só o que é dele (o servidor também valida).
  const meDriver = store.drivers.find((d) => d.id === store.me?.driverId) || store.drivers[0];
  const meId = meDriver?.id;
  const mine = store.orders.filter((o) => o.driverId === meId && ["ROTA", "ENTREGUE"].includes(o.status));
  const open = store.orders.filter((o) => o.status === "AGUARDANDO" && o.type === "delivery");
  const activeRouteOrders = mine.filter((o) => o.status === "ROTA").sort((a, b) => (a.routeSeq || 0) - (b.routeSeq || 0));

  // Estados de atividades operacionais do entregador
  const [arrivedMap, setArrivedMap] = useState({});
  const [routeModal, setRouteModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [problemModal, setProblemModal] = useState(null);
  const [showSettlementModal, setShowSettlementModal] = useState(false);

  const cleanPhone = (phone) => {
    let d = String(phone || "").replace(/\D/g, "");
    if (d.length >= 10 && !d.startsWith("55")) d = "55" + d;
    return d;
  };

  const openMaps = (addr, type = "google") => {
    const enc = encodeURIComponent(addr || "");
    const url = type === "waze"
      ? `https://waze.com/ul?q=${enc}&navigate=yes`
      : `https://www.google.com/maps/dir/?api=1&destination=${enc}`;
    if (typeof window !== "undefined" && window.open) window.open(url, "_blank");
  };

  const openWhatsApp = (phone, msg = "") => {
    const p = cleanPhone(phone);
    const enc = encodeURIComponent(msg);
    const url = `https://wa.me/${p}${msg ? `?text=${enc}` : ""}`;
    if (typeof window !== "undefined" && window.open) window.open(url, "_blank");
  };

  const copyAddress = (addr) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(addr).then(() => {
        store.toast("Endereço copiado para a área de transferência! 📋");
      }).catch(() => store.toast("Endereço: " + addr));
    } else {
      store.toast("Endereço: " + addr);
    }
  };

  const handleArrived = (o) => {
    setArrivedMap((prev) => ({ ...prev, [o.id]: true }));
    const msg = `Olá, ${o.customer?.name || "cliente"}! 🛵 Sou o entregador do Tô no Sarro. Já cheguei no seu endereço (${o.customer?.addr || ""}) com o pedido #${o.code}. Estou no portão/portaria te aguardando! 🔥`;
    openWhatsApp(o.customer?.phone, msg);
    store.toast(`📍 Chegada registrada no pedido #${o.code}! WhatsApp do cliente aberto.`);
  };

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
          <button
            onClick={() => setShowSettlementModal(true)}
            className="rounded-lg px-2.5 py-1.5 font-bold text-xs flex items-center gap-1.5 active:scale-95"
            style={{ background: "#16653433", color: C.green, border: `1px solid ${C.green}55` }}
          >
            <span>🤝</span>
            <span>Meu Acerto</span>
          </button>
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

      {/* ROTA COMPOSTA MULTI-PARADAS ATIVA */}
      {activeRouteOrders.length >= 2 && (
        <div
          className="mb-5 p-4 rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #1c1917, #292524)",
            border: `2px solid ${C.orange}`,
            boxShadow: "0 6px 20px rgba(255,107,0,0.15)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛵</span>
              <div>
                <div style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>
                  ROTA COMPOSTA MULTI-PARADAS ({activeRouteOrders.length} entregas)
                </div>
                <div style={{ color: "#a0a0a0", fontSize: 11 }}>
                  Siga a sequência de paradas para entrega mais rápida
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-black" style={{ background: C.orange, color: C.black }}>
              EM ANDAMENTO
            </span>
          </div>

          <div className="space-y-1.5 my-3">
            {activeRouteOrders.map((ro, idx) => (
              <div key={ro.id} className="p-2.5 rounded-xl flex items-center justify-between text-xs" style={{ background: C.gray900, border: `1px solid ${C.gray800}` }}>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px]" style={{ background: C.orange, color: C.black }}>
                    {ro.routeSeq || idx + 1}
                  </span>
                  <span style={{ color: C.white, fontWeight: 800 }}>#{ro.code}</span>
                  <span style={{ color: "#c0c0c0" }}>{ro.customer?.name} ({ro.customer?.addr?.split(",")[0]})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: C.yellowLight, fontWeight: 800 }}>{brl(ro.total)}</span>
                  <span style={{ color: "#8a8a8a", fontSize: 10 }}>({ro.payment})</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              const url = buildGoogleMapsMultiStopUrl(activeRouteOrders, store.settings?.address);
              if (typeof window !== "undefined" && window.open) window.open(url, "_blank");
            }}
            className="w-full py-3.5 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 transition active:scale-95 shadow-lg"
            style={{ background: "#4285F4" }}
          >
            <span>🗺️</span>
            <span>INICIAR NAVEGAÇÃO MULTI-PARADAS NO GOOGLE MAPS</span>
          </button>
        </div>
      )}

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
          const isArrived = !!arrivedMap[o.id];
          return (
            <Card key={o.id} className="p-4" style={{ borderColor: done ? C.gray800 : `${C.orange}55`, opacity: done ? 0.6 : 1 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 20 }}>#{o.code}</span>
                  {o.routeSeq && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-black"
                      style={{ background: C.orange, color: C.black }}
                    >
                      {o.routeSeq}ª PARADA
                    </span>
                  )}
                  {isArrived && !done && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{ background: "#16653433", color: C.green, border: `1px solid ${C.green}55` }}
                    >
                      📍 No local
                    </span>
                  )}
                </div>
                <StatusPill status={o.status} small />
              </div>

              {/* Informações detalhadas com atalhos interativos */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1.5" style={{ borderBottom: `1px solid ${C.gray850}` }}>
                  <span style={{ color: "#7a7a7a" }}>Cliente</span>
                  <span style={{ color: C.white, fontWeight: 700 }}>{o.customer.name}</span>
                </div>

                <div className="flex justify-between items-center py-1.5" style={{ borderBottom: `1px solid ${C.gray850}` }}>
                  <span style={{ color: "#7a7a7a" }}>Endereço</span>
                  <div className="text-right max-w-[70%]">
                    <div style={{ color: C.white, fontWeight: 600 }}>{o.customer.addr}</div>
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

                <div className="flex justify-between items-center py-1.5" style={{ borderBottom: `1px solid ${C.gray850}` }}>
                  <span style={{ color: "#7a7a7a" }}>Telefone</span>
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: C.white, fontWeight: 600 }}>{o.customer.phone}</span>
                    {!done && (
                      <>
                        <button
                          onClick={() => openWhatsApp(o.customer.phone, `Olá, ${o.customer.name}! Sou o entregador do Tô no Sarro referente ao pedido #${o.code}.`)}
                          className="rounded px-1.5 py-0.5 font-bold text-xs"
                          style={{ background: "#25D36622", color: "#25D366", border: "1px solid #25D36644" }}
                        >
                          💬 Zap
                        </button>
                        <a
                          href={`tel:${o.customer.phone}`}
                          className="rounded px-1.5 py-0.5 font-bold text-xs"
                          style={{ background: C.gray800, color: C.white, textDecoration: "none" }}
                        >
                          📞
                        </a>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex justify-between py-1.5" style={{ borderBottom: `1px solid ${C.gray850}` }}>
                  <span style={{ color: "#7a7a7a" }}>Valor & Pagamento</span>
                  <span style={{ color: C.yellowLight, fontWeight: 800 }}>{brl(o.total)} · {o.payment}</span>
                </div>

                <div className="flex justify-between py-1.5" style={{ borderBottom: `1px solid ${C.gray850}` }}>
                  <span style={{ color: "#7a7a7a" }}>Saiu há</span>
                  <span style={{ color: C.white, fontWeight: 600 }}>{elapsed(o.startedAt || o.createdAt, now)}</span>
                </div>
              </div>

              {/* Botões de Ação com atividades reais */}
              {!done && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Btn
                    variant={isArrived ? "green" : "dark"}
                    onClick={() => handleArrived(o)}
                  >
                    {isArrived ? "📍 NO LOCAL (REAVISAR)" : "CHEGUEI NO LOCAL"}
                  </Btn>
                  <Btn
                    variant="green"
                    onClick={() => setConfirmModal(o)}
                  >
                    PEDIDO ENTREGUE
                  </Btn>
                  <Btn
                    variant="dark"
                    onClick={() => setRouteModal(o)}
                  >
                    🗺 VER ROTA
                  </Btn>
                  <Btn
                    variant="danger"
                    onClick={() => setProblemModal(o)}
                  >
                    PROBLEMA
                  </Btn>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Modal 1: Rota no Mapa (Google Maps / Waze / Copiar) */}
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
              <div style={{ color: C.white, fontWeight: 800, fontSize: 14, marginTop: 4 }}>{routeModal.customer.name}</div>
              <div style={{ color: C.yellowLight, fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>{routeModal.customer.addr}</div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => { openMaps(routeModal.customer.addr, "google"); setRouteModal(null); }}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-white transition active:scale-95"
                style={{ background: "#4285F4" }}
              >
                <span>🗺️</span>
                <span>Abrir no Google Maps</span>
              </button>

              <button
                onClick={() => { openMaps(routeModal.customer.addr, "waze"); setRouteModal(null); }}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-black transition active:scale-95"
                style={{ background: "#33CCFF" }}
              >
                <span>🚗</span>
                <span>Abrir no Waze</span>
              </button>

              <button
                onClick={() => copyAddress(routeModal.customer.addr)}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold transition active:scale-95"
                style={{ background: C.gray800, color: "#c0c0c0", border: `1px solid ${C.gray700}`, fontSize: 12.5 }}
              >
                <span>📋</span>
                <span>Copiar Endereço</span>
              </button>
            </div>

            <Btn full variant="dark" onClick={() => setRouteModal(null)}>Voltar</Btn>
          </Card>
        </div>
      )}

      {/* Modal 2: Confirmação de Entrega com Verificação de Pagamento */}
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
              <div className="flex justify-between">
                <span style={{ color: "#8a8a8a" }}>Cliente:</span>
                <span style={{ color: C.white, fontWeight: 700 }}>{confirmModal.customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "#8a8a8a" }}>Endereço:</span>
                <span style={{ color: C.white, textAlign: "right", maxWidth: "70%" }}>{confirmModal.customer.addr}</span>
              </div>
              <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${C.gray800}` }}>
                <span style={{ color: "#8a8a8a" }}>Total do pedido:</span>
                <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 15 }}>{brl(confirmModal.total)}</span>
              </div>
            </div>

            {/* Alerta de cobrança */}
            <div
              className="p-3 rounded-xl text-center font-bold text-xs"
              style={{
                background: ["PIX", "CARTAO_ONLINE"].includes(confirmModal.payment) ? "#16653433" : "#854d0e33",
                border: `1px solid ${["PIX", "CARTAO_ONLINE"].includes(confirmModal.payment) ? C.green : C.yellow}`,
                color: ["PIX", "CARTAO_ONLINE"].includes(confirmModal.payment) ? C.green : C.yellowLight,
              }}
            >
              {["PIX", "CARTAO_ONLINE"].includes(confirmModal.payment) ? (
                <span>🟢 JÁ PAGO ONLINE (InfinitePay/Pix) — Não cobrar nada do cliente!</span>
              ) : confirmModal.payment === "Cartão" ? (
                <span>💳 COBRAR NO CARTÃO — Passar {brl(confirmModal.total)} na maquininha</span>
              ) : (
                <span>💵 COBRAR EM DINHEIRO — Receber {brl(confirmModal.total)} em espécie</span>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  store.setStatus(confirmModal.id, "ENTREGUE");
                  store.toast(`🎉 Pedido #${confirmModal.code} entregue com sucesso!`);
                  setConfirmModal(null);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-black text-black transition active:scale-95"
                style={{ background: C.green, fontSize: 14 }}
              >
                <span>✅</span>
                <span>CONFIRMAR ENTREGA</span>
              </button>

              <button
                onClick={() => {
                  store.setStatus(confirmModal.id, "ENTREGUE");
                  const msg = `Olá, ${confirmModal.customer.name}! Seu pedido #${confirmModal.code} do Tô no Sarro foi entregue. Bom apetite e muito obrigado pela preferência! Se puder nos avaliar com 5 estrelas ficaremos muito gratos! ⭐⭐⭐⭐⭐`;
                  openWhatsApp(confirmModal.customer.phone, msg);
                  store.toast(`🎉 Pedido #${confirmModal.code} entregue + WhatsApp de agradecimento enviado!`);
                  setConfirmModal(null);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold transition active:scale-95 text-xs"
                style={{ background: "#25D36622", color: "#25D366", border: "1px solid #25D36666" }}
              >
                <span>💬</span>
                <span>Confirmar e agradecer no WhatsApp</span>
              </button>

              <Btn full variant="dark" onClick={() => setConfirmModal(null)}>Cancelar</Btn>
            </div>
          </Card>
        </div>
      )}

      {/* Modal 3: Relatar Problema na Entrega */}
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
              Selecione uma ação rápida para resolver com o cliente ou acionar a loja:
            </div>

            <div className="space-y-2.5">
              {/* Opção 1: Cliente não atende */}
              <div className="p-3 rounded-xl" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
                <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>📵 Cliente não atende telefone / interfone</div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      const msg = `Olá, ${problemModal.customer.name}! Sou o entregador do Tô no Sarro com seu pedido #${problemModal.code}. Já estou no portão/portaria te chamando mas não consegui contato. Por favor me responda aqui! 🛵`;
                      openWhatsApp(problemModal.customer.phone, msg);
                    }}
                    className="flex-1 py-1.5 rounded-lg font-bold text-xs"
                    style={{ background: "#25D366", color: C.black }}
                  >
                    💬 WhatsApp
                  </button>
                  <a
                    href={`tel:${problemModal.customer.phone}`}
                    className="flex-1 py-1.5 rounded-lg font-bold text-xs text-center flex items-center justify-center text-decoration-none"
                    style={{ background: C.gray700, color: C.white }}
                  >
                    📞 Ligar
                  </a>
                </div>
              </div>

              {/* Opção 2: Endereço não encontrado */}
              <div className="p-3 rounded-xl" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
                <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>📍 Endereço não localizado ou incompleto</div>
                <button
                  onClick={() => {
                    const msg = `Olá, ${problemModal.customer.name}! Sou o entregador do Tô no Sarro com o pedido #${problemModal.code}. Estou na sua rua mas não localizei o número ${problemModal.customer.addr}. Pode me enviar a localização em tempo real ou ponto de referência?`;
                    openWhatsApp(problemModal.customer.phone, msg);
                  }}
                  className="w-full mt-2 py-1.5 rounded-lg font-bold text-xs"
                  style={{ background: C.gray700, color: C.yellowLight }}
                >
                  💬 Pedir localização no WhatsApp
                </button>
              </div>

              {/* Opção 3: Suporte da Central / Loja */}
              <div className="p-3 rounded-xl" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
                <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>🚨 Problema na rota ou maquininha (falar com a loja)</div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      const storePhone = store.settings?.phone || "(81) 98765-4321";
                      const msg = `🚨 SUPORTE ENTREGA: Sou o entregador ${meDriver?.name || "Rafael"} no pedido #${problemModal.code} (${problemModal.customer.name}). Preciso de suporte com a entrega!`;
                      openWhatsApp(storePhone, msg);
                    }}
                    className="flex-1 py-1.5 rounded-lg font-bold text-xs"
                    style={{ background: "#EF444422", color: "#EF4444", border: "1px solid #EF444466" }}
                  >
                    💬 WhatsApp da Loja
                  </button>
                  <a
                    href={`tel:${store.settings?.phone || "(81) 98765-4321"}`}
                    className="flex-1 py-1.5 rounded-lg font-bold text-xs text-center flex items-center justify-center text-decoration-none"
                    style={{ background: C.gray700, color: C.white }}
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

      {/* Modal de Acerto do Entregador */}
      {showSettlementModal && meDriver && (
        <DriverSettlementModal
          driver={meDriver}
          store={store}
          onClose={() => setShowSettlementModal(false)}
        />
      )}
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
  { id: "paineltv", label: "Painel TV", icon: "📺", path: "/paineltv" },
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

export default DriverApp;

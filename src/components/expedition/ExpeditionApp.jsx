import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";

function ExpeditionApp({ store, now }) {
  const [filterMod, setFilterMod] = useState("TODOS");
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("sarro_sound_expedition") !== "0");
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [batchDriverId, setBatchDriverId] = useState("");
  const [dispatchingRoute, setDispatchingRoute] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedOrder, setOptimizedOrder] = useState(null);
  const [settlementDriver, setSettlementDriver] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const lastReadyCount = useRef(0);

  const ready = store.orders.filter((o) => ["PRONTO", "EMBALADO", "AGUARDANDO"].includes(o.status));
  const rota = store.orders.filter((o) => o.status === "ROTA");

  // Alerta sonoro quando um pedido sai pronto da cozinha para a expedição
  useEffect(() => {
    if (lastReadyCount.current > 0 && ready.length > lastReadyCount.current) {
      if (soundOn) playReadyChime();
    }
    lastReadyCount.current = ready.length;
  }, [ready.length, soundOn]);

  const filteredReady = ready.filter((o) => {
    if (filterMod === "TODOS") return true;
    return getOrderModality(o).id === filterMod;
  });

  const toggleOrderSelection = (id) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBatchDispatch = async () => {
    if (selectedOrderIds.length === 0) return;
    if (!batchDriverId) {
      store.toast("Selecione um entregador para a rota!");
      return;
    }
    try {
      setDispatchingRoute(true);
      await store.dispatchRoute({ driverId: batchDriverId, orderIds: selectedOrderIds });
      store.toast(`🚀 Rota com ${selectedOrderIds.length} paradas despachada com sucesso!`);
      setSelectedOrderIds([]);
      setBatchDriverId("");
      setOptimizedOrder(null);
    } catch (err) {
      store.toast(err.message || "Erro ao despachar rota multi-paradas");
    } finally {
      setDispatchingRoute(false);
    }
  };

  const handleOptimizeRoute = async () => {
    if (selectedOrderIds.length < 2) {
      store.toast("Selecione pelo menos 2 pedidos para otimizar");
      return;
    }
    setOptimizing(true);
    try {
      const res = await fetch("/api/routes/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ orderIds: selectedOrderIds })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao otimizar");
      if (data.optimized) {
        const newOrder = data.orders.map(o => o.id);
        setSelectedOrderIds(newOrder);
        setOptimizedOrder(data);
        store.toast(`✅ Rota otimizada! ${Math.round(data.distance/1000*10)/10}km · ${Math.round(data.duration/60)}min`);
      } else {
        store.toast(`⚠️ Não foi possível otimizar (${data.reason}), mantendo ordem original`);
      }
    } catch (e) {
      store.toast(e.message);
    }
    setOptimizing(false);
  };

  return (
    <div style={{ background: C.black, minHeight: "100%" }} className="p-4 md:p-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Logo size={40} withText={false} />
          <div>
            <h2 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 24, color: C.white, letterSpacing: "-0.02em" }}>
              EXPEDIÇÃO
            </h2>
            <div style={{ color: "#7a7a7a", fontSize: 11.5 }}>{ready.length} aguardando saída · {rota.length} em rota</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Som da expedição */}
          <button
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              localStorage.setItem("sarro_sound_expedition", next ? "1" : "0");
              if (next) playReadyChime();
              store.toast(next ? "🔔 Alerta sonoro da expedição ATIVADO!" : "🔕 Som da expedição MUTADO");
            }}
            className="rounded-lg px-2.5 py-1.5 font-bold transition active:scale-95 flex items-center gap-1.5"
            style={{
              background: soundOn ? "#16653433" : C.gray850,
              border: `1px solid ${soundOn ? C.green : C.gray800}`,
              color: soundOn ? C.green : "#8a8a8a",
              fontSize: 11,
              whiteSpace: "nowrap",
            }}
          >
            <span>{soundOn ? "🔔" : "🔕"}</span>
            <span>Som {soundOn ? "ON" : "OFF"}</span>
          </button>

          {/* Botão para abrir Histórico de Acertos */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="rounded-lg px-2.5 py-1.5 font-bold text-xs flex items-center gap-1.5 text-white active:scale-95"
            style={{ background: C.gray800, border: `1px solid ${C.gray700}` }}
          >
            <span>🤝</span>
            <span>Histórico de Acertos</span>
          </button>

          {/* Botão para abrir Painel TV */}
          <button
            onClick={() => window.open("/paineltv", "_blank")}
            className="rounded-lg px-2.5 py-1.5 font-bold text-xs flex items-center gap-1.5 text-white active:scale-95"
            style={{ background: C.gray800, border: `1px solid ${C.gray700}` }}
          >
            <span>📺</span>
            <span>Abrir Painel TV</span>
          </button>

          <SyncBadge store={store} now={now} />
          {store.me && (
            <button
              onClick={store.logout}
              className="rounded-lg px-2.5 py-1.5 font-bold"
              style={{ border: `1px solid ${C.gray800}`, color: "#8a8a8a", fontSize: 11 }}
            >
              Sair
            </button>
          )}
        </div>
      </div>

      {/* FILTROS POR MODALIDADE */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { id: "TODOS", label: `Todos (${ready.length})` },
          { id: "delivery", label: `🛵 Delivery (${ready.filter((o) => getOrderModality(o).id === "delivery").length})` },
          { id: "mesa", label: `🍽️ Salão (${ready.filter((o) => getOrderModality(o).id === "mesa").length})` },
          { id: "pickup", label: `🏪 Balcão (${ready.filter((o) => getOrderModality(o).id === "pickup").length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterMod(tab.id)}
            className="rounded-lg px-3 py-1.5 font-bold text-xs transition"
            style={{
              background: filterMod === tab.id ? C.orange : C.gray850,
              color: filterMod === tab.id ? C.black : "#8a8a8a",
              border: `1px solid ${filterMod === tab.id ? C.orange : C.gray800}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Pedidos prontos ({filteredReady.length})</div>
          {filteredReady.length === 0 && (
            <Card className="p-6 text-center">
              <span style={{ color: "#8a8a8a", fontSize: 13 }}>
                {filterMod === "TODOS" ? "Nada pronto no balcão agora." : `Nenhum pedido pronto em ${filterMod}.`}
              </span>
            </Card>
          )}
          {filteredReady.map((o) => {
            const mod = getOrderModality(o);
            const isDelivery = !mod.isMesa && !mod.isPickup;
            const isSelected = selectedOrderIds.includes(o.id);
            const selectedSeq = isSelected ? selectedOrderIds.indexOf(o.id) + 1 : 0;

            return (
              <Card key={o.id} className="p-0 overflow-hidden" style={{ border: `2px solid ${isSelected ? C.orange : mod.border + "66"}` }}>
                {/* Banner de Modalidade */}
                <div
                  className="px-3.5 py-1.5 flex items-center justify-between font-black text-xs"
                  style={{ background: mod.bg, borderBottom: `1px solid ${mod.border}44` }}
                >
                  <div className="flex items-center gap-1.5" style={{ color: mod.color }}>
                    <span>{mod.icon}</span>
                    <span>{mod.label}</span>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase" style={{ color: mod.color }}>
                    {mod.instruction}
                  </span>
                </div>

                <div className="p-4">
                  {/* Seletor de Rota Composta (apenas entregas) */}
                  {isDelivery && (
                    <div
                      className="mb-2 flex items-center justify-between p-2 rounded-lg cursor-pointer transition"
                      style={{
                        background: isSelected ? `${C.orange}22` : C.gray850,
                        border: `1px solid ${isSelected ? C.orange : C.gray800}`,
                      }}
                      onClick={() => toggleOrderSelection(o.id)}
                    >
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold" style={{ color: isSelected ? C.orange : C.white }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-orange-500 cursor-pointer pointer-events-none"
                        />
                        <span>Agrupar nesta Rota Composta</span>
                      </label>
                      {isSelected ? (
                        <span className="px-2 py-0.5 rounded-full font-black text-[10px]" style={{ background: C.orange, color: C.black }}>
                          PARADA #{selectedSeq}
                        </span>
                      ) : (
                        <span style={{ color: "#7a7a7a", fontSize: 10 }}>Clique para incluir na rota</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span style={{ color: C.white, fontWeight: 900, fontSize: 18 }}>#{o.code}</span>
                      <ChannelPill channel={o.channel} />
                      <StatusPill status={o.status} small />
                    </div>
                    <span style={{ color: "#7a7a7a", fontSize: 11 }}>pronto há {elapsed(o.createdAt, now)}</span>
                  </div>

                  {o.routeId && (
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold" style={{ color: C.orange }}>
                      <span>🛵 ROTA COMPOSTA:</span>
                      <span>Parada #{o.routeSeq || 1}</span>
                      <span style={{ color: "#7a7a7a", fontWeight: 400 }}>({o.routeId.slice(-6).toUpperCase()})</span>
                    </div>
                  )}

                  <div style={{ color: "#c9c9c9", fontSize: 13, fontWeight: 700 }}>{o.customer.name}</div>
                  <div style={{ color: "#7a7a7a", fontSize: 11.5 }}>
                    {mod.isMesa ? `🍽️ ${mod.badge} · Consumo no local` : mod.isPickup ? "🏪 Retirada na loja" : `🛵 ${o.customer.addr}`}
                  </div>

                  {o.paymentStatus === "pendente" ? (
                    <div className="mt-2.5 p-2 rounded-lg flex items-center justify-between" style={{ background: "#eab30818", border: "1px solid #eab30844" }}>
                      <div className="flex items-center gap-1.5">
                        <span>⏳</span>
                        <span style={{ color: "#fef08a", fontSize: 11, fontWeight: 700 }}>Pgto Pendente ({o.payment})</span>
                      </div>
                      <button
                        onClick={() => store.confirmPaymentManual(o.id)}
                        className="px-2 py-1 rounded-md font-bold text-[11px] text-black transition active:scale-95"
                        style={{ background: "#22c55e" }}
                      >
                        ✓ Confirmar Pgto
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-1.5" style={{ color: "#22c55e", fontSize: 11, fontWeight: 700 }}>
                      <span>✓ Pagamento Confirmado</span>
                      <span style={{ color: "#8a8a8a", fontWeight: 400 }}>({o.payment})</span>
                    </div>
                  )}

                  <div className="mt-3">
                    <Btn small full variant="dark" onClick={async () => {
                      try {
                        await api(`/api/print/expedition/${o.id}`, { method: "POST" });
                        store.toast("Comanda enviada à impressora ✓");
                      } catch {
                        printExpedition(o);
                      }
                    }}>🖨 IMPRIMIR EXPEDIÇÃO</Btn>
                  </div>

                  {mod.isMesa ? (
                    <div className="mt-2 space-y-2">
                      {o.payment === "No fechamento da mesa" ? (
                        <>
                          <div className="p-2 rounded-lg text-center" style={{ background: "#f59e0b18", border: "1px solid #f59e0b44" }}>
                            <div style={{ color: "#fbbf24", fontSize: 11, fontWeight: 800 }}>⏳ AGUARDA PAGAMENTO NO MÓDULO MESAS</div>
                            <div style={{ color: "#a0a0a0", fontSize: 10, marginTop: 2 }}>Leve à {mod.badge} e feche a conta em Mesas → Fechar Conta</div>
                          </div>
                          <Btn full variant="dark" onClick={() => {
                            store.toast(`🍽️ ${mod.badge} servida! Mesa continua ocupada até pagamento no módulo Mesas.`);
                          }}>
                            🍽️ MARCAR COMO SERVIDO NA {mod.badge}
                          </Btn>
                        </>
                      ) : (
                        <Btn full variant="green" onClick={() => store.setStatus(o.id, "ENTREGUE")}>
                          🍽️ LEVAR À {mod.badge} & CONCLUIR (JÁ PAGO)
                        </Btn>
                      )}
                    </div>
                  ) : mod.isPickup ? (
                    <div className="mt-2">
                      <Btn full variant="green" onClick={() => store.setStatus(o.id, "ENTREGUE")}>
                        🏪 CLIENTE RETIROU NO BALCÃO
                      </Btn>
                    </div>
                  ) : (
                    <div className="mt-3">
                      {o.status === "PRONTO" && <Btn full onClick={() => store.setStatus(o.id, "EMBALADO")}>EMBALAR PEDIDO</Btn>}
                      {o.status === "EMBALADO" && <Btn full onClick={() => store.setStatus(o.id, "AGUARDANDO")}>CHAMAR ENTREGADOR</Btn>}
                      {o.status === "AGUARDANDO" && (
                        <div>
                          <div style={{ color: "#8a8a8a", fontSize: 11.5, marginBottom: 7 }}>Atribuir entregador individual</div>
                          <div className="flex flex-wrap gap-2">
                            {store.drivers.map((d) => (
                              <Btn key={d.id} small variant="dark" onClick={() => store.assignDriver(o.id, d.id)}>
                                🛵 {d.name.split(" ")[0]}
                              </Btn>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="space-y-3">
          <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Entregadores</div>
          {store.drivers.map((d) => {
            const load = store.orders.filter((o) => o.driverId === d.id && o.status === "ROTA").length;
            return (
              <Card key={d.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center rounded-full" style={{ width: 38, height: 38, background: C.gray800, fontSize: 18 }}>🛵</div>
                  <div className="flex-1">
                    <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>{d.name}</div>
                    <div style={{ color: "#7a7a7a", fontSize: 11 }}>{d.vehicle}</div>
                  </div>
                  <span style={{ color: load ? C.orange : C.green, fontSize: 11, fontWeight: 800 }}>
                    {load ? `${load} em rota` : "livre"}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${C.gray800}` }}>
                  <span style={{ color: "#7a7a7a", fontSize: 11 }}>Turno & diária:</span>
                  <button
                    onClick={() => setSettlementDriver(d)}
                    className="px-2 py-1 rounded-lg font-bold text-xs active:scale-95 transition flex items-center gap-1"
                    style={{ background: "#16653433", color: C.green, border: `1px solid ${C.green}55` }}
                  >
                    <span>🤝</span>
                    <span>Fechar Acerto</span>
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* BARRA FLUTUANTE DE ROTA COMPOSTA / MULTI-STOP */}
      {selectedOrderIds.length > 0 && (
        <div
          className="fixed bottom-4 left-4 right-4 z-40 max-w-4xl mx-auto p-4 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-3 animate-bounce-subtle"
          style={{ background: "#1c1917", border: `2px solid ${C.orange}`, boxShadow: "0 10px 30px rgba(0,0,0,0.8)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <div>
              <div style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>
                {selectedOrderIds.length} {selectedOrderIds.length === 1 ? "entrega selecionada" : "entregas selecionadas na rota"}
              </div>
              <div style={{ color: "#a0a0a0", fontSize: 11 }}>
                {optimizedOrder ? `✅ Otimizada: ${Math.round(optimizedOrder.distance/1000*10)/10}km · ${Math.round(optimizedOrder.duration/60)}min` : "Despache para um motoboy em rota otimizada multi-paradas"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={batchDriverId}
              onChange={(e) => setBatchDriverId(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
              style={{ background: C.gray850, border: `1px solid ${C.gray700}` }}
            >
              <option value="">-- Selecione o Entregador --</option>
              {store.drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  🛵 {d.name} ({d.vehicle || "Moto"})
                </option>
              ))}
            </select>

            <button
              disabled={optimizing || selectedOrderIds.length < 2}
              onClick={handleOptimizeRoute}
              className="px-3 py-2 rounded-xl font-black text-xs text-white active:scale-95 transition flex items-center gap-1 disabled:opacity-50"
              style={{ background: selectedOrderIds.length < 2 ? C.gray800 : `${C.blue}DD`, border: `1px solid ${C.blue}` }}
            >
              <span>{optimizing ? "⏳" : "🗺️"}</span>
              <span>{optimizing ? "Otimizando..." : "Otimizar (OSRM)"}</span>
            </button>

            <button
              disabled={dispatchingRoute || !batchDriverId}
              onClick={handleBatchDispatch}
              className="px-4 py-2 rounded-xl font-black text-xs text-black active:scale-95 transition flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: C.green }}
            >
              <span>{dispatchingRoute ? "⏳" : "🚀"}</span>
              <span>{dispatchingRoute ? "Despachando..." : `DESPACHAR ROTA (${selectedOrderIds.length})`}</span>
            </button>

            <a
              href={buildGoogleMapsMultiStopUrl(
                (optimizedOrder?.orders || selectedOrderIds.map((id) => store.orders.find((o) => o.id === id)).filter(Boolean)),
                store.settings?.address
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-xl font-bold text-xs text-white flex items-center gap-1 active:scale-95 text-decoration-none"
              style={{ background: "#4285F4" }}
            >
              <span>🗺️</span>
              <span>Ver no Maps</span>
            </a>

            <button
              onClick={() => setSelectedOrderIds([])}
              className="px-3 py-2 rounded-xl font-bold text-xs text-gray-400 hover:text-white"
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      {/* Modais de Acerto */}
      {settlementDriver && (
        <DriverSettlementModal
          driver={settlementDriver}
          store={store}
          onClose={() => setSettlementDriver(null)}
        />
      )}
      {showHistoryModal && (
        <SettlementsHistoryModal
          store={store}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// PAINEL TV — CHAMADOR DE SENHAS & STATUS DO SALÃO
// ============================================================


export default ExpeditionApp;

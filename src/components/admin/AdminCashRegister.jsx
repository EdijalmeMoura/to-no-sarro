import React, { useState, useEffect, useMemo, useRef } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";
import ServiceChargeCard from "./ServiceChargeCard.jsx";
import WaiterReport from "./WaiterReport.jsx";
import LowStockAlerts from "./LowStockAlerts.jsx";

function AdminCashRegister({ store, now }) {
  const reg = store.cashRegister;
  const isOpen = reg && reg.status === "OPEN";

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(null); // 'SUPRIMENTO' | 'SANGRIA'
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Inputs Abertura
  const [initialCashInput, setInitialCashInput] = useState("150");
  const [openNotesInput, setOpenNotesInput] = useState("");

  // Inputs Movimentação (Suprimento / Sangria)
  const [txAmount, setTxAmount] = useState("");
  const [txReason, setTxReason] = useState("");

  // Inputs Fechamento
  const [closeCashInput, setCloseCashInput] = useState("");
  const [closePixInput, setClosePixInput] = useState("");
  const [closeCardInput, setCloseCardInput] = useState("");
  const [closeNotesInput, setCloseNotesInput] = useState("");

  const [busy, setBusy] = useState(false);

  // Carrega histórico quando abre a aba de histórico
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const d = await api("/api/cash/history");
      setHistoryList(d.history || []);
    } catch (e) {
      store.toast("Falha ao carregar histórico: " + e.message);
    }
    setLoadingHistory(false);
  };

  const handleOpenRegister = async () => {
    const val = parseFloat(String(initialCashInput).replace(/\./g, "").replace(",", ".")) || 0;
    setBusy(true);
    try {
      await store.openCashRegister({ initialCash: val, notes: openNotesInput });
      setShowOpenModal(false);
      setOpenNotesInput("");
    } catch (e) {
      store.toast(e.message);
    }
    setBusy(false);
  };

  const handleAddTx = async () => {
    const val = parseFloat(String(txAmount).replace(/\./g, "").replace(",", ".")) || 0;
    if (val <= 0) {
      store.toast("Informe um valor válido maior que zero.");
      return;
    }
    if (!txReason.trim()) {
      store.toast("Informe o motivo da movimentação.");
      return;
    }
    setBusy(true);
    try {
      await store.addCashTransaction({
        type: showTxModal,
        amount: val,
        reason: txReason.trim(),
        method: "DINHEIRO",
      });
      setShowTxModal(null);
      setTxAmount("");
      setTxReason("");
    } catch (e) {
      store.toast(e.message);
    }
    setBusy(false);
  };

  const handleCloseRegister = async () => {
    const cCash = parseFloat(String(closeCashInput).replace(/\./g, "").replace(",", ".")) || 0;
    const cPix = closePixInput ? parseFloat(String(closePixInput).replace(/\./g, "").replace(",", ".")) : null;
    const cCard = closeCardInput ? parseFloat(String(closeCardInput).replace(/\./g, "").replace(",", ".")) : null;

    setBusy(true);
    try {
      const closed = await store.closeCashRegister({
        closedCash: cCash,
        declaredPix: cPix,
        declaredCard: cCard,
        notes: closeNotesInput,
      });
      setShowCloseModal(false);
      setCloseCashInput("");
      setClosePixInput("");
      setCloseCardInput("");
      setCloseNotesInput("");
      // Oferece impressão
      printCashSummaryReceipt(closed, store.settings);
    } catch (e) {
      store.toast(e.message);
    }
    setBusy(false);
  };

  const handlePrint = (targetReg) => {
    const r = targetReg || reg;
    if (!r) return;
    api("/api/cash/print-summary", { method: "POST", body: { registerId: r.id } })
      .then((res) => {
        if (res.printed) {
          store.toast("Resumo enviado à impressora térmica de rede ✓");
        } else {
          printCashSummaryReceipt(r, store.settings);
        }
      })
      .catch(() => {
        printCashSummaryReceipt(r, store.settings);
      });
  };

  // Cálculo da quebra de caixa em tempo real no modal de fechamento
  const parsedCloseCash = parseFloat(String(closeCashInput).replace(/\./g, "").replace(",", ".")) || 0;
  const expectedGaveta = reg?.summary?.expectedCash || 0;
  const cashDiff = parsedCloseCash - expectedGaveta;

  return (
    <div className="space-y-4">
      {/* CABEÇALHO DO CAIXA */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl" style={{ background: C.gray900, border: `1px solid ${C.gray800}` }}>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-xl"
            style={{ width: 44, height: 44, background: isOpen ? `${C.green}22` : `${C.red}22`, fontSize: 22 }}
          >
            {isOpen ? "💵" : "🔒"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span style={{ color: C.white, fontWeight: 900, fontSize: 16 }}>
                FRENTE DE CAIXA / PDV
              </span>
              <span
                className="rounded-full px-2.5 py-0.5 font-black text-[11px]"
                style={{
                  background: isOpen ? "#22c55e22" : "#ef444422",
                  color: isOpen ? "#22c55e" : "#ef4444",
                  border: `1px solid ${isOpen ? "#22c55e55" : "#ef444455"}`,
                }}
              >
                {isOpen ? "● TURNO ABERTO" : "○ CAIXA FECHADO"}
              </span>
            </div>
            <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>
              {isOpen
                ? `Aberto por ${reg.openedBy} às ${fmtDT(reg.openedAt)} · Turno #${reg.id.slice(0, 8)}`
                : "Nenhum turno de caixa em andamento. Abra o caixa para iniciar o dia de vendas."}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOpen && (
            <button
              onClick={() => handlePrint(reg)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95"
              style={{ background: C.gray800, color: C.white, border: `1px solid ${C.gray700}` }}
            >
              <span>🖨️</span>
              <span>Imprimir Resumo</span>
            </button>
          )}

          <button
            onClick={() => {
              if (!showHistory) loadHistory();
              setShowHistory(!showHistory);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95"
            style={{
              background: showHistory ? C.orange : C.gray800,
              color: showHistory ? C.black : C.white,
              border: `1px solid ${showHistory ? C.orange : C.gray700}`,
            }}
          >
            <span>📜</span>
            <span>{showHistory ? "Voltar ao Caixa" : "Histórico de Turnos"}</span>
          </button>
        </div>
      </div>

      {/* SE VISUALIZANDO HISTÓRICO DE TURNOS */}
      {showHistory ? (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between pb-2" style={{ borderBottom: `1px solid ${C.gray800}` }}>
            <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Turnos de Caixa Anteriores</div>
            <Btn small variant="dark" onClick={loadHistory} disabled={loadingHistory}>
              {loadingHistory ? "Carregando…" : "Atualizar"}
            </Btn>
          </div>

          {historyList.length === 0 ? (
            <div className="py-10 text-center" style={{ color: "#666", fontSize: 13 }}>
              Nenhum turno de caixa fechado registrado no histórico.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr style={{ color: "#8a8a8a", borderBottom: `1px solid ${C.gray800}` }}>
                    <th className="py-2.5 px-2">Turno</th>
                    <th className="py-2.5 px-2">Abertura</th>
                    <th className="py-2.5 px-2">Fechamento</th>
                    <th className="py-2.5 px-2">Operador</th>
                    <th className="py-2.5 px-2">Total Vendas</th>
                    <th className="py-2.5 px-2">Esperado Gaveta</th>
                    <th className="py-2.5 px-2">Contado Gaveta</th>
                    <th className="py-2.5 px-2">Diferença</th>
                    <th className="py-2.5 px-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {historyList.map((h) => {
                    const s = h.summary;
                    const diff = s.diffCash;
                    return (
                      <tr key={h.id} className="hover:bg-gray-850 transition">
                        <td className="py-2.5 px-2 font-mono font-bold text-white">#{h.id.slice(0, 8)}</td>
                        <td className="py-2.5 px-2 text-gray-300">{fmtDT(h.openedAt)}</td>
                        <td className="py-2.5 px-2 text-gray-300">{fmtDT(h.closedAt)}</td>
                        <td className="py-2.5 px-2 text-gray-300">{h.closedBy || h.openedBy}</td>
                        <td className="py-2.5 px-2 font-bold" style={{ color: C.yellowLight }}>{brl(s.totalSales)}</td>
                        <td className="py-2.5 px-2 text-gray-300">{brl(s.expectedCash)}</td>
                        <td className="py-2.5 px-2 text-white font-bold">{s.closedCash !== null ? brl(s.closedCash) : "—"}</td>
                        <td className="py-2.5 px-2 font-bold">
                          {diff === null ? (
                            "—"
                          ) : diff === 0 ? (
                            <span className="text-green-400">R$ 0,00</span>
                          ) : diff > 0 ? (
                            <span className="text-emerald-400">+{brl(diff)}</span>
                          ) : (
                            <span className="text-red-400">-{brl(Math.abs(diff))}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <button
                            onClick={() => handlePrint(h)}
                            className="px-2 py-1 rounded font-bold text-[11px] hover:bg-gray-700 transition"
                            style={{ background: C.gray800, color: C.white, border: `1px solid ${C.gray700}` }}
                          >
                            🖨️ Cupom
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : !isOpen ? (
        /* SE O CAIXA ESTÁ FECHADO */
        <Card className="p-8 text-center max-w-lg mx-auto my-6 space-y-4">
          <div className="text-5xl">🔒</div>
          <div>
            <div style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 24 }}>
              CAIXA FECHADO
            </div>
            <p style={{ color: "#8a8a8a", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
              Abra um novo turno de caixa informando o valor do fundo de troco inicial da gaveta para liberar operações e conferências no balcão.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                setInitialCashInput("150");
                setShowOpenModal(true);
              }}
              className="w-full py-3.5 px-6 rounded-xl font-black text-black transition active:scale-95 shadow-lg text-sm"
              style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.yellow})` }}
            >
              💵 ABRIR NOVO TURNO DE CAIXA
            </button>
          </div>
        </Card>
      ) : (
        /* SE O CAIXA ESTÁ ABERTO */
        <div className="space-y-4">
          {/* 4 CARDS DE INDICADORES / KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-3.5">
              <div className="flex items-center justify-between text-xs" style={{ color: "#8a8a8a" }}>
                <span>Fundo de Troco</span>
                <span>🪙</span>
              </div>
              <div style={{ color: C.white, fontWeight: 900, fontSize: 20, marginTop: 4 }}>
                {brl(reg.summary.initialCash)}
              </div>
              <div style={{ color: "#6a6a6a", fontSize: 10.5, marginTop: 2 }}>Fundo de abertura</div>
            </Card>

            <Card className="p-3.5">
              <div className="flex items-center justify-between text-xs" style={{ color: "#8a8a8a" }}>
                <span>Vendas no Turno</span>
                <span>🧾</span>
              </div>
              <div style={{ color: C.yellowLight, fontWeight: 900, fontSize: 20, marginTop: 4 }}>
                {brl(reg.summary.totalSales)}
              </div>
              <div style={{ color: "#6a6a6a", fontSize: 10.5, marginTop: 2 }}>
                {reg.summary.orderCount} pedido{reg.summary.orderCount === 1 ? "" : "s"} concluídos
              </div>
            </Card>

            <Card className="p-3.5">
              <div className="flex items-center justify-between text-xs" style={{ color: "#8a8a8a" }}>
                <span>Movimentações</span>
                <span>↕️</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-green-400 font-bold text-sm">+{brl(reg.summary.suprimentos)}</span>
                <span className="text-gray-500">/</span>
                <span className="text-red-400 font-bold text-sm">-{brl(reg.summary.sangrias)}</span>
              </div>
              <div style={{ color: "#6a6a6a", fontSize: 10.5, marginTop: 2 }}>Suprimentos e sangrias</div>
            </Card>

            <Card className="p-3.5" style={{ border: `2px solid ${C.yellow}77`, background: `${C.yellow}0d` }}>
              <div className="flex items-center justify-between text-xs" style={{ color: C.yellowLight, fontWeight: 800 }}>
                <span>ESPERADO NA GAVETA</span>
                <span>💵</span>
              </div>
              <div style={{ color: C.yellowLight, fontWeight: 900, fontSize: 22, marginTop: 4 }}>
                {brl(reg.summary.expectedCash)}
              </div>
              <div style={{ color: "#c9c9c9", fontSize: 10.5, marginTop: 2 }}>
                Fundo + Dinheiro + Supr. − Sangr.
              </div>
            </Card>
          </div>

          {/* BARRA DE AÇÕES DO CAIXA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => {
                setTxAmount("");
                setTxReason("");
                setShowTxModal("SUPRIMENTO");
              }}
              className="py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition active:scale-95 text-xs text-white"
              style={{ background: "#166534", border: "1px solid #22c55e55" }}
            >
              <span className="text-base">➕</span>
              <span>SUPRIMENTO (REFORÇO)</span>
            </button>

            <button
              onClick={() => {
                setTxAmount("");
                setTxReason("");
                setShowTxModal("SANGRIA");
              }}
              className="py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition active:scale-95 text-xs text-white"
              style={{ background: "#991b1b", border: "1px solid #ef444455" }}
            >
              <span className="text-base">➖</span>
              <span>SANGRIA (RETIRADA)</span>
            </button>

            <button
              onClick={() => {
                setCloseCashInput(String(reg.summary.expectedCash || ""));
                setClosePixInput(String(reg.summary.pixSales || ""));
                setCloseCardInput(String(reg.summary.cardSales || ""));
                setCloseNotesInput("");
                setShowCloseModal(true);
              }}
              className="py-3 px-4 rounded-xl font-black flex items-center justify-center gap-2 transition active:scale-95 text-xs text-black"
              style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.yellow})` }}
            >
              <span className="text-base">🔒</span>
              <span>FECHAR CAIXA & CONFERÊNCIA</span>
            </button>
          </div>

          {/* SEÇÕES EM DUAS COLUNAS: VENDAS POR MÉTODO & EXTRATO */}
          <div className="grid lg:grid-cols-5 gap-4">
            {/* Coluna 1: Vendas por Método de Pagamento (2 colunas) */}
            <Card className="lg:col-span-2 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2" style={{ borderBottom: `1px solid ${C.gray800}` }}>
                <span style={{ color: C.white, fontWeight: 900, fontSize: 13.5 }}>
                  Vendas por Forma de Pagamento
                </span>
                <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 13.5 }}>
                  {brl(reg.summary.totalSales)}
                </span>
              </div>

              <div className="space-y-2.5">
                {[
                  { label: "Dinheiro (Gaveta)", icon: "💵", val: reg.summary.cashSales, color: "#22c55e" },
                  { label: "Pix Instantâneo", icon: "💠", val: reg.summary.pixSales, color: "#38bdf8" },
                  { label: "Cartão Crédito / Débito", icon: "💳", val: reg.summary.cardSales, color: "#f59e0b" },
                  { label: "Outros / Faturado", icon: "📑", val: reg.summary.otherSales, color: "#a855f7" },
                ].map((item) => {
                  const pct = reg.summary.totalSales > 0 ? (item.val / reg.summary.totalSales) * 100 : 0;
                  return (
                    <div key={item.label} className="p-2.5 rounded-xl" style={{ background: C.black, border: `1px solid ${C.gray855 || C.gray850}` }}>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-bold" style={{ color: C.white }}>
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </div>
                        <span className="font-bold text-white">{brl(item.val)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                        <span>Participação</span>
                        <span>{pct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: item.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 rounded-xl text-xs space-y-1" style={{ background: C.gray850 }}>
                <div className="flex justify-between text-gray-400">
                  <span>Fundo Inicial:</span>
                  <span>+{brl(reg.summary.initialCash)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Vendas em Dinheiro:</span>
                  <span>+{brl(reg.summary.cashSales)}</span>
                </div>
                <div className="flex justify-between text-green-400">
                  <span>Suprimentos:</span>
                  <span>+{brl(reg.summary.suprimentos)}</span>
                </div>
                <div className="flex justify-between text-red-400">
                  <span>Sangrias:</span>
                  <span>-{brl(reg.summary.sangrias)}</span>
                </div>
                <div className="flex justify-between pt-1.5 font-bold text-white text-sm" style={{ borderTop: `1px solid ${C.gray700}` }}>
                  <span>Esperado em Dinheiro:</span>
                  <span style={{ color: C.yellowLight }}>{brl(reg.summary.expectedCash)}</span>
                </div>
              </div>
            </Card>

            {/* Coluna 2: Extrato Detalhado de Movimentações (3 colunas) */}
            <Card className="lg:col-span-3 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2" style={{ borderBottom: `1px solid ${C.gray800}` }}>
                <div className="flex items-center gap-2">
                  <span style={{ color: C.white, fontWeight: 900, fontSize: 13.5 }}>
                    Extrato de Movimentações do Caixa
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 font-bold">
                    {reg.transactions.length}
                  </span>
                </div>
                <span style={{ color: "#7a7a7a", fontSize: 11 }}>Mais recentes primeiro</span>
              </div>

              {reg.transactions.length === 0 ? (
                <div className="py-12 text-center" style={{ color: "#666", fontSize: 12 }}>
                  Nenhuma movimentação avulsa registrada neste turno.
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {reg.transactions.map((tx) => {
                    const isSangria = tx.type === "SANGRIA";
                    const isSuprimento = tx.type === "SUPRIMENTO";
                    const badgeColor = isSangria ? "#ef4444" : isSuprimento ? "#22c55e" : "#38bdf8";

                    return (
                      <div
                        key={tx.id}
                        className="p-2.5 rounded-xl flex items-center justify-between transition"
                        style={{ background: C.black, border: `1px solid ${C.gray850}` }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-black shrink-0"
                            style={{
                              background: `${badgeColor}22`,
                              color: badgeColor,
                              border: `1px solid ${badgeColor}55`,
                            }}
                          >
                            {isSangria ? "SANGRIA" : isSuprimento ? "SUPRIMENTO" : tx.type}
                          </span>
                          <div className="truncate">
                            <div className="text-white font-bold text-xs truncate">{tx.reason}</div>
                            <div className="text-[10.5px] text-gray-500">
                              {fmtDT(tx.createdAt)} · por {tx.createdBy}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 pl-2">
                          <span
                            className="font-black text-sm"
                            style={{ color: isSangria ? "#ef4444" : isSuprimento ? "#22c55e" : C.white }}
                          >
                            {isSangria ? "-" : "+"}{brl(tx.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* MODAL 1: ABERTURA DE CAIXA */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.85)" }}>
          <Card className="w-full max-w-md p-5 space-y-4" style={{ border: `2px solid ${C.orange}`, background: C.gray900 }}>
            <div className="flex items-center justify-between">
              <div style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 20 }}>
                💵 ABRIR TURNO DE CAIXA
              </div>
              <button onClick={() => setShowOpenModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div style={{ color: "#a0a0a0", fontSize: 12 }}>
              Informe o valor do fundo de troco em moedas e notas colocado na gaveta do caixa.
            </div>

            <div>
              <label style={{ color: C.white, fontSize: 12, fontWeight: 700 }}>Fundo de Troco Inicial (R$)</label>
              <input
                type="number"
                step="0.01"
                value={initialCashInput}
                onChange={(e) => setInitialCashInput(e.target.value)}
                placeholder="150.00"
                className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none text-white font-bold text-lg"
                style={{ background: C.black, border: `1px solid ${C.gray700}` }}
              />
              {/* Presets rápidos */}
              <div className="flex gap-2 mt-2">
                {["50", "100", "150", "200", "300"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setInitialCashInput(p)}
                    className="flex-1 py-1 rounded-lg text-xs font-bold transition"
                    style={{
                      background: initialCashInput === p ? C.orange : C.gray800,
                      color: initialCashInput === p ? C.black : C.white,
                      border: `1px solid ${initialCashInput === p ? C.orange : C.gray700}`,
                    }}
                  >
                    R$ {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ color: C.white, fontSize: 12, fontWeight: 700 }}>Observações da Abertura (opcional)</label>
              <input
                type="text"
                value={openNotesInput}
                onChange={(e) => setOpenNotesInput(e.target.value)}
                placeholder="ex.: Turno Noite - Caixa 01"
                className="w-full rounded-xl px-3 py-2 mt-1 outline-none text-white text-xs"
                style={{ background: C.black, border: `1px solid ${C.gray800}` }}
              />
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={handleOpenRegister}
                disabled={busy}
                className="w-full py-3.5 rounded-xl font-black text-black transition active:scale-95"
                style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.yellow})` }}
              >
                {busy ? "Abrindo…" : "CONFIRMAR ABERTURA DE CAIXA"}
              </button>
              <Btn full variant="dark" onClick={() => setShowOpenModal(false)}>Cancelar</Btn>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 2: SUPRIMENTO / SANGRIA */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.85)" }}>
          <Card
            className="w-full max-w-md p-5 space-y-4"
            style={{
              border: `2px solid ${showTxModal === "SUPRIMENTO" ? "#22c55e" : "#ef4444"}`,
              background: C.gray900,
            }}
          >
            <div className="flex items-center justify-between">
              <div style={{ color: showTxModal === "SUPRIMENTO" ? "#22c55e" : "#ef4444", fontFamily: font.display, fontStyle: "italic", fontSize: 20 }}>
                {showTxModal === "SUPRIMENTO" ? "➕ NOVO SUPRIMENTO (REFORÇO)" : "➖ NOVA SANGRIA (RETIRADA)"}
              </div>
              <button onClick={() => setShowTxModal(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div style={{ color: "#a0a0a0", fontSize: 12 }}>
              {showTxModal === "SUPRIMENTO"
                ? "Adicione dinheiro à gaveta do caixa para reforço de troco ou moedas."
                : "Retire dinheiro da gaveta para cofre, pagamento de motoboy ou despesa de insumos."}
            </div>

            <div>
              <label style={{ color: C.white, fontSize: 12, fontWeight: 700 }}>Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                placeholder="50.00"
                className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none text-white font-bold text-lg"
                style={{ background: C.black, border: `1px solid ${C.gray700}` }}
              />
            </div>

            <div>
              <label style={{ color: C.white, fontSize: 12, fontWeight: 700 }}>Motivo / Justificativa</label>
              <input
                type="text"
                value={txReason}
                onChange={(e) => setTxReason(e.target.value)}
                placeholder={showTxModal === "SUPRIMENTO" ? "ex.: Troco de moedas de 1 real" : "ex.: Retirada para o cofre / Compra de pão"}
                className="w-full rounded-xl px-3 py-2 mt-1 outline-none text-white text-xs"
                style={{ background: C.black, border: `1px solid ${C.gray800}` }}
              />
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={handleAddTx}
                disabled={busy}
                className="w-full py-3.5 rounded-xl font-black text-white transition active:scale-95"
                style={{ background: showTxModal === "SUPRIMENTO" ? "#166534" : "#991b1b" }}
              >
                {busy ? "Registrando…" : `CONFIRMAR ${showTxModal}`}
              </button>
              <Btn full variant="dark" onClick={() => setShowTxModal(null)}>Cancelar</Btn>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 3: FECHAMENTO DE CAIXA COM CONFERÊNCIA */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.85)" }}>
          <Card className="w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto" style={{ border: `2px solid ${C.yellow}`, background: C.gray900 }}>
            <div className="flex items-center justify-between">
              <div style={{ color: C.yellowLight, fontFamily: font.display, fontStyle: "italic", fontSize: 20 }}>
                🔒 FECHAMENTO & CONFERÊNCIA DE CAIXA
              </div>
              <button onClick={() => setShowCloseModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div style={{ color: "#a0a0a0", fontSize: 12 }}>
              Conte o dinheiro físico na gaveta e confira os totais das maquininhas de cartão e Pix para apurar a quebra de caixa.
            </div>

            {/* Painel do Dinheiro */}
            <div className="p-3.5 rounded-xl space-y-2.5" style={{ background: C.black, border: `1px solid ${C.gray800}` }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">💵 Dinheiro Esperado na Gaveta:</span>
                <span className="font-bold text-white text-sm">{brl(expectedGaveta)}</span>
              </div>

              <div>
                <label className="text-xs font-bold text-white">Dinheiro Físico Contado na Gaveta (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={closeCashInput}
                  onChange={(e) => setCloseCashInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none text-white font-bold text-lg"
                  style={{ background: C.gray900, border: `1px solid ${C.gray700}` }}
                />
              </div>

              {/* Diferença em tempo real */}
              <div
                className="p-2.5 rounded-lg flex items-center justify-between font-bold text-xs"
                style={{
                  background: cashDiff === 0 ? "#22c55e18" : cashDiff > 0 ? "#10b98118" : "#ef444418",
                  border: `1px solid ${cashDiff === 0 ? "#22c55e55" : cashDiff > 0 ? "#10b98155" : "#ef444455"}`,
                  color: cashDiff === 0 ? "#22c55e" : cashDiff > 0 ? "#10b981" : "#ef4444",
                }}
              >
                <span>Diferença apurada:</span>
                <span>
                  {cashDiff === 0
                    ? "✓ Caixa Bateu Exato (R$ 0,00)"
                    : cashDiff > 0
                    ? `Sobra de Caixa: +${brl(cashDiff)}`
                    : `Falta de Caixa: -${brl(Math.abs(cashDiff))}`}
                </span>
              </div>
            </div>

            {/* Conferência Pix & Cartão */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl space-y-1" style={{ background: C.black, border: `1px solid ${C.gray800}` }}>
                <div className="text-[11px] text-gray-400">Pix Esperado: {brl(reg.summary.pixSales)}</div>
                <label className="text-xs font-bold text-white block">Pix Conferido (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={closePixInput}
                  onChange={(e) => setClosePixInput(e.target.value)}
                  placeholder={String(reg.summary.pixSales)}
                  className="w-full rounded-lg px-2.5 py-1.5 outline-none text-white font-bold text-xs"
                  style={{ background: C.gray900, border: `1px solid ${C.gray700}` }}
                />
              </div>

              <div className="p-3 rounded-xl space-y-1" style={{ background: C.black, border: `1px solid ${C.gray800}` }}>
                <div className="text-[11px] text-gray-400">Cartão Esperado: {brl(reg.summary.cardSales)}</div>
                <label className="text-xs font-bold text-white block">Cartão Conferido (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={closeCardInput}
                  onChange={(e) => setCloseCardInput(e.target.value)}
                  placeholder={String(reg.summary.cardSales)}
                  className="w-full rounded-lg px-2.5 py-1.5 outline-none text-white font-bold text-xs"
                  style={{ background: C.gray900, border: `1px solid ${C.gray700}` }}
                />
              </div>
            </div>

            <div>
              <label style={{ color: C.white, fontSize: 12, fontWeight: 700 }}>Observações do Fechamento (opcional)</label>
              <input
                type="text"
                value={closeNotesInput}
                onChange={(e) => setCloseNotesInput(e.target.value)}
                placeholder="ex.: Tudo conferido e depositado no cofre"
                className="w-full rounded-xl px-3 py-2 mt-1 outline-none text-white text-xs"
                style={{ background: C.black, border: `1px solid ${C.gray800}` }}
              />
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={handleCloseRegister}
                disabled={busy}
                className="w-full py-3.5 rounded-xl font-black text-black transition active:scale-95 text-sm"
                style={{ background: C.green }}
              >
                {busy ? "Fechando…" : "✅ CONFIRMAR FECHAMENTO DE CAIXA"}
              </button>
              <Btn full variant="dark" onClick={() => setShowCloseModal(false)}>Cancelar</Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default AdminCashRegister;

import React, { useState, useEffect, useRef } from "react";
import { C, font } from "../../constants/theme.js";
import { brl, elapsed } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { Card, Btn, WaIcon } from "../ui/index.jsx";

// Minimal stubs for missing globals — will be replaced via props/store
const TRACK_STEPS = [
  { key: "NOVO", label: "Pedido recebido", icon: "🆕" },
  { key: "CONFIRMADO", label: "Confirmado pela loja", icon: "✅" },
  { key: "PREPARO", label: "Em preparação", icon: "🔥" },
  { key: "PRONTO", label: "Pronto para entrega", icon: "🍔" },
  { key: "EMBALADO", label: "Embalado", icon: "📦" },
  { key: "AGUARDANDO", label: "Aguardando entregador", icon: "⏳" },
  { key: "ROTA", label: "Saiu para entrega", icon: "🛵" },
  { key: "ENTREGUE", label: "Entregue", icon: "✓" },
];
const TRACK_STEPS_MESA = [
  { key: "NOVO", label: "Comanda aberta", icon: "🍽️" },
  { key: "CONFIRMADO", label: "Confirmado pela cozinha", icon: "✅" },
  { key: "PREPARO", label: "Em preparação", icon: "🔥" },
  { key: "PRONTO", label: "Pronto para servir", icon: "🍔" },
  { key: "ENTREGUE", label: "Conta fechada", icon: "✓" },
];
const TRACK_STEPS_PICKUP = [
  { key: "NOVO", label: "Pedido recebido", icon: "🆕" },
  { key: "CONFIRMADO", label: "Confirmado", icon: "✅" },
  { key: "PREPARO", label: "Em preparação", icon: "🔥" },
  { key: "PRONTO", label: "Pronto para retirada", icon: "🏪" },
  { key: "ENTREGUE", label: "Retirado", icon: "✓" },
];

function beep(freq = 880, dur = 0.14) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    o.connect(g); g.connect(ctx.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    setTimeout(() => ctx.close(), dur*1000+100);
  } catch {}
}
function playSuccessChime() { beep(880,0.15); setTimeout(()=>beep(1174,0.35),180); }

export default function TrackScreen({ order, store, now }) {
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [pixInfo, setPixInfo] = useState(null);
  const [justApproved, setJustApproved] = useState(false);
  const prevPaymentStatus = useRef(order?.paymentStatus);

  useEffect(() => {
    if (!order) return;
    store.refreshMyOrder?.().catch(() => {});
    const t = setInterval(() => store.refreshMyOrder?.().catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [order?.id]);

  useEffect(() => {
    if (order?.paymentStatus !== "pendente") return;
    const t = setInterval(() => {
      store.checkPayment(order.id).then((res) => {
        if (res?.paid) store.refreshMyOrder?.().catch(() => {});
      }).catch(() => {});
    }, 3500);
    return () => clearInterval(t);
  }, [order?.id, order?.paymentStatus]);

  useEffect(() => {
    if (!order) return;
    if (order.pixCode) {
      setPixInfo({ pixCode: order.pixCode, amount: order.total, pixKey: order.pixKey, url: order.payUrl });
      return;
    }
    const tt = encodeURIComponent(order.trackToken || localStorage.getItem("sarro_my_token") || "");
    api(`/api/orders/${order.id}/pix?t=${tt}`).then((data) => setPixInfo(data)).catch(() => {});
  }, [order?.id, order?.pixCode]);

  useEffect(() => {
    if (prevPaymentStatus.current === "pendente" && order?.paymentStatus === "pago") {
      playSuccessChime();
      store.triggerConfetti?.();
      setJustApproved(true);
      store.toast("✅ Pagamento Aprovado com Sucesso!");
    }
    prevPaymentStatus.current = order?.paymentStatus;
  }, [order?.paymentStatus]);

  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!order?.createdAt) return 900;
    const elapsedSec = Math.floor((Date.now() - order.createdAt) / 1000);
    return Math.max(0, 900 - elapsedSec);
  });

  useEffect(() => {
    if (order?.paymentStatus !== "pendente") return;
    const interval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - (order?.createdAt || Date.now())) / 1000);
      setSecondsLeft(Math.max(0, 900 - elapsedSec));
    }, 1000);
    return () => clearInterval(interval);
  }, [order?.createdAt, order?.paymentStatus]);

  if (!order) {
    return (
      <div className="px-4 py-16 text-center max-w-[640px] mx-auto">
        <div style={{ fontSize: 52 }}>📦</div>
        <div style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 20, marginTop: 10 }}>NENHUM PEDIDO ATIVO</div>
        <p style={{ color: "#8a8a8a", fontSize: 13, marginTop: 6 }}>Quando você pedir, o acompanhamento aparece aqui.</p>
        <div className="mt-5 flex justify-center"><Btn onClick={() => store.setTab("cardapio")}>Ver cardápio</Btn></div>
      </div>
    );
  }

  const mod = getOrderModality(order);
  const isMesa = mod.isMesa;
  const isPickup = mod.isPickup;
  const steps = isMesa ? TRACK_STEPS_MESA : isPickup ? TRACK_STEPS_PICKUP : TRACK_STEPS;

  const normalizeStatus = (status) => {
    if (steps.find((s) => s.key === status)) return status;
    if (isMesa || isPickup) {
      if (["EMBALADO", "AGUARDANDO", "ROTA"].includes(status)) return "PRONTO";
    }
    return status;
  };

  const normalizedStatus = normalizeStatus(order.status);
  const idx = steps.findIndex((s) => s.key === normalizedStatus);
  const pos = idx === -1 ? steps.length - 1 : idx;
  const done = order.status === "ENTREGUE";
  const driver = !isMesa && !isPickup ? store.drivers.find((d) => d.id === order.driverId) : null;

  const isPixOrder = order.payment === "PIX" || (typeof order.payment === "string" && order.payment.toUpperCase().includes("PIX"));
  const currentPixCode = order.pixCode || pixInfo?.pixCode;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  const handleCopyPix = () => {
    if (!currentPixCode) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(currentPixCode).then(
        () => {
          setCopied(true);
          store.toast("✓ Código Pix copiado! Cole no seu banco");
          beep(880, 0.12);
          setTimeout(() => setCopied(false), 3500);
        },
        () => {
          setCopied(true);
          store.toast("Código selecionado abaixo");
          setShowRaw(true);
        }
      );
    } else {
      setCopied(true);
      setShowRaw(true);
    }
  };

  const handleSendReceipt = () => {
    const phone = (store.settings.whatsapp || "81999990000").replace(/\D/g, "");
    const text = encodeURIComponent(`Olá Tô no Sarro! Fiz o pagamento Pix do pedido #${order.code} no valor de ${brl(order.total)}.\nSegue comprovante!`);
    window.open(`https://wa.me/55${phone}?text=${text}`, "_blank");
  };

  return (
    <div className="px-3 sm:px-4 py-5 pb-6 max-w-[720px] mx-auto w-full overflow-x-hidden">
      <div className="rounded-2xl p-5 mb-4" style={{ background: isMesa ? `linear-gradient(130deg, #10b981, #059669)` : isPickup ? `linear-gradient(130deg, #3b82f6, #1d4ed8)` : `linear-gradient(130deg, ${C.orange}, ${C.yellow})`, color: isMesa || isPickup ? C.white : C.black }}>
        <div className="flex items-center justify-between">
          <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.85 }}>Pedido #{order.code} · {mod.badge}</div>
          <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(0,0,0,.18)", color: isMesa || isPickup ? C.white : C.black }}>{mod.icon} {isMesa ? "SALÃO" : isPickup ? "BALCÃO" : "DELIVERY"}</span>
        </div>
        <div style={{ fontFamily: font.display, fontStyle: "italic", fontSize: "clamp(22px, 6vw, 26px)", lineHeight: 1.02, marginTop: 6 }}>
          {done ? isMesa ? "CONTA FECHADA! 🔥" : "SEU SARRO CHEGOU! 🔥" : isMesa ? `COMANDA ${mod.badge} ATIVA` : isPickup ? "SEU SARRO TÁ SAINDO!" : "SEU SARRO ESTÁ A CAMINHO!"}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 8, opacity: 0.9 }}>
          {done ? isMesa ? "Obrigado pela visita. Volte sempre!" : "Bom apetite. Volta sempre!" : isMesa ? "Seu pedido está sendo preparado no salão" : isPickup ? "Pronto para retirada em ~20 min" : "Previsão: 35–45 minutos"}
        </div>
      </div>

      {isMesa && (
        <Card className="p-4 mb-4" style={{ borderColor: "#10b98188", background: "linear-gradient(180deg, #064e3b33, #022c2233)" }}>
          <div className="flex items-start gap-3">
            <div className="rounded-xl flex items-center justify-center shrink-0" style={{ width: 44, height: 44, background: "#10b98122", border: "1px solid #10b98155", fontSize: 22 }}>🍽️</div>
            <div className="flex-1 min-w-0">
              <div style={{ color: "#10b981", fontWeight: 900, fontSize: 13 }}>NÃO EMBALAR · SERVIR NO SALÃO</div>
              <div style={{ color: C.white, fontWeight: 800, fontSize: 15, marginTop: 2 }}>{mod.badge} · Consumo no local</div>
              <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>Seu pedido será levado diretamente até sua mesa pelo garçom.</div>
            </div>
          </div>
        </Card>
      )}

      {order.paymentStatus === "pendente" && isPixOrder && !isMesa && (
        <Card className="p-4 mb-4" style={{ borderColor: `${C.orange}66` }}>
          <div className="text-center mb-3">
            <div style={{ fontWeight: 900, fontSize: 14, color: C.white }}>PAGAMENTO PIX PENDENTE</div>
            <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>Escaneie o QR Code ou copie o código</div>
            {pixInfo?.pixCode && (
              <div className="mt-3 flex justify-center">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixInfo.pixCode)}`} alt="QR Pix" width={180} height={180} />
              </div>
            )}
          </div>
          <button onClick={handleCopyPix} className="w-full py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2" style={{ background: copied ? "#22c55e" : `linear-gradient(135deg, ${C.orange}, ${C.yellow})`, color: "#000" }}>
            <span>{copied ? "✓" : "📋"}</span><span>{copied ? "COPIADO!" : "COPIAR CÓDIGO PIX"}</span>
          </button>
          {showRaw && <textarea readOnly value={currentPixCode} rows={3} className="w-full mt-2 bg-black text-xs p-2 rounded" style={{ color: "#cbd5e1" }} />}
          <div className="mt-3 pt-3 flex gap-2" style={{ borderTop: `1px solid ${C.gray850}` }}>
            <button onClick={handleSendReceipt} className="flex-1 py-2 px-3 rounded-lg text-xs font-bold" style={{ background: "#25D36622", color: "#25D366", border: "1px solid #25D36655" }}>Enviar comprovante</button>
          </div>
        </Card>
      )}

      {(order.paymentStatus === "pago" || justApproved) && (
        <Card className="p-4 mb-4" style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.16) 0%, rgba(16,185,129,0.08) 100%)", borderColor: "#22c55e" }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-2xl shrink-0" style={{ width: 44, height: 44, background: "#22c55e", color: "#000", fontSize: 22, fontWeight: 900 }}>✓</div>
            <div className="flex-1">
              <div style={{ color: "#22c55e", fontWeight: 900, fontSize: 15 }}>PAGAMENTO CONFIRMADO!</div>
              <div style={{ color: "#cbd5e1", fontSize: 12, marginTop: 2 }}>Recebemos {brl(order.total)} via {order.payment || "Pix"}. {isMesa ? "Sua comanda está ativa!" : "Seu pedido já está na chapa!"}</div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        {steps.map((s, i) => {
          const isDone = i <= pos || (s.key === "CONFIRMADO" && order.paymentStatus === "pago");
          const isNow = i === pos && !done;
          return (
            <div key={s.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center shrink-0" style={{ width: 30, height: 30, borderRadius: 99, fontSize: 13, background: isDone ? (isMesa ? "#10b981" : C.orange) : C.gray800, color: isDone ? (isMesa ? C.white : C.black) : "#6a6a6a" }}>{s.icon}</div>
                {i < steps.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 26, background: i < pos ? (isMesa ? "#10b981" : C.orange) : C.gray800 }} />}
              </div>
              <div className="pb-4">
                <div style={{ color: isDone ? C.white : "#6a6a6a", fontWeight: isNow ? 900 : 700, fontSize: 13.5 }}>{s.label}</div>
                {isNow && <div style={{ color: isMesa ? "#10b981" : C.yellowLight, fontSize: 11.5, marginTop: 2 }}>agora · {elapsed(order.createdAt, now)} desde o pedido</div>}
              </div>
            </div>
          );
        })}
      </Card>

      <Card className="p-4 mt-3">
        <div className="flex items-center justify-between mb-2">
          <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>Itens da comanda</div>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: isMesa ? "#10b98122" : C.gray850, color: isMesa ? "#10b981" : "#8a8a8a", border: `1px solid ${isMesa ? "#10b98144" : C.gray800}` }}>{order.items.length} itens</span>
        </div>
        {order.items.map((it) => (
          <div key={it.id} className="flex justify-between py-1" style={{ color: "#a5a5a5", fontSize: 12.5, borderBottom: `1px dashed ${C.gray850}` }}>
            <span>{it.qty}x {it.name}</span><span style={{ color: C.white, fontWeight: 700 }}>{brl(it.unit * it.qty)}</span>
          </div>
        ))}
        <div className="flex justify-between pt-3 mt-1" style={{ borderTop: `1px solid ${C.gray800}` }}>
          <span style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Total</span>
          <span style={{ color: isMesa ? "#10b981" : C.yellowLight, fontWeight: 900, fontSize: 16 }}>{brl(order.total)}</span>
        </div>
      </Card>
    </div>
  );
}

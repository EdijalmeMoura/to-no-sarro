
import React, { useState, useEffect, useRef } from "react";
import { C, font } from "../../constants/theme.js";
import { brl, elapsed } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { Card, Btn } from "../ui/index.jsx";


function WaIcon({ size = 22, color = "#fff", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

// Selo de sincronização dos painéis de pedido: mostra se o tempo real está
// ligado e há quanto tempo os dados foram atualizados. Toque = atualizar agora.
// Relógio de sincronização dos painéis de pedido: mostra há quanto tempo
// os dados foram carregados + botão para forçar a atualização na hora.

const TRACK_STEPS = [
  { key: "NOVO", label: "Pedido recebido", icon: "✓" },
  { key: "CONFIRMADO", label: "Pagamento confirmado", icon: "✓" },
  { key: "PREPARO", label: "Na chapa agora", icon: "🔥" },
  { key: "PRONTO", label: "Pedido pronto", icon: "🍔" },
  { key: "EMBALADO", label: "Embalado", icon: "📦" },
  { key: "ROTA", label: "Saiu para entrega", icon: "🛵" },
  { key: "ENTREGUE", label: "Entregue", icon: "✓" },
];


const TRACK_STEPS_MESA = [
  { key: "NOVO", label: "Comanda aberta", icon: "📝" },
  { key: "CONFIRMADO", label: "Enviado à cozinha", icon: "✓" },
  { key: "PREPARO", label: "Na chapa agora", icon: "🔥" },
  { key: "PRONTO", label: "Pronto no salão", icon: "🍽️" },
  { key: "ENTREGUE", label: "Entregue na mesa", icon: "✓" },
];


function TrackScreen({ order, store, now }) {
  // Atualização do próprio pedido: polling autenticado por token
  // (o canal público não carrega pedidos de outros clientes).
  useEffect(() => {
    if (!order) return;
    store.refreshMyOrder?.().catch(() => {});
    const t = setInterval(() => store.refreshMyOrder?.().catch(() => {}), 6000);
    return () => clearInterval(t);
  }, [order?.id]);
  // Enquanto o Pix/cartão não cai, o servidor consulta a InfinitePay a cada 6s
  useEffect(() => {
    if (order?.paymentStatus !== "pendente") return;
    const t = setInterval(() => store.checkPayment(order.id).catch(() => {}), 6000);
    return () => clearInterval(t);
  }, [order?.id, order?.paymentStatus]);

  if (!order) {
    return (
      <div className="px-4 py-16 text-center">
        <div style={{ fontSize: 52 }}>📦</div>
        <div style={{ color: C.white, fontFamily: font.display, fontStyle: "italic", fontSize: 20, marginTop: 10 }}>
          NENHUM PEDIDO ATIVO
        </div>
        <p style={{ color: "#8a8a8a", fontSize: 13, marginTop: 6 }}>Quando você pedir, o acompanhamento aparece aqui.</p>
        <div className="mt-5 flex justify-center"><Btn onClick={() => store.setTab("cardapio")}>Ver cardápio</Btn></div>
      </div>
    );
  }

  const idx = TRACK_STEPS.findIndex((s) => s.key === order.status);
  const pos = order.status === "AGUARDANDO" ? 4 : idx;
  const done = order.status === "ENTREGUE";
  const driver = store.drivers.find((d) => d.id === order.driverId);

  return (
    <div className="px-4 py-5 pb-6">
      <div
        className="rounded-2xl p-5 mb-4"
        style={{ background: `linear-gradient(130deg, ${C.orange}, ${C.yellow})`, color: C.black }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.75 }}>Pedido #{order.code}</div>
          <div style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 26, lineHeight: 1.02, marginTop: 4 }}>
            {done ? "SEU SARRO CHEGOU! 🔥" : order.type === "pickup" ? "SEU SARRO TÁ SAINDO!" : "SEU SARRO ESTÁ A CAMINHO!"}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 8 }}>
          {done ? "Bom apetite. Volta sempre!" : order.type === "pickup" ? "Pronto para retirada em ~20 min" : "Previsão: 35–45 minutos"}
        </div>
      </div>

      {order.paymentStatus === "pendente" && (
        <Card className="p-4 mb-3" style={{ borderColor: `${C.yellow}66`, background: `${C.yellow}12` }}>
          <div style={{ color: C.yellowLight, fontWeight: 900, fontSize: 14 }}>
            ⏳ Aguardando pagamento {order.payment === "Cartão online" ? "do cartão" : "Pix"}
          </div>
          <div style={{ color: "#c9c9c9", fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
            Assim que a InfinitePay confirmar ♾️, seu pedido entra na fila da cozinha automaticamente.
          </div>
          {order.payUrl && (
            <div className="mt-3">
              <Btn full onClick={() => window.open(order.payUrl, "_blank")}>
                PAGAR AGORA · {order.payment === "Cartão online" ? "CARTÃO ♾️" : "PIX ♾️"}
              </Btn>
            </div>
          )}
        </Card>
      )}

      <Card className="p-5">
        {TRACK_STEPS.map((s, i) => {
          const isDone = i <= pos;
          const isNow = i === pos && !done;
          return (
            <div key={s.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{
                    width: 30, height: 30, borderRadius: 99, fontSize: 13,
                    background: isDone ? C.orange : C.gray800,
                    color: isDone ? C.black : "#6a6a6a",
                    animation: isNow ? "sarropulse 1.4s ease-in-out infinite" : "none",
                  }}
                >
                  {s.icon}
                </div>
                {i < TRACK_STEPS.length - 1 && (
                  <div style={{ width: 2, flex: 1, minHeight: 26, background: i < pos ? C.orange : C.gray800 }} />
                )}
              </div>
              <div className="pb-4">
                <div style={{ color: isDone ? C.white : "#6a6a6a", fontWeight: isNow ? 900 : 700, fontSize: 13.5 }}>
                  {s.label}
                </div>
                {isNow && (
                  <div style={{ color: C.yellowLight, fontSize: 11.5, marginTop: 2 }}>
                    agora · {elapsed(order.createdAt, now)} desde o pedido
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {driver && !done && (
        <Card className="p-4 mt-3 flex items-center gap-3">
          <div className="flex items-center justify-center rounded-full" style={{ width: 44, height: 44, background: C.gray800, fontSize: 22 }}>🛵</div>
          <div className="flex-1">
            <div style={{ color: C.white, fontWeight: 800, fontSize: 13.5 }}>{driver.name}</div>
            <div style={{ color: "#8a8a8a", fontSize: 11.5 }}>{driver.vehicle} · {driver.phone}</div>
          </div>
        </Card>
      )}

      <Card className="p-4 mt-3">
        <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Itens</div>
        {order.items.map((i) => (
          <div key={i.id} className="flex justify-between" style={{ color: "#a5a5a5", fontSize: 12.5, marginBottom: 3 }}>
            <span>{i.qty}x {i.name}</span><span>{brl(i.unit * i.qty)}</span>
          </div>
        ))}
        <div className="flex justify-between pt-2 mt-2" style={{ borderTop: `1px solid ${C.gray800}` }}>
          <span style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Total</span>
          <span style={{ color: C.yellowLight, fontWeight: 900, fontSize: 16 }}>{brl(order.total)}</span>
        </div>
      </Card>

      <div className="mt-4 flex gap-2">
        <Btn variant="dark" full onClick={() => store.toast("Abrindo conversa no WhatsApp da loja")}>
          <span className="inline-flex items-center justify-center gap-1.5">
            <WaIcon size={14} color="#25D366" /> Falar com a loja
          </span>
        </Btn>
      </div>
    </div>
  );
}

export default TrackScreen;

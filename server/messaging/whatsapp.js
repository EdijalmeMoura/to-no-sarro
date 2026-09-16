// ============================================================
// TÔ NO SARRO — WhatsApp Cloud API (Meta)
//
// Envia mensagens transacionais de status do pedido. Mensagens
// iniciadas pelo negócio exigem TEMPLATES aprovados pela Meta:
// o módulo envia o template configurado (1 parâmetro de corpo com
// o texto renderizado) e, sem credenciais, guarda tudo na fila
// (outbox) para inspeção no admin.
// ============================================================

const GRAPH = "https://graph.facebook.com/v20.0";

export function waCredentials(settingsLike) {
  return {
    enabled: settingsLike.whatsapp_enabled === "1",
    phoneId: settingsLike.wa_phone_number_id || "",
    token: settingsLike.wa_access_token || "",
    verifyToken: settingsLike.wa_verify_token || "",
    template: settingsLike.wa_template || "tonosarro_status",
  };
}

// (81) 99999-9999 → 5581999999999. Devolve null se não der.
export function normalizePhone(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.length >= 12 && d.length <= 13 && d.startsWith("55")) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return null;
}

const itemsList = (order) =>
  order.items.map((i) => `${i.emoji || "🍔"} ${i.qty}x ${i.name}`).join("\n");

// Texto bonito de cada evento (usado como corpo da mensagem e na fila)
export function buildOrderMessage(event, order, extra = {}) {
  const head = "🔥 TÔ NO SARRO!";
  const code = `#${order.code}`;
  const items = itemsList(order);

  switch (event) {
    case "recebido":
      return `${head}\n\nPedido ${code} recebido! 🎉\n\n${items}\n\n💰 Total: ${brl_(order.total)}\n\n⏳ Aguardando confirmação do pagamento. Assim que cair, a chapa acende!`;
    case "pagamento_ok":
      return `${head}\n\n✅ Pagamento confirmado!\n\nPedido ${code} entrou na fila da cozinha.\n\n${items}\n\n💰 Total: ${brl_(order.total)}\n\nPrevisão: ${extra.eta || "35–45 min"} 🛵`;
    case "preparo":
      return `${head}\n\n🔥 SEU PEDIDO ESTÁ NA CHAPA!\n\nPedido ${code} em preparo agora. Capricho total saindo da cozinha!`;
    case "pronto":
      return order.type === "pickup"
        ? `${head}\n\n🔥 SEU PEDIDO ${code} ESTÁ PRONTO!\n\nPode vir buscar na loja: ${extra.address || "Janga, Paulista/PE"} 🏪`
        : `${head}\n\n🍔 Pedido ${code} pronto!\n\nJá está sendo finalizado para sair com o entregador.`;
    case "rota":
      return `${head}\n\n🛵 SAIU PARA ENTREGA!\n\nPedido ${code} com ${extra.driver || "nosso entregador"} a caminho.\n\n📍 ${order.customer?.addr || ""}\n\nPrevisão de chegada: 15–25 min 🏃`;
    case "entregue":
      return `${head}\n\n✅ ENTREGUE!\n\nPedido ${code} chegou. Bom apetite e obrigado por tô no sarro com a gente! 🔥`;
    case "teste":
      return `${head}\n\nMensagem de teste — se você leu isso, a integração funcionou! ✅`;
    default:
      return `${head}\n\nAtualização do pedido ${code}.`;
  }
}

function brl_(n) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Envio via Graph API com template de 1 parâmetro de corpo
export async function sendWhatsApp({ phoneId, token }, to, template, text) {
  const r = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: template,
        language: { code: "pt_BR" },
        components: [{ type: "body", parameters: [{ type: "text", text }] }],
      },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data; // { messaging_product, contacts, messages }
}

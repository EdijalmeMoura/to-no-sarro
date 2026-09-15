# Arquitetura — TÔ NO SARRO! Smart Food System

Este documento descreve como o protótipo vira produto. O protótipo em `src/App.jsx`
implementa a camada de experiência e o fluxo de estados; a arquitetura abaixo é o
que precisa existir por trás dela.

## Visão geral

```
                     ┌──────────────────────────────┐
  Cliente (PWA) ───► │                              │
  Admin / KDS   ───► │   API REST + WebSocket       │ ──► PostgreSQL
  Expedição     ───► │   (autenticação por JWT)     │ ──► Redis (fila + cache)
  Entregador    ───► │                              │
                     └───────┬──────────────────────┘
                             │
        ┌────────────────────┼─────────────────────┬──────────────────┐
        ▼                    ▼                     ▼                  ▼
   iFood API           99Food API          WhatsApp Cloud API    Gateway Pix
  (webhooks)           (webhooks)            (templates)        (Mercado Pago…)
```

## Princípios

1. **Canal é só metadado.** Pedido do cardápio próprio, do WhatsApp, do iFood ou do
   99Food entra na mesma tabela `orders`, com `channel` diferente, e percorre o mesmo
   fluxo de status. Nenhum painel tem lógica específica de canal.
2. **Segredo nenhum no frontend.** Tokens de iFood, 99Food, WhatsApp e gateway vivem
   em variáveis de ambiente do servidor (`.env.example`). O admin edita referências,
   nunca recebe o valor de volta.
3. **Gateway de pagamento desacoplado.** Uma interface `PaymentProvider`
   (`createCharge`, `getCharge`, `handleWebhook`) com uma implementação por provedor.
   Trocar Mercado Pago por Asaas é mudar `PAYMENT_PROVIDER` no ambiente.
4. **Estado do pedido é uma máquina de estados.** Transições válidas são validadas no
   servidor e registradas em `order_status_history`, nunca só no cliente.

## Fluxo de status

```
novo → confirmado → preparo → pronto → embalado → aguardando → rota → entregue
                                  └──────────── cancelado (a qualquer momento) ───┘
```

Para retirada na loja, o fluxo pula `aguardando` e `rota`: de `embalado` vai direto
para `entregue` quando o cliente retira.

Cada transição dispara, de forma assíncrona (fila):
- evento WebSocket para os painéis conectados;
- mensagem de WhatsApp quando o status tem template aprovado;
- impressão de comanda quando configurada;
- baixa de estoque na transição para `preparo`.

## API REST (principais rotas)

| Método | Rota | Quem usa |
|---|---|---|
| `GET` | `/api/menu` | cardápio público (categorias, produtos, grupos de opções) |
| `POST` | `/api/orders` | cliente finaliza o checkout |
| `GET` | `/api/orders/:code/track` | acompanhamento público por código |
| `GET` | `/api/admin/orders` | central de pedidos (filtros por canal e status) |
| `PATCH` | `/api/admin/orders/:id/status` | admin, cozinha, expedição |
| `POST` | `/api/admin/orders/:id/assign` | expedição atribui entregador |
| `GET` | `/api/driver/deliveries` | app do entregador |
| `CRUD` | `/api/admin/products`, `/categories`, `/option-groups`, `/coupons`, `/promotions`, `/inventory`, `/users` | gestão |
| `GET` | `/api/admin/reports/:kind` | relatórios com exportação xlsx/csv/pdf |
| `POST` | `/api/webhooks/ifood` | eventos de pedido do iFood |
| `POST` | `/api/webhooks/99food` | eventos do 99Food |
| `POST` | `/api/webhooks/payment` | confirmação de pagamento |
| `POST` | `/api/webhooks/whatsapp` | mensagens recebidas |

## Tempo real

WebSocket com salas por perfil: `admin`, `kitchen`, `expedition`, `driver:{id}`,
`order:{code}`. Um evento `order.updated` carrega o pedido inteiro, e cada painel
decide o que mostrar. Fallback de polling a cada 10s quando o socket cai — a cozinha
não pode ficar cega.

## Integrações externas

**iFood.** Autenticação OAuth com `client_id`/`client_secret`, polling do endpoint de
eventos + webhook, e confirmação obrigatória de cada evento consumido. Pedido recebido
vira `orders` com `channel='ifood'` e `external_id`. Mudanças internas de status são
propagadas de volta quando a API permite.

**99Food.** Mesma estrutura (token, webhook assinado, sincronização). Enquanto as
credenciais não são liberadas, o módulo fica em `pendente` e nada quebra.

**WhatsApp.** Cloud API oficial com templates aprovados, um por transição de status.
Sem automação de navegador ou sessão não oficial — isso derruba o número.

## Segurança

- Senhas com argon2id; sessão em JWT curto + refresh token rotativo.
- Permissões por papel verificadas no servidor em toda rota (o menu escondido no
  frontend não é controle de acesso).
- Validação de entrada por schema (Zod) e queries parametrizadas.
- Rate limiting por IP e por telefone no checkout e no login.
- Webhooks com verificação de assinatura; payload cru salvo em `webhooks` para replay.
- `audit_logs` em toda alteração de preço, cupom, estoque, permissão e cancelamento.

## Do protótipo para produção

O protótipo guarda tudo em `useState`. A migração é substituir o objeto `store` em
`App.jsx` por hooks que falam com a API (`useOrders`, `useMenu`, `useCart`), mantendo
a mesma assinatura de métodos — `placeOrder`, `setStatus`, `advance`, `assignDriver`,
`updateProduct`, `moveStock`. Os componentes não precisam mudar.

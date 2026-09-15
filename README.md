# TÔ NO SARRO! — Smart Food System

Sistema de pedidos da hamburgueria **TÔ NO SARRO! Burgers & Açaí** (Janga, Paulista/PE):
cardápio digital, central de pedidos multicanal, painel da cozinha, expedição e app do
entregador — todos compartilhando o mesmo estado, em tempo real.

Este repositório contém o **protótipo funcional do frontend**. O fluxo completo roda de
ponta a ponta, com dados em memória. A arquitetura de backend, o esquema do banco e o
plano de integrações estão em [`docs/`](./docs).

## Rodando

```bash
npm install
npm run dev
```

Abra o endereço que o Vite imprimir. A barra “Ver como” no topo troca entre os cinco
perfis do sistema.

## O que já funciona

**Cliente**
- Home com hero da marca, status da loja, mais pedidos, ofertas e novidades
- Cardápio com 8 categorias, menu sticky, scroll suave e busca inteligente
  (“burger com bacon”, “combo barato”, “açaí”)
- Modal de produto com ponto da carne, queijo, molhos, adicionais, remoção de
  ingredientes, observação e preço atualizando em tempo real
- **Monte seu Sarro**: pão, carne, queijo e molho com preço recalculado a cada escolha
- Carrinho com quantidades, observações, cupons (`SARRO10`, `BEMVINDO`, `BURGER20`,
  `FRETEGRATIS`) e upsell
- Checkout em 5 etapas: identificação, delivery ou retirada, endereço, pagamento
  (Pix, cartão, dinheiro com troco) e confirmação
- Acompanhamento com timeline animada, dados do entregador e confetes na confirmação
- Conta com histórico e Clube do Sarro (1 ponto a cada R$ 10; 100 pontos = 1 burger)

**Admin**
- Painel “Operação agora” com as filas de cada etapa
- KPIs, vendas por hora, vendas na semana, pedidos por canal, produtos mais vendidos
- Central de pedidos unificada em Kanban de 9 colunas ou lista, com filtro por canal
- Cardápio com edição de preço e liga/desliga de disponibilidade
- Clientes com classificação (novo, recorrente, VIP, inativo), cupons, promoções
  programadas, estoque com alerta de mínimo, integrações e configurações

**Cozinha (KDS)**
- Cards grandes em modo escuro, cronômetro por pedido, alerta sonoro na entrada
- Pedido passa de amarelo para vermelho conforme o tempo estoura
- Observações do cliente em destaque

**Expedição**
- Fila de prontos, embalar, chamar e atribuir entregador, retirada no balcão

**Entregador**
- Mobile-first: aceitar entrega, cheguei no local, entregue, problema

Mudança em qualquer painel aparece nos outros na hora — é o mesmo estado compartilhado,
simulando o WebSocket descrito na arquitetura.

## Simulando os canais externos

Em **Admin → Integrações** há botões que injetam pedidos do iFood e do 99Food na fila,
para ver o fluxo multicanal funcionando. O pedido entra com o canal marcado e segue o
mesmo caminho dos pedidos próprios.

## Identidade visual

| | |
|---|---|
| Preto | `#050505` |
| Cinza escuro | `#151515` |
| Cinza | `#252525` |
| Laranja | `#F58200` |
| Amarelo | `#FFB000` |
| Amarelo claro | `#FFC928` |
| Branco | `#FFFFFF` |

Tipografia: Archivo Black itálico nos títulos (o peso da logo), Inter no corpo.
A logo original está em `public/assets/logo-to-no-sarro.jpeg`.

## Estrutura

```
src/App.jsx        protótipo completo (dados, componentes e os cinco painéis)
src/main.jsx       entrada React + registro do service worker
public/sw.js       service worker do PWA
public/manifest.webmanifest
docs/ARQUITETURA.md
docs/schema.sql    esquema PostgreSQL completo
.env.example       variáveis do servidor (nenhuma vai para o frontend)
```

## Próximos passos

1. Backend com a API de `docs/ARQUITETURA.md` e o banco de `docs/schema.sql`
2. Substituir o objeto `store` por hooks que falam com a API (a assinatura dos
   métodos já é a mesma)
3. WebSocket para os painéis operacionais
4. iFood, 99Food, WhatsApp Cloud API e gateway de Pix
5. Fotos reais dos produtos no lugar dos ícones do protótipo

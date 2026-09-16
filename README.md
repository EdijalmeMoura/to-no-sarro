# TÔ NO SARRO! — Smart Food System

Sistema de pedidos da hamburgueria **TÔ NO SARRO! Burgers & Açaí** (Janga, Paulista/PE):
cardápio digital, central de pedidos multicanal, painel da cozinha, expedição e app do
entregador — com **backend real** (SQLite + API REST + WebSocket) e estado sincronizado
em tempo real entre todos os painéis.

## Rodando

```bash
npm install
npm run dev:all     # API (porta 3001) + Web (porta 5173) juntos
```

Abra o endereço que o Vite imprimir. A barra “SMART FOOD SYSTEM” no topo troca entre os
perfis do sistema; os painéis da equipe pedem login.

**Produção (um processo só):**

```bash
npm run build
npm start           # Express serve o dist/ + API + WebSocket na 3001
```

## Contas de demonstração

| Painel | Usuário | Senha |
|---|---|---|
| Admin | `admin` | `admin123` |
| Admin (gerente) | `gerente` | `gerente123` |
| Cozinha (KDS) | `cozinha` | `cozinha123` |
| Expedição | `expedicao` | `expedicao123` |
| Entregador (Rafael/Jonas/Bia) | `rafael` · `jonas` · `bia` | `entregador123` |

As senhas são semente de demonstração — o banco guarda apenas hash bcrypt. Troque em
`server/data.js` e rode `npm run seed` para regenerar.

## O que já funciona

**Cliente** (sem login)
- Home com hero da marca, fotos reais dos produtos, status da loja, mais pedidos, ofertas
- Cardápio com 8 categorias, menu sticky, busca inteligente (“burger com bacon”, “combo barato”)
- Modal de produto: ponto da carne, queijo, molhos, adicionais, remoção, observação e
  preço em tempo real
- **Monte seu Sarro**: pão, carne, queijo e molho com preço recalculado a cada escolha
- Carrinho persistente (localStorage), cupons validados na API (`SARRO10`, `BEMVINDO`,
  `BURGER20`, `FRETEGRATIS`) e upsell
- Checkout em 5 etapas: identificação, delivery ou retirada, endereço, pagamento
  (Pix, cartão, dinheiro com troco) e confirmação
- Acompanhamento com timeline animada, dados do entregador e confetes
- Conta com histórico e Clube do Sarro (1 ponto a cada R$ 10)

**Equipe** (com login e permissões por papel)
- **Admin:** operação agora, KPIs reais a partir dos pedidos, vendas por hora/semana,
  pedidos por canal, produtos mais vendidos, central em Kanban ou lista com filtro por
  canal, cardápio com edição de preço/disponibilidade (grava no banco), clientes com
  classificação automática, cupons, promoções, estoque com alerta, integrações e
  configurações (abrir/fechar a loja muda o cardápio na hora)
- **Cozinha (KDS):** cards grandes, cronômetro, alerta sonoro a cada pedido novo que
  chega pelo WebSocket, observações em destaque; cozinha só avança preparo/pronto
- **Expedição:** fila de prontos, embalar, atribuir entregador, retirada no balcão
- **Entregador:** mobile-first, cada um vê só as próprias entregas (validado no servidor)

**Integridade**
- Preços, cupons, taxa e total são **recalculados no servidor** — o cliente não manda valor
- Adicionais só são aceitos se pertencerem aos grupos do produto (anti-tampering)
- Sessão em cookie httpOnly, senhas bcrypt, rate limit no login, log de auditoria
- Toda mutação dispara um broadcast WebSocket; os cinco painéis atualizam sozinhos

## Simulando os canais externos

Em **Admin → Integrações** (ou no topo do admin) há botões que injetam pedidos do iFood e
do 99Food na fila via API — entram marcados com o canal e seguem o mesmo fluxo.

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
Logo oficial em `public/assets/`, fotos dos produtos em `public/img/products/`.

## Estrutura

```
src/App.jsx            frontend completo (dados vêm da API; UI dos cinco painéis)
src/main.jsx           entrada React + registro do service worker
server/index.js        API REST + WebSocket + serving de produção
server/db.js           esquema SQLite, seed e leituras
server/auth.js         sessões (cookie httpOnly), bcrypt, permissões por papel
server/data.js         catálogo de semente (produtos, adicionais, cupons, equipe)
public/                logo, ícones PWA, fotos dos produtos, service worker
docs/ARQUITETURA.md    plano de backend, integrações e segurança
docs/schema.sql        esquema PostgreSQL de referência (SaaS)
.env.example           variáveis do servidor (nenhuma vai para o frontend)
```

O banco SQLite vive em `server/data/sarro.db` (fora do git). `npm run seed` recria do zero.

## Próximos passos

1. CRUD completo de produtos no admin (hoje: preço, promo, disponibilidade e estoque)
2. Pix real via gateway (arquitetura desacoplada já prevista em `docs/ARQUITETURA.md`)
3. WhatsApp Cloud API + webhooks iFood/99Food assinados (módulos prontos para credenciais)
4. Impressão de comandas (QZ Tray / escpos)
5. Geolocalização do entregador em rota

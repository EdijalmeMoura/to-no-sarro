// ============================================================
// TÔ NO SARRO — Dados de semente do catálogo
// Em produção, isto nasce do CRUD do admin; aqui povoa o SQLite
// na primeira execução.
// ============================================================

export const CATEGORIES = [
  { id: "burgers", label: "Burgers", icon: "🍔" },
  { id: "combos", label: "Combos", icon: "🍟" },
  { id: "especiais", label: "Especiais", icon: "🥓" },
  { id: "porcoes", label: "Porções", icon: "🍗" },
  { id: "bebidas", label: "Bebidas", icon: "🥤" },
  { id: "sobremesas", label: "Sobremesas", icon: "🍫" },
  { id: "acai", label: "Açaí", icon: "🥣" },
  { id: "promocoes", label: "Promoções", icon: "🔥" },
];

export const OPTION_GROUPS = [
  {
    id: "ponto", name: "Ponto da carne", min: 1, max: 1, required: 1,
    options: [
      { id: "malpassado", name: "Mal passado", price: 0 },
      { id: "aoponto", name: "Ao ponto", price: 0 },
      { id: "bempassado", name: "Bem passado", price: 0 },
    ],
  },
  {
    id: "queijo", name: "Escolha seu queijo", min: 1, max: 1, required: 1,
    options: [
      { id: "cheddar", name: "Cheddar", price: 0 },
      { id: "mussarela", name: "Mussarela", price: 0 },
      { id: "prato", name: "Prato", price: 0 },
      { id: "gorgonzola", name: "Gorgonzola", price: 3 },
    ],
  },
  {
    id: "molho", name: "Escolha seu molho", min: 1, max: 2, required: 1,
    options: [
      { id: "especial", name: "Molho especial da casa", price: 0 },
      { id: "barbecue", name: "Barbecue", price: 0 },
      { id: "cheddar_m", name: "Cheddar cremoso", price: 2 },
      { id: "picante", name: "Picante do Sarro", price: 2 },
    ],
  },
  {
    id: "adicionais", name: "Turbine seu burger", min: 0, max: 6, required: 0,
    options: [
      { id: "add_cheddar", name: "Cheddar extra", price: 4 },
      { id: "add_bacon", name: "Bacon crocante", price: 5 },
      { id: "add_carne", name: "Carne extra 180g", price: 9 },
      { id: "add_molho", name: "Molho especial extra", price: 2 },
      { id: "add_cebola", name: "Cebola caramelizada", price: 3 },
      { id: "add_ovo", name: "Ovo frito", price: 3 },
    ],
  },
  {
    id: "remover", name: "Retirar ingredientes", min: 0, max: 6, required: 0,
    options: [
      { id: "rm_cebola", name: "Sem cebola", price: 0 },
      { id: "rm_alface", name: "Sem alface", price: 0 },
      { id: "rm_tomate", name: "Sem tomate", price: 0 },
      { id: "rm_picles", name: "Sem picles", price: 0 },
    ],
  },
  {
    id: "acaiTop", name: "Acompanhamentos do açaí", min: 0, max: 5, required: 0,
    options: [
      { id: "granola", name: "Granola", price: 2 },
      { id: "leiteninho", name: "Leite ninho", price: 3 },
      { id: "banana", name: "Banana", price: 2 },
      { id: "morango", name: "Morango", price: 4 },
      { id: "nutella", name: "Nutella", price: 6 },
    ],
  },
  {
    id: "refri", name: "Escolha a bebida do combo", min: 1, max: 1, required: 1,
    options: [
      { id: "coca", name: "Coca-Cola lata", price: 0 },
      { id: "guarana", name: "Guaraná lata", price: 0 },
      { id: "suco", name: "Suco natural 300ml", price: 3 },
    ],
  },
];

export const BUILDER = [
  {
    id: "pao", label: "Escolha o pão",
    options: [
      { id: "brioche", name: "Brioche", price: 0 },
      { id: "australiano", name: "Australiano", price: 3 },
      { id: "batata", name: "Pão de batata", price: 2 },
      { id: "integral", name: "Integral", price: 2 },
    ],
  },
  {
    id: "carne", label: "Escolha a carne",
    options: [
      { id: "blend180", name: "Blend bovino 180g", price: 0 },
      { id: "smash2", name: "Duplo smash 90g", price: 2 },
      { id: "costela", name: "Costela desfiada", price: 6 },
      { id: "frango_emp", name: "Frango empanado", price: 3 },
      { id: "veg", name: "Burger de grão-de-bico", price: 4 },
    ],
  },
  {
    id: "queijoB", label: "Escolha o queijo",
    options: [
      { id: "cheddarB", name: "Cheddar", price: 0 },
      { id: "mussarelaB", name: "Mussarela", price: 0 },
      { id: "gorgonzolaB", name: "Gorgonzola", price: 3 },
      { id: "semqueijo", name: "Sem queijo", price: -2 },
    ],
  },
  {
    id: "molhoB", label: "Escolha o molho",
    options: [
      { id: "especialB", name: "Especial da casa", price: 0 },
      { id: "barbecueB", name: "Barbecue", price: 0 },
      { id: "picanteB", name: "Picante", price: 2 },
    ],
  },
];

export const PRODUCTS = [
  {
    id: "p1", name: "Tô no Sarro Salada Burger", cat: "burgers", emoji: "🍔",
    desc: "100g de carne no pão brioche com salada fresca e o molho especial da casa.",
    ingredients: ["Pão brioche", "Carne 100g", "Alface", "Tomate", "Cebola roxa", "Molho especial"],
    price: 16, promo: null, time: 18, badges: ["maisvendido"], available: 1,
    groups: ["ponto", "queijo", "molho", "adicionais", "remover"], stock: 40, builder: 0,
  },
  {
    id: "p2", name: "Sarro Massa Bacon Burger", cat: "burgers", emoji: "🥓",
    desc: "100g de carne, bacon crocante e creme cheddar no pão brioche.",
    ingredients: ["Pão brioche", "Carne 100g", "Bacon crocante", "Creme cheddar", "Molho especial"],
    price: 20, promo: null, time: 20, badges: ["maisvendido"], available: 1,
    groups: ["ponto", "molho", "adicionais", "remover"], stock: 28, builder: 0,
  },
  {
    id: "p3", name: "Sarro Peso Calabresa Burger", cat: "burgers", emoji: "🍔",
    desc: "100g de carne com calabresa e creme cheddar no pão brioche.",
    ingredients: ["Pão brioche", "Carne 100g", "Calabresa", "Creme cheddar", "Molho especial"],
    price: 25, promo: null, time: 24, badges: [], available: 1,
    groups: ["ponto", "queijo", "molho", "adicionais", "remover"], stock: 15, builder: 0,
  },
  {
    id: "p4", name: "Sarro Desmantelo Cheddar Burger", cat: "burgers", emoji: "🍔",
    desc: "100g de carne com desmantelo de creme cheddar no pão brioche.",
    ingredients: ["Pão brioche", "Carne 100g", "Desmantelo de creme cheddar", "Molho especial"],
    price: 20, promo: null, time: 15, badges: [], available: 1,
    groups: ["queijo", "molho", "adicionais", "remover"], stock: 33, builder: 0,
  },
  {
    id: "p5", name: "Sarro Arretado Burger", cat: "burgers", emoji: "🍔",
    desc: "100g de carne com queijo coalho grelhado no pão brioche. Arretado de bom!",
    ingredients: ["Pão brioche", "Carne 100g", "Queijo coalho grelhado", "Molho especial"],
    price: 23.9, promo: null, time: 20, badges: ["novidade"], available: 1,
    groups: ["queijo", "molho", "adicionais", "remover"], stock: 22, builder: 0,
  },
  {
    id: "p6", name: "Combo Dois Sarro Massa + 2 Refri", cat: "combos", emoji: "🍟",
    desc: "2x Sarro Massa Bacon + 2 refrigerantes lata. Pra dividir (ou não).",
    ingredients: ["2x Sarro Massa Bacon", "2 refrigerantes lata"],
    price: 49.99, promo: null, time: 25, badges: ["maisvendido"], available: 1,
    groups: ["ponto", "molho", "refri", "adicionais"], stock: 30, builder: 0,
  },
  {
    id: "p7", name: "Combo Casal", cat: "combos", emoji: "🍔",
    desc: "2 burgers, porção grande de batata e 2 bebidas.",
    ingredients: ["2x Sarro Burger", "Batata grande", "2 bebidas"],
    price: 89.9, promo: 79.9, time: 30, badges: ["promocao"], available: 1,
    groups: ["ponto", "molho", "adicionais"], stock: 12, builder: 0,
  },
  {
    id: "p8", name: "Batata Especial", cat: "porcoes", emoji: "🍟",
    desc: "Batata rústica com cheddar, bacon e cebolinha.",
    ingredients: ["Batata rústica 300g", "Cheddar cremoso", "Bacon", "Cebolinha"],
    price: 24.9, promo: null, time: 14, badges: ["maisvendido"], available: 1,
    groups: ["adicionais"], stock: 45, builder: 0,
  },
  {
    id: "p9", name: "Onion Rings", cat: "porcoes", emoji: "🧅",
    desc: "8 anéis de cebola empanados com molho barbecue.",
    ingredients: ["Cebola empanada", "Molho barbecue"],
    price: 19.9, promo: null, time: 12, badges: [], available: 1, groups: [], stock: 20, builder: 0,
  },
  {
    id: "p10", name: "Coca-Cola 350ml", cat: "bebidas", emoji: "🥤",
    desc: "Lata gelada.", ingredients: ["Refrigerante 350ml"],
    price: 7, promo: null, time: 2, badges: [], available: 1, groups: [], stock: 120, builder: 0,
  },
  {
    id: "p11", name: "Suco natural 500ml", cat: "bebidas", emoji: "🍹",
    desc: "Laranja, maracujá ou abacaxi com hortelã.", ingredients: ["Fruta natural", "Gelo"],
    price: 12, promo: null, time: 6, badges: [], available: 1, groups: [], stock: 40, builder: 0,
  },
  {
    id: "p12", name: "Açaí Sarro 500ml", cat: "acai", emoji: "🥣",
    desc: "Açaí cremoso batido na hora com os acompanhamentos que você escolher.",
    ingredients: ["Açaí 500ml", "Acompanhamentos à escolha"],
    price: 24.9, promo: null, time: 10, badges: ["maisvendido"], available: 1,
    groups: ["acaiTop"], stock: 35, builder: 0,
  },
  {
    id: "p13", name: "Açaí Turbinado 700ml", cat: "acai", emoji: "🍨",
    desc: "Porção grande com quatro acompanhamentos inclusos.",
    ingredients: ["Açaí 700ml", "4 acompanhamentos"],
    price: 32.9, promo: 28.9, time: 12, badges: ["promocao"], available: 1,
    groups: ["acaiTop"], stock: 18, builder: 0,
  },
  {
    id: "p14", name: "Brownie com sorvete", cat: "sobremesas", emoji: "🍫",
    desc: "Brownie quente com bola de creme e calda quente.",
    ingredients: ["Brownie", "Sorvete de creme", "Calda de chocolate"],
    price: 18.9, promo: null, time: 8, badges: ["novidade"], available: 1, groups: [], stock: 14, builder: 0,
  },
  {
    id: "p15", name: "Milkshake 400ml", cat: "sobremesas", emoji: "🥤",
    desc: "Chocolate, morango ou ovomaltine.", ingredients: ["Sorvete", "Leite", "Cobertura"],
    price: 21.9, promo: null, time: 8, badges: [], available: 1, groups: [], stock: 25, builder: 0,
  },
  {
    id: "p16", name: "Monte seu Sarro", cat: "especiais", emoji: "🛠️",
    desc: "Você escolhe pão, carne, queijo e o resto. Preço calculado na hora.",
    ingredients: ["Você decide"], price: 26.9, promo: null, time: 22,
    badges: ["novidade"], available: 1, groups: [], stock: 99, builder: 1,
  },
];

export const COUPONS = [
  { code: "SARRO10", type: "percent", value: 10, min: 40, uses: 132, max_uses: 500, active: 1, note: "10% em qualquer pedido acima de R$ 40" },
  { code: "BEMVINDO", type: "percent", value: 15, min: 0, uses: 48, max_uses: 1000, active: 1, note: "Primeira compra" },
  { code: "BURGER20", type: "fixed", value: 20, min: 90, uses: 17, max_uses: 100, active: 1, note: "R$ 20 off acima de R$ 90" },
  { code: "FRETEGRATIS", type: "freeship", value: 0, min: 60, uses: 71, max_uses: 300, active: 1, note: "Entrega grátis acima de R$ 60" },
];

export const DRIVERS = [
  { id: "d1", name: "Rafael Lima", phone: "(81) 98812-0011", vehicle: "Moto CG 160", status: "livre", deliveries: 8 },
  { id: "d2", name: "Jonas Pereira", phone: "(81) 99640-2233", vehicle: "Moto Biz", status: "em rota", deliveries: 11 },
  { id: "d3", name: "Bia Santos", phone: "(81) 99177-8890", vehicle: "Moto Fan 150", status: "livre", deliveries: 6 },
];

export const CUSTOMERS = [
  { id: "c1", name: "João Silva", phone: "(81) 99123-4567", orders: 14, spent: 742.3, last: "Hoje", tier: "VIP", addr: "Rua das Palmeiras, 220 — Janga, Paulista/PE", points: 74 },
  { id: "c2", name: "Marina Costa", phone: "(81) 98877-1020", orders: 6, spent: 289.4, last: "Ontem", tier: "Recorrente", addr: "Av. Cláudio J. Gueiros, 1500 — Maria Farinha", points: 28 },
  { id: "c3", name: "Pedro Henrique", phone: "(81) 99555-3311", orders: 1, spent: 49.9, last: "Há 3 dias", tier: "Novo", addr: "Rua do Sol, 45 — Pau Amarelo", points: 4 },
  { id: "c4", name: "Ana Beatriz", phone: "(81) 98220-7744", orders: 22, spent: 1310.8, last: "Há 2h", tier: "VIP", addr: "Rua Boa Viagem, 88 — Casa Caiada, Olinda", points: 131 },
  { id: "c5", name: "Carlos Mendes", phone: "(81) 99801-4455", orders: 3, spent: 152.7, last: "Há 46 dias", tier: "Inativo", addr: "Rua Nova, 12 — Rio Doce", points: 15 },
];

export const INVENTORY = [
  { id: "i1", name: "Blend bovino 180g", unit: "un", qty: 86, min: 40 },
  { id: "i2", name: "Pão brioche", unit: "un", qty: 62, min: 50 },
  { id: "i3", name: "Queijo cheddar", unit: "fatia", qty: 210, min: 80 },
  { id: "i4", name: "Bacon", unit: "kg", qty: 3.4, min: 4 },
  { id: "i5", name: "Alface", unit: "un", qty: 12, min: 6 },
  { id: "i6", name: "Tomate", unit: "kg", qty: 5.2, min: 3 },
  { id: "i7", name: "Molho especial", unit: "L", qty: 2.1, min: 3 },
  { id: "i8", name: "Batata congelada", unit: "kg", qty: 18, min: 10 },
  { id: "i9", name: "Refrigerante lata", unit: "un", qty: 94, min: 48 },
  { id: "i10", name: "Polpa de açaí", unit: "kg", qty: 7.5, min: 8 },
];

export const PROMOS = [
  { id: "pr1", name: "Happy Hour do Sarro", rule: "18h às 20h — 15% off em combos", active: 1, window: "18:00–20:00" },
  { id: "pr2", name: "Terça do Duplo", rule: "Duplo Sarro por R$ 37,90", active: 1, window: "Terças" },
  { id: "pr3", name: "Açaí da tarde", rule: "Açaí 500ml por R$ 19,90", active: 0, window: "14:00–17:00" },
];

// Usuários do staff. As senhas em texto plano abaixo são apenas a semente —
// o banco guarda somente o hash bcrypt.
export const USERS = [
  { id: "u1", name: "Edi (Administrador)", username: "admin", password: "admin123", role: "ADMIN", driver_id: null },
  { id: "u2", name: "Gerente", username: "gerente", password: "gerente123", role: "GERENTE", driver_id: null },
  { id: "u3", name: "Cozinha", username: "cozinha", password: "cozinha123", role: "COZINHA", driver_id: null },
  { id: "u4", name: "Expedição", username: "expedicao", password: "expedicao123", role: "EXPEDICAO", driver_id: null },
  { id: "u5", name: "Rafael Lima", username: "rafael", password: "entregador123", role: "ENTREGADOR", driver_id: "d1" },
  { id: "u6", name: "Jonas Pereira", username: "jonas", password: "entregador123", role: "ENTREGADOR", driver_id: "d2" },
  { id: "u7", name: "Bia Santos", username: "bia", password: "entregador123", role: "ENTREGADOR", driver_id: "d3" },
];

export const SETTINGS = {
  store_name: "TÔ NO SARRO! Burgers & Açaí",
  open: 1,
  fee: 7.9,
  min_order: 25,
  eta: "35–45 min",
  whatsapp: "(81) 99999-0000",
  address: "Av. Cláudio José Gueiros Leite, 3200 — Janga, Paulista/PE",
  hours: "Ter a Dom · 18:00 – 23:30",
  seq: 1047,
  pay_handle: "",
  app_base_url: "https://to-no-sarro.onrender.com",
  whatsapp_enabled: 0,
  wa_phone_number_id: "",
  wa_access_token: "",
  wa_verify_token: "",
  wa_template: "tonosarro_status",
  ifood_enabled: 0,
  ifood_client_id: "",
  ifood_client_secret: "",
  ifood_merchant_id: "",
  printer_enabled: 0,
  printer_host: "",
  printer_port: "9100",
  printer_auto: 1,
};

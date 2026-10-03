export const delivery = {
  freeFrom: 250,
  pickupEta: "10–15 min",
  zones: [
    { id: "centro", name: "Centro", fee: 25, eta: "25–35 min" },
    { id: "itzimna", name: "Itzimná", fee: 35, eta: "30–40 min" },
    { id: "garcia-gineres", name: "García Ginerés", fee: 35, eta: "30–40 min" },
    { id: "montejo", name: "Montejo", fee: 45, eta: "35–45 min" },
    { id: "altabrisa", name: "Altabrisa", fee: 55, eta: "40–50 min" },
  ],
  times: ["Lo antes posible", "En 30 minutos", "En 1 hora", "En 2 horas"],
  payments: ["Efectivo", "Transferencia", "Terminal al entregar"],
} as const;

export const shopCategories = [
  { id: "cafe", label: "Café", illustration: "latte", blob: "text-rosa" },
  { id: "frios", label: "Fríos", illustration: "latte", blob: "text-teal" },
  { id: "desayunos", label: "Desayunos", illustration: "pay", blob: "text-sun" },
  { id: "comida", label: "Comida", illustration: "panDulce", blob: "text-orange" },
  { id: "panaderia", label: "Panadería", illustration: "panDulce", blob: "text-henequen" },
  { id: "grano", label: "Café en grano", illustration: "coffeeBag", blob: "text-terracotta" },
  { id: "cafeteras", label: "Cafeteras", illustration: "moka", blob: "text-sage" },
  { id: "regalos", label: "Regalos", illustration: "coffeeBag", blob: "text-mustard" },
] as const;

export type ShopCategory = (typeof shopCategories)[number]["id"];
export const shopCategoryIds = shopCategories.map((c) => c.id) as [ShopCategory, ...ShopCategory[]];

export const shopFlags = [
  { id: "promo", label: "Promos" },
  { id: "compartir", label: "Para compartir" },
  { id: "rapido", label: "Listo en 10 min" },
  { id: "vegano", label: "Vegano" },
  { id: "nuevo", label: "Nuevos" },
] as const;

export type ShopFlag = (typeof shopFlags)[number]["id"];
export const shopFlagIds = shopFlags.map((f) => f.id) as [ShopFlag, ...ShopFlag[]];

export const shopSections = [
  { id: "domicilio", title: "Pide a domicilio", note: "" },
  { id: "casa", title: "Llévate a casa", note: "Envío en Mérida el mismo día · a todo México en 2–4 días" },
] as const;

export type ShopSection = (typeof shopSections)[number]["id"];
export const shopSectionIds = shopSections.map((s) => s.id) as [ShopSection, ...ShopSection[]];

export const shopColors = {
  teal: "bg-teal",
  rosa: "bg-rosa",
  sun: "bg-sun",
  henequen: "bg-henequen",
  mustard: "bg-mustard",
  sage: "bg-sage",
  terracotta: "bg-terracotta",
} as const;

export type ShopColor = keyof typeof shopColors;
export const shopColorIds = Object.keys(shopColors) as [ShopColor, ...ShopColor[]];

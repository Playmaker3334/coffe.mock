export const menuTabs = [
  { id: "calientes", listTitle: "Los clásicos", label: "Calientes", panel: "bg-roast", edge: "text-roast", tabText: "text-cream", heading: "text-cream", ornament: "text-amber" },
  { id: "frios", listTitle: "Más bebidas frías", label: "Fríos", panel: "bg-teal", edge: "text-teal", tabText: "text-ink", heading: "text-ink", ornament: "text-ink" },
  { id: "desayunos", listTitle: "Desayunos", label: "Desayunos", panel: "bg-sun-soft", edge: "text-sun-soft", tabText: "text-ink", heading: "text-ink", ornament: "text-roast" },
  { id: "comida", listTitle: "Para comer", label: "Comida", panel: "bg-terracotta", edge: "text-terracotta", tabText: "text-cream", heading: "text-cream", ornament: "text-sun" },
  { id: "panaderia", listTitle: "Pan del día", label: "Panadería", panel: "bg-mustard", edge: "text-mustard", tabText: "text-ink", heading: "text-ink", ornament: "text-ink" },
] as const;

export type MenuTabId = (typeof menuTabs)[number]["id"];
export const menuTabIds = menuTabs.map((tab) => tab.id) as [MenuTabId, ...MenuTabId[]];

export const menuTags = {
  leche: { label: "Leche", class: "bg-mustard text-ink" },
  vegano: { label: "Vegano", class: "bg-leaf text-cream" },
  nuez: { label: "Nuez", class: "bg-orange text-ink" },
  gluten: { label: "Gluten", class: "bg-sand text-ink" },
  picante: { label: "Picante", class: "bg-chili text-cream" },
  hoy: { label: "Horneado hoy", class: "bg-teal text-ink" },
} as const;

export type MenuTag = keyof typeof menuTags;
export const menuTagIds = Object.keys(menuTags) as [MenuTag, ...MenuTag[]];

export const menuNote = "Todos los precios incluyen IVA. Pregunta por nuestras opciones sin azúcar y leches vegetales.";

export const formatPrice = (value: number) => `$${value}`;

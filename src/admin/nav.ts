import type { ModuleId } from "./types";

export type NavId = ModuleId | "usuarios";

export const NAV: { group: string; items: { id: NavId; label: string; href: string }[] }[] = [
  {
    group: "Operación",
    items: [
      { id: "caja", label: "Caja", href: "/admin/caja" },
      { id: "barra", label: "Barra", href: "/admin/barra" },
      { id: "corte", label: "Corte de caja", href: "/admin/corte" },
      { id: "cierre", label: "Cierre del día", href: "/admin/cierre" },
    ],
  },
  {
    group: "Catálogo",
    items: [
      { id: "productos", label: "Productos", href: "/admin/productos" },
      { id: "inventario", label: "Insumos y recetas", href: "/admin/inventario" },
      { id: "promociones", label: "Combos", href: "/admin/combos" },
    ],
  },
  {
    group: "Clientes",
    items: [
      { id: "clientes", label: "Clientes", href: "/admin/clientes" },
      { id: "credito", label: "Crédito", href: "/admin/credito" },
      { id: "cupones", label: "Cupones", href: "/admin/cupones" },
      { id: "ventas", label: "Ventas", href: "/admin/ventas" },
    ],
  },
  {
    group: "Sistema",
    items: [
      { id: "ajustes", label: "Ajustes", href: "/admin/ajustes" },
      { id: "usuarios", label: "Usuarios", href: "/admin/usuarios" },
    ],
  },
];

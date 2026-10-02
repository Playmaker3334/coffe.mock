export const site = {
  name: "Cafetería",
  tagline: "Mérida",
  lang: "es-MX",
  description: "Café de especialidad tostado en Mérida, Yucatán.",
  cartCount: 0,
  hero: {
    alt: "Fachada de la cafetería con terraza al frente",
  },
  nav: {
    primary: [
      { label: "Tienda en línea", href: "/productos" },
      { label: "Dónde encontrarnos", href: "/sucursales" },
      { label: "Menú", href: "/menu" },
      { label: "Nosotros", href: "/nosotros" },
    ],
  },
} as const;

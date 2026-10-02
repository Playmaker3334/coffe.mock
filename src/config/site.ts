export const site = {
  name: "Cafetería",
  tagline: "Mérida",
  lang: "es-MX",
  description: "Café de especialidad tostado en Mérida, Yucatán.",
  cartCount: 0,
  timeZone: "America/Merida",
  hero: {
    alt: "Fachada de la cafetería con terraza al frente",
  },
  contact: {
    address: ["Calle 60 #000, Centro", "Mérida, Yucatán"],
    phone: "999 000 0000",
    phoneHref: "tel:+529990000000",
    email: "hola@ejemplo.mx",
    whatsapp: "https://wa.me/520000000000",
    coords: { lat: 20.969, lng: -89.6229 },
  },
  hours: [
    { days: "Lunes a viernes", time: "7:00 – 21:00", weekdays: [1, 2, 3, 4, 5] },
    { days: "Sábado", time: "8:00 – 22:00", weekdays: [6] },
    { days: "Domingo", time: "8:00 – 14:00", weekdays: [0] },
  ],
  social: [
    { name: "Instagram", href: "https://www.instagram.com/", icon: "instagram" },
    { name: "Facebook", href: "https://www.facebook.com/", icon: "facebook" },
    { name: "TikTok", href: "https://www.tiktok.com/", icon: "tiktok" },
  ],
  footer: {
    about: "Café de especialidad, cocina de casa y pan del día en el centro de Mérida.",
    legal: [
      { label: "Aviso de privacidad", href: "/aviso-de-privacidad" },
      { label: "Términos y condiciones", href: "/terminos" },
    ],
  },
  nav: {
    primary: [
      { label: "Tienda en línea", href: "/productos" },
      { label: "Dónde encontrarnos", href: "/donde-encontrarnos" },
      { label: "Menú", href: "/menu" },
      { label: "Nosotros", href: "/nosotros" },
    ],
  },
} as const;

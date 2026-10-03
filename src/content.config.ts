import { defineCollection, reference } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";
import { iconNames } from "./components/ui/icons";
import { illustrationNames } from "./components/ui/illustrations";
import { menuTabIds, menuTagIds } from "./config/menu";
import { shopCategoryIds, shopColorIds, shopFlagIds, shopSectionIds } from "./config/tienda";

const destacados = defineCollection({
  loader: file("src/content/destacados.json"),
  schema: z.object({
    order: z.number(),
    kicker: z.string(),
    title: z.string(),
    text: z.string(),
    cta: z.string(),
    href: z.string(),
    color: z.enum(["roast", "henequen", "rosa", "orange"]),
    icon: z.enum(iconNames),
  }),
});

const masPedido = defineCollection({
  loader: file("src/content/mas-pedido.json"),
  schema: z.object({
    order: z.number(),
    category: z.string(),
    name: z.string(),
    text: z.string(),
    price: z.number(),
    illustration: z.enum(illustrationNames),
    color: z.enum(["sun", "rosa", "henequen"]),
  }),
});

const notas = defineCollection({
  loader: file("src/content/notas.json"),
  schema: z.object({
    order: z.number(),
    kicker: z.string(),
    title: z.string(),
    text: z.string(),
    cta: z.string(),
    href: z.string().optional(),
    whatsapp: z.boolean().default(false),
    tone: z.enum(["ink", "henequen"]),
    illustration: z.enum(illustrationNames),
    illustrationColor: z.enum(["henequen", "rosa", "orange"]),
  }),
});

const productores = defineCollection({
  loader: file("src/content/productores.json"),
  schema: z.object({
    order: z.number(),
    name: z.string(),
  }),
});

const menu = defineCollection({
  loader: file("src/content/menu.json"),
  schema: z.object({
    tab: z.enum(menuTabIds),
    section: z.string(),
    order: z.number(),
    name: z.string(),
    text: z.string(),
    price: z.number(),
    photo: z.string(),
    tags: z.array(z.enum(menuTagIds)).default([]),
  }),
});

const menuLista = defineCollection({
  loader: file("src/content/menu-lista.json"),
  schema: z.object({
    tab: z.enum(menuTabIds),
    order: z.number(),
    name: z.string(),
    price: z.number(),
    large: z.number().optional(),
  }),
});

const shopBase = {
  section: z.enum(shopSectionIds),
  category: z.enum(shopCategoryIds),
  order: z.number(),
  sub: z.string(),
  color: z.enum(shopColorIds),
  badge: z.string().optional(),
  prep: z.string().optional(),
  flags: z.array(z.enum(shopFlagIds)).default([]),
};

const tienda = defineCollection({
  loader: file("src/content/tienda.json"),
  schema: z.discriminatedUnion("source", [
    z.object({ ...shopBase, source: z.literal("menu"), item: reference("menu") }),
    z.object({
      ...shopBase,
      source: z.literal("propio"),
      name: z.string(),
      price: z.number(),
      oldPrice: z.number().optional(),
      photo: z.string().optional(),
      illustration: z.enum(illustrationNames).default("coffeeBag"),
      roast: z.string().optional(),
      notes: z.array(z.string()).default([]),
      footer: z.string().optional(),
    }),
  ]),
});

const secciones = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/secciones" }),
  schema: ({ image }) =>
    z.object({
      kicker: z.string(),
      title: z.string(),
      image: image().optional(),
      alt: z.string().optional(),
      caption: z.string().optional(),
      cta: z.string().optional(),
      href: z.string().optional(),
    }),
});

export const collections = { destacados, masPedido, menu, menuLista, notas, productores, secciones, tienda };

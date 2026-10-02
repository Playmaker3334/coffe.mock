import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";
import { iconNames } from "./components/ui/icons";
import { illustrationNames } from "./components/ui/illustrations";

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

export const collections = { destacados, masPedido, notas, secciones };

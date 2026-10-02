import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";
import { iconNames } from "./components/ui/icons";

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

const secciones = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/secciones" }),
  schema: ({ image }) =>
    z.object({
      kicker: z.string(),
      title: z.string(),
      image: image(),
      alt: z.string(),
    }),
});

export const collections = { destacados, secciones };

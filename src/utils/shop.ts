import type { ImageMetadata } from "astro";
import { getCollection, getEntry } from "astro:content";
import type { IllustrationName } from "../components/ui/illustrations";
import type { ShopCategory, ShopColor, ShopFlag, ShopSection } from "../config/tienda";
import { menuPhoto } from "./menuPhotos";

export interface Product {
  id: string;
  section: ShopSection;
  category: ShopCategory;
  order: number;
  sub: string;
  name: string;
  price: number;
  oldPrice?: number;
  photo?: ImageMetadata;
  illustration: IllustrationName;
  color: ShopColor;
  badge?: string;
  prep?: string;
  flags: ShopFlag[];
  roast?: string;
  notes: string[];
  footer?: string;
}

export async function getProducts(): Promise<Product[]> {
  const entries = await getCollection("tienda");

  const products = await Promise.all(
    entries.map(async ({ id, data }): Promise<Product> => {
      const base = {
        id,
        section: data.section,
        category: data.category,
        order: data.order,
        sub: data.sub,
        color: data.color,
        badge: data.badge,
        prep: data.prep,
        flags: data.flags,
      };

      if (data.source === "menu") {
        const item = await getEntry(data.item);
        if (!item) throw new Error(`tienda.json: "${id}" apunta a un producto del menú que no existe`);
        return {
          ...base,
          name: item.data.name,
          price: item.data.price,
          photo: menuPhoto(item.data.photo),
          illustration: "latte",
          notes: [],
        };
      }

      return {
        ...base,
        name: data.name,
        price: data.price,
        oldPrice: data.oldPrice,
        photo: data.photo ? menuPhoto(data.photo) : undefined,
        illustration: data.illustration,
        roast: data.roast,
        notes: data.notes,
        footer: data.footer,
      };
    }),
  );

  return products.sort((a, b) => a.order - b.order);
}

import type { ImageMetadata } from "astro";

const files = import.meta.glob<{ default: ImageMetadata }>("../assets/images/menu/*.{jpg,jpeg,png,webp}", { eager: true });

const photos = new Map(
  Object.entries(files).map(([path, mod]) => [path.split("/").pop() ?? path, mod.default]),
);

export function menuPhoto(name: string) {
  const photo = photos.get(name);
  if (!photo) throw new Error(`Falta la foto src/assets/images/menu/${name}`);
  return photo;
}

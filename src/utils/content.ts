import { getEntry, render } from "astro:content";

export async function loadSection(id: string) {
  const entry = await getEntry("secciones", id);
  if (!entry) throw new Error(`Falta src/content/secciones/${id}.md`);
  const { Content } = await render(entry);
  return { data: entry.data, Content };
}

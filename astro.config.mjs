// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://playmaker3334.github.io",
  base: "/coffe.mock",
  vite: {
    plugins: [tailwindcss()],
  },
});

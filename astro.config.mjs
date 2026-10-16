// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://playmaker3334.github.io",
  base: process.env.BASE_PATH ?? "/coffe.mock",
  vite: {
    plugins: [tailwindcss()],
  },
});

import type { MetadataRoute } from "next";

// Manifest do PWA: faz o iOS/Android abrir em tela cheia (standalone), sem
// mostrar barra de navegador.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Claude — Assistente do seu workspace",
    short_name: "Claude",
    description: "Assistente de IA do seu workspace",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

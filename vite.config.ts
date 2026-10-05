/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

const base = process.env.BASE_PATH ?? "/photo-bucket/";

/** Keeps the introduction page from being installable: only the app links the manifest. */
const landingWithoutManifest = (): Plugin => ({
  name: "landing-without-manifest",
  enforce: "post",
  transformIndexHtml: {
    order: "post",
    handler: (html, ctx) =>
      ctx.path === "/index.html" ? html.replace(/<link rel="manifest"[^>]*>/, "") : html,
  },
});

export default defineConfig({
  base,
  build: {
    rolldownOptions: {
      // "/" is the introduction page; the app (and the installed PWA) lives under "/app/".
      input: {
        landing: fileURLToPath(new URL("index.html", import.meta.url)),
        app: fileURLToPath(new URL("app/index.html", import.meta.url)),
      },
    },
  },
  plugins: [
    preact(),
    VitePWA({
      registerType: "prompt",
      strategies: "generateSW",
      injectRegister: false,
      includeAssets: ["icons/apple-touch-icon.png", "icons/icon.svg"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallback: "app/index.html",
        navigateFallbackAllowlist: [/\/app\//],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: "フォトバケットリスト",
        short_name: "フォトバケット",
        description: "やりたいことをマス目に書いて、達成したら写真を貼るバケットリスト",
        lang: "ja",
        display: "standalone",
        orientation: "portrait",
        // Kept at the old start_url so existing installs stay the same app.
        id: base,
        start_url: `${base}app/`,
        scope: `${base}app/`,
        theme_color: "#b4531f",
        background_color: "#fbf8f3",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
    landingWithoutManifest(),
  ],
  test: {
    environment: "happy-dom",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts?(x)", "tests/integration/**/*.test.ts?(x)"],
  },
});

/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

import { MARCA } from './src/config/marca'

/** Substitui %MARCA_NOME% e %MARCA_DESCRICAO% no index.html. */
function marcaNoHtml(): Plugin {
  return {
    name: 'financas:marca-no-html',
    transformIndexHtml(html) {
      return html
        .replaceAll('%MARCA_NOME%', MARCA.nome)
        .replaceAll('%MARCA_DESCRICAO%', MARCA.descricao)
        .replaceAll('%MARCA_FUNDO_CLARO%', MARCA.corFundoClaro)
        .replaceAll('%MARCA_FUNDO_ESCURO%', MARCA.corFundoEscuro)
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    marcaNoHtml(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icone.svg'],
      manifest: {
        id: '/',
        name: MARCA.nome,
        short_name: MARCA.nomeCurto,
        description: MARCA.descricao,
        lang: MARCA.idioma,
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: MARCA.corFundoClaro,
        theme_color: MARCA.corFundoClaro,
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // Instalável, sem modo offline nesta versão: o service worker não guarda
      // páginas nem dados em cache. Para ligar o offline no futuro, preencha
      // globPatterns/runtimeCaching e defina navigateFallback.
      workbox: {
        globPatterns: [],
        runtimeCaching: [],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Testes de datas não podem depender do fuso da máquina.
    env: { TZ: 'UTC' },
  },
})

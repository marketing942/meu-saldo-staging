import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Gera os ícones do PWA a partir de public/icone.svg: npm run gen:pwa-assets
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0.15,
      resizeOptions: { background: '#2E4A7A' },
    },
    apple: { ...minimal2023Preset.apple, padding: 0.15, resizeOptions: { background: '#2E4A7A' } },
  },
  images: ['public/icone.svg'],
})

import { defineConfig, devices } from '@playwright/test'

/**
 * Testes ponta a ponta. O app roda com o build de produção e um Supabase falso
 * em memória (e2e/supabase-falso.ts), sem rede nem banco de verdade.
 * Para usar um Chromium já instalado: PW_CHROMIUM_PATH=/caminho/do/chrome.
 */
const PORTA = 4174
const executavel = process.env.PW_CHROMIUM_PATH

export default defineConfig({
  testDir: './e2e',
  tsconfig: './e2e/tsconfig.json',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORTA}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'celular',
      use: {
        ...devices['Pixel 7'],
        ...(executavel ? { launchOptions: { executablePath: executavel } } : {}),
      },
    },
  ],
  webServer: {
    command: `vite build --outDir dist-e2e --emptyOutDir && vite preview --outDir dist-e2e --port ${PORTA} --strictPort`,
    url: `http://localhost:${PORTA}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      VITE_SUPABASE_URL: 'https://e2e-ficticio.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'chave-anon-ficticia-usada-so-nos-testes-e2e',
      VITE_APP_AMBIENTE: 'staging',
    },
  },
})

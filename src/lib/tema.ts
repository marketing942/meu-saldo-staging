export type Tema = 'sistema' | 'claro' | 'escuro'

/** Aplica a escolha manual de tema; 'sistema' segue o prefers-color-scheme. */
export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement
  if (tema === 'sistema') {
    delete raiz.dataset.tema
  } else {
    raiz.dataset.tema = tema
  }
}

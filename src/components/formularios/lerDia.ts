/** Dia do mês (1 a 31) digitado como texto; null se vazio ou inválido. */
export function lerDia(texto: string): number | null {
  const dia = Number(texto)
  return texto.trim() !== '' && Number.isInteger(dia) && dia >= 1 && dia <= 31 ? dia : null
}

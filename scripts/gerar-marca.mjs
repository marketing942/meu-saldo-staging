#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Gera, a partir dos arquivos oficiais da marca, as variantes para o tema escuro,
// os favicons e os ícones do PWA.
//
//   npm run gen:marca
//
// Entradas (PNG com fundo transparente, recortados rente ao desenho):
//   public/branding/logo-meu-saldo.png     logo completa (símbolo + "Meu Saldo")
//   public/branding/simbolo-meu-saldo.png  símbolo isolado
//
// Saídas:
//   public/branding/*-escuro.png           mesmas imagens com o preto em cor clara,
//                                          para o tema escuro
//   public/favicon.ico (16, 32 e 48 px), public/favicon-32x32.png, favicon-48x48.png
//   public/pwa-64x64.png, pwa-192x192.png, pwa-512x512.png (purpose "any")
//   public/maskable-icon-512x512.png       símbolo dentro da área segura do Android
//   public/apple-touch-icon-180x180.png    fundo opaco (o iOS pinta transparência de preto)
// -----------------------------------------------------------------------------
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url))
const BRANDING = `${PUBLIC}branding/`
const SIMBOLO = `${BRANDING}simbolo-meu-saldo.png`
const LOGO = `${BRANDING}logo-meu-saldo.png`

/** Fundo dos ícones: branco, como o fundo original da marca. */
const FUNDO = '#FFFFFF'
/** Cor que substitui o preto no tema escuro (= --texto do tema escuro). */
const PRETO_NO_ESCURO = [0xec, 0xee, 0xf1]

/** Troca o preto (tons neutros escuros) pela cor clara, mantendo a transparência. */
async function varianteEscura(entrada, saida) {
  const { data, info } = await sharp(entrada)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    const neutro = Math.max(r, g, b) - Math.min(r, g, b) < 16
    if (neutro && Math.max(r, g, b) < 100) {
      data[i] = PRETO_NO_ESCURO[0]
      data[i + 1] = PRETO_NO_ESCURO[1]
      data[i + 2] = PRETO_NO_ESCURO[2]
    }
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ palette: true, colors: 128, compressionLevel: 9, effort: 10 })
    .toFile(saida)
}

/**
 * Ícone quadrado com o símbolo centralizado.
 *   escala: maior lado do símbolo em relação ao ícone (o resto é respiro);
 *   canto:  raio dos cantos em relação ao ícone (0 = quadrado inteiro, opaco).
 */
async function icone(tamanho, { escala, canto }) {
  const lado = Math.round(tamanho * escala)
  const simbolo = await sharp(SIMBOLO)
    .resize(lado, lado, { fit: 'inside', kernel: 'lanczos3' })
    .toBuffer()
  const raio = Math.round(tamanho * canto)
  const fundo = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}">` +
      `<rect width="${tamanho}" height="${tamanho}" rx="${raio}" fill="${FUNDO}"/></svg>`,
  )
  const imagem = await sharp(fundo)
    .composite([{ input: simbolo, gravity: 'center' }])
    .png()
    .toBuffer()
  // Sem cantos, o ícone é opaco: sai sem canal de transparência.
  return (canto === 0 ? sharp(imagem).removeAlpha() : sharp(imagem))
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/** .ico com PNGs dentro (aceito por todos os navegadores atuais). */
function ico(pngs) {
  const cabecalho = Buffer.alloc(6 + 16 * pngs.length)
  cabecalho.writeUInt16LE(0, 0)
  cabecalho.writeUInt16LE(1, 2)
  cabecalho.writeUInt16LE(pngs.length, 4)
  let posicao = cabecalho.length
  pngs.forEach(({ tamanho, png }, i) => {
    const e = 6 + 16 * i
    cabecalho.writeUInt8(tamanho >= 256 ? 0 : tamanho, e)
    cabecalho.writeUInt8(tamanho >= 256 ? 0 : tamanho, e + 1)
    cabecalho.writeUInt8(0, e + 2)
    cabecalho.writeUInt8(0, e + 3)
    cabecalho.writeUInt16LE(1, e + 4)
    cabecalho.writeUInt16LE(32, e + 6)
    cabecalho.writeUInt32LE(png.length, e + 8)
    cabecalho.writeUInt32LE(posicao, e + 12)
    posicao += png.length
  })
  return Buffer.concat([cabecalho, ...pngs.map((p) => p.png)])
}

await varianteEscura(LOGO, `${BRANDING}logo-meu-saldo-escuro.png`)
await varianteEscura(SIMBOLO, `${BRANDING}simbolo-meu-saldo-escuro.png`)

// Favicons: cartão branco de cantos arredondados, para o símbolo aparecer também
// em abas escuras. Pouco respiro, porque em 16 px cada pixel conta.
const FAVICON = { escala: 0.78, canto: 0.2 }
const favicons = await Promise.all(
  [16, 32, 48].map(async (tamanho) => ({ tamanho, png: await icone(tamanho, FAVICON) })),
)
await writeFile(`${PUBLIC}favicon.ico`, ico(favicons))
for (const { tamanho, png } of favicons.filter((f) => f.tamanho !== 16)) {
  await writeFile(`${PUBLIC}favicon-${tamanho}x${tamanho}.png`, png)
}

// PWA "any": o mesmo cartão branco, com mais respiro.
for (const tamanho of [64, 192, 512]) {
  await writeFile(
    `${PUBLIC}pwa-${tamanho}x${tamanho}.png`,
    await icone(tamanho, { escala: 0.64, canto: 0.22 }),
  )
}

// Maskable: fundo inteiro e o símbolo dentro do círculo seguro (80% do ícone),
// para não ser cortado por nenhum formato de ícone do Android.
await writeFile(`${PUBLIC}maskable-icon-512x512.png`, await icone(512, { escala: 0.56, canto: 0 }))

// Apple: fundo inteiro e opaco; o iOS arredonda os cantos sozinho.
await writeFile(
  `${PUBLIC}apple-touch-icon-180x180.png`,
  await icone(180, { escala: 0.64, canto: 0 }),
)

console.log('Marca gerada em public/ e public/branding/.')

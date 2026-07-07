import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../public/icons/', import.meta.url)
const regularSvg = readFileSync(new URL('../favicon.svg', root))
const maskableSvg = readFileSync(new URL('source-maskable.svg', root))

async function render(svgBuffer, size, outName) {
  await sharp(svgBuffer, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(outName, root)))
  console.log(`✓ ${outName} (${size}x${size})`)
}

await render(regularSvg, 192, 'icon-192.png')
await render(regularSvg, 512, 'icon-512.png')
await render(maskableSvg, 512, 'icon-maskable-512.png')
await render(maskableSvg, 180, 'apple-touch-icon.png')

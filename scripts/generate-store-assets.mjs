/**
 * Generates placeholder transparent PNG Store assets for Microsoft Store submission.
 * Run once: node scripts/generate-store-assets.mjs
 * Replace with real branded assets before Store submission.
 */
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'resources', 'appx')

mkdirSync(outDir, { recursive: true })

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcInput = Buffer.concat([typeBytes, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([len, typeBytes, data, crc])
}

function createTransparentPNG(width, height) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR: width, height, bit depth=8, color type=6 (RGBA), compression=0, filter=0, interlace=0
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8   // bit depth
  ihdrData[9] = 6   // RGBA
  ihdrData[10] = 0  // deflate
  ihdrData[11] = 0  // adaptive filtering
  ihdrData[12] = 0  // no interlace

  // Raw scanlines: filter byte (0 = None) + RGBA pixels (all zero = transparent)
  const rowSize = 1 + width * 4
  const raw = Buffer.alloc(height * rowSize, 0)

  const compressed = deflateSync(raw)

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdrData),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ])
}

const assets = [
  { name: 'StoreLogo.png',          width: 50,  height: 50  },
  { name: 'Square44x44Logo.png',    width: 44,  height: 44  },
  { name: 'Square150x150Logo.png',  width: 150, height: 150 },
  { name: 'Wide310x150Logo.png',    width: 310, height: 150 },
]

for (const { name, width, height } of assets) {
  const png = createTransparentPNG(width, height)
  const dest = join(outDir, name)
  writeFileSync(dest, png)
  console.log(`Created ${name} (${width}×${height}) → ${dest}`)
}

console.log('\nDone. Replace these placeholders with real branded assets before Store submission.')

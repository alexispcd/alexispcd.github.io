import sharp from 'sharp'
import { readFileSync } from 'fs'

const svg = readFileSync('public/icons/cairn.svg')

await sharp(svg).resize(32, 32).png().toFile('public/favicon-32.png')
await sharp(svg).resize(16, 16).png().toFile('public/favicon-16.png')
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png')

console.log('✅ Favicons générées !')
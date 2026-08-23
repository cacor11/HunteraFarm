'use strict'

const path = require('node:path')
const sharp = require('sharp')

const repositoryRoot = path.resolve(__dirname, '..')
const logoPath = path.join(repositoryRoot, 'site', 'assets', 'hunterafarm-logo.png')
const outputPath = path.join(repositoryRoot, 'site', 'assets', 'og.png')

const background = Buffer.from(`
  <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#020906" />
        <stop offset="0.58" stop-color="#07150e" />
        <stop offset="1" stop-color="#10220f" />
      </linearGradient>
      <radialGradient id="glow" cx="0.8" cy="0.28" r="0.62">
        <stop offset="0" stop-color="#b8ff5b" stop-opacity="0.25" />
        <stop offset="0.5" stop-color="#60b92c" stop-opacity="0.07" />
        <stop offset="1" stop-color="#07100d" stop-opacity="0" />
      </radialGradient>
      <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="12" />
      </filter>
    </defs>

    <rect width="1200" height="630" fill="url(#bg)" />
    <rect width="1200" height="630" fill="url(#glow)" />
    <path d="M0 514H260l62-62h180M0 128h190l48-48h176M760 0v64l54 54" fill="none" stroke="#b8ff5b" stroke-opacity="0.14" stroke-width="1" />
    <g fill="#b8ff5b" opacity="0.12">
      <circle cx="1030" cy="42" r="3"/><circle cx="1050" cy="42" r="3"/><circle cx="1070" cy="42" r="3"/><circle cx="1090" cy="42" r="3"/>
      <circle cx="1030" cy="62" r="3"/><circle cx="1050" cy="62" r="3"/><circle cx="1070" cy="62" r="3"/><circle cx="1090" cy="62" r="3"/>
    </g>

    <text x="62" y="334" fill="#b8ff5b" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="800" letter-spacing="4">PLAYER PARA WINDOWS</text>
    <text x="62" y="403" fill="#f4f7ed" font-family="Segoe UI, Arial, sans-serif" font-size="66" font-weight="800" letter-spacing="-2">ATÉ <tspan fill="#b8ff5b">4 CONTAS</tspan></text>
    <text x="64" y="452" fill="#b6c4bb" font-family="Segoe UI, Arial, sans-serif" font-size="27" font-weight="500">Uma janela. Sessões separadas.</text>
    <rect x="62" y="493" width="122" height="35" rx="17" fill="#b8ff5b" />
    <text x="123" y="516" text-anchor="middle" fill="#07100d" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="900">VERSÃO 1.1</text>

    <rect x="625" y="92" width="518" height="466" rx="27" fill="#09130e" stroke="#cfff8e" stroke-opacity="0.55" stroke-width="2" />
    <rect x="625" y="92" width="518" height="65" rx="27" fill="#102219" />
    <path d="M625 132h518v25H625z" fill="#102219" />
    <circle cx="1094" cy="124" r="5" fill="#617269"/><circle cx="1115" cy="124" r="5" fill="#617269"/>
    <text x="657" y="132" fill="#ecf7ef" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800">HunteraFarm</text>

    <g font-family="Segoe UI, Arial, sans-serif">
      <g transform="translate(650 181)">
        <rect width="222" height="160" rx="16" fill="#101f17" stroke="#b8ff5b" stroke-opacity="0.38" />
        <rect x="17" y="17" width="43" height="43" rx="11" fill="#b8ff5b" />
        <text x="38.5" y="46" text-anchor="middle" fill="#07100d" font-size="18" font-weight="900">1</text>
        <text x="74" y="35" fill="#edf7f0" font-size="16" font-weight="800">CONTA 01</text>
        <text x="74" y="55" fill="#83d529" font-size="11" font-weight="700">EM USO</text>
        <rect x="17" y="82" width="188" height="12" rx="6" fill="#1d3526" />
        <rect x="17" y="107" width="142" height="9" rx="5" fill="#1b2f23" />
        <rect x="17" y="128" width="174" height="9" rx="5" fill="#17291f" />
      </g>
      <g transform="translate(891 181)">
        <rect width="222" height="160" rx="16" fill="#101f17" stroke="#8cb4ff" stroke-opacity="0.32" />
        <rect x="17" y="17" width="43" height="43" rx="11" fill="#8cb4ff" />
        <text x="38.5" y="46" text-anchor="middle" fill="#07100d" font-size="18" font-weight="900">2</text>
        <text x="74" y="35" fill="#edf7f0" font-size="16" font-weight="800">CONTA 02</text>
        <text x="74" y="55" fill="#8cb4ff" font-size="11" font-weight="700">PRONTA</text>
        <rect x="17" y="82" width="188" height="12" rx="6" fill="#1d3526" />
        <rect x="17" y="107" width="154" height="9" rx="5" fill="#1b2f23" />
        <rect x="17" y="128" width="131" height="9" rx="5" fill="#17291f" />
      </g>
      <g transform="translate(650 362)">
        <rect width="222" height="160" rx="16" fill="#101f17" stroke="#ffc669" stroke-opacity="0.32" />
        <rect x="17" y="17" width="43" height="43" rx="11" fill="#ffc669" />
        <text x="38.5" y="46" text-anchor="middle" fill="#07100d" font-size="18" font-weight="900">3</text>
        <text x="74" y="35" fill="#edf7f0" font-size="16" font-weight="800">CONTA 03</text>
        <text x="74" y="55" fill="#ffc669" font-size="11" font-weight="700">PRONTA</text>
        <rect x="17" y="82" width="188" height="12" rx="6" fill="#1d3526" />
        <rect x="17" y="107" width="123" height="9" rx="5" fill="#1b2f23" />
        <rect x="17" y="128" width="166" height="9" rx="5" fill="#17291f" />
      </g>
      <g transform="translate(891 362)">
        <rect width="222" height="160" rx="16" fill="#101f17" stroke="#cd9aff" stroke-opacity="0.32" />
        <rect x="17" y="17" width="43" height="43" rx="11" fill="#cd9aff" />
        <text x="38.5" y="46" text-anchor="middle" fill="#07100d" font-size="18" font-weight="900">4</text>
        <text x="74" y="35" fill="#edf7f0" font-size="16" font-weight="800">CONTA 04</text>
        <text x="74" y="55" fill="#cd9aff" font-size="11" font-weight="700">PRONTA</text>
        <rect x="17" y="82" width="188" height="12" rx="6" fill="#1d3526" />
        <rect x="17" y="107" width="162" height="9" rx="5" fill="#1b2f23" />
        <rect x="17" y="128" width="145" height="9" rx="5" fill="#17291f" />
      </g>
    </g>
    <ellipse cx="925" cy="560" rx="220" ry="18" fill="#b8ff5b" opacity="0.11" filter="url(#softGlow)" />
  </svg>
`)

async function main() {
  const logo = await sharp(logoPath).resize({ width: 500, withoutEnlargement: true }).png().toBuffer()

  await sharp(background)
    .composite([{ input: logo, left: 40, top: 25 }])
    .png({ compressionLevel: 9 })
    .toFile(outputPath)

  console.log(outputPath)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

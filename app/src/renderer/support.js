'use strict'

const api = window.hunteraFarmSupport
const copyButton = document.querySelector('#copy-button')
const closeButton = document.querySelector('#close-button')
const copyLabel = document.querySelector('[data-copy-label]')
const copyIcon = document.querySelector('[data-copy-icon]')
const copyStatus = document.querySelector('#copy-status')

copyButton.addEventListener('click', async () => {
  if (!api) return
  copyButton.disabled = true

  try {
    await api.copyPix()
    copyLabel.textContent = 'Código Pix copiado'
    copyIcon.textContent = '✓'
    copyStatus.textContent = 'Cole o código no aplicativo do seu banco.'
  } catch {
    copyStatus.textContent = 'Não foi possível copiar o código Pix.'
  } finally {
    copyButton.disabled = false
  }
})

closeButton.addEventListener('click', () => {
  if (api) void api.close()
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && api) void api.close()
})

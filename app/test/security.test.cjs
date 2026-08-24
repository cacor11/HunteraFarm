'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  HUNTERA_REFERRAL_URL,
  isAllowedGamePermission,
  isAllowedPopupNavigation,
  isGoogleAccountsUrl,
  isHunteraUrl,
  parseHttpsUrl
} = require('../src/security.cjs')

test('mantém o endereço inicial do Huntera exato e seguro', () => {
  const referral = parseHttpsUrl(HUNTERA_REFERRAL_URL)
  assert.ok(referral)
  assert.equal(referral.origin, 'https://huntera.com.br')
  assert.equal(referral.pathname, '/')
  assert.equal(referral.searchParams.get('r'), 'Caco')
})

test('aceita apenas URLs HTTPS válidas', () => {
  assert.equal(parseHttpsUrl('https://huntera.com.br/game').hostname, 'huntera.com.br')
  assert.equal(parseHttpsUrl('http://huntera.com.br/game'), null)
  assert.equal(parseHttpsUrl('javascript:alert(1)'), null)
  assert.equal(parseHttpsUrl('não é uma url'), null)
})

test('restringe navegação principal à origem exata do Huntera', () => {
  assert.equal(isHunteraUrl('https://huntera.com.br/game'), true)
  assert.equal(isHunteraUrl('https://huntera.com.br/login?next=%2Fgame'), true)
  assert.equal(isHunteraUrl('https://huntera.com.br.evil.example/game'), false)
  assert.equal(isHunteraUrl('https://www.huntera.com.br/game'), false)
  assert.equal(isHunteraUrl('http://huntera.com.br/game'), false)
})

test('permite apenas o provedor Google esperado em pop-up', () => {
  assert.equal(isGoogleAccountsUrl('https://accounts.google.com/gsi/select'), true)
  assert.equal(isGoogleAccountsUrl('https://accounts.google.com.evil.example/'), false)
  assert.equal(isAllowedPopupNavigation('https://huntera.com.br/login'), true)
  assert.equal(isAllowedPopupNavigation('https://accounts.google.com/o/oauth2/v2/auth'), true)
  assert.equal(isAllowedPopupNavigation('https://example.com/'), false)
})

test('nega permissões por padrão', () => {
  assert.equal(isAllowedGamePermission('fullscreen', 'https://huntera.com.br/game'), true)
  assert.equal(isAllowedGamePermission('pointerLock', 'https://huntera.com.br/game'), true)
  assert.equal(isAllowedGamePermission('media', 'https://huntera.com.br/game'), false)
  assert.equal(isAllowedGamePermission('fullscreen', 'https://example.com'), false)
})

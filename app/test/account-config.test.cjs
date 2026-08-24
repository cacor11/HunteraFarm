'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  DEFAULT_ACTIVE_ACCOUNT_IDS,
  nextAvailableAccountId,
  normalizeAccountIds,
  selectAfterRemoval,
  selectAvailableAccount
} = require('../src/account-config.cjs')

test('uma conta fica aberta por padrão para economizar memória', () => {
  assert.deepEqual(normalizeAccountIds(undefined), [...DEFAULT_ACTIVE_ACCOUNT_IDS])
  assert.deepEqual(normalizeAccountIds([]), [...DEFAULT_ACTIVE_ACCOUNT_IDS])
})

test('normaliza, ordena e limita as contas entre um e quatro', () => {
  assert.deepEqual(normalizeAccountIds([4, 2, 2, 9, 0, '3']), [2, 3, 4])
})

test('encontra o primeiro slot fechado até o limite de quatro', () => {
  assert.equal(nextAvailableAccountId([1, 3]), 2)
  assert.equal(nextAvailableAccountId([1, 2, 3, 4]), null)
})

test('seleção sempre aponta para uma conta aberta', () => {
  assert.equal(selectAvailableAccount([2, 4], 4), 4)
  assert.equal(selectAvailableAccount([2, 4], 1), 2)
  assert.equal(selectAfterRemoval([1, 3, 4], 2), 3)
  assert.equal(selectAfterRemoval([1, 2], 4), 2)
})

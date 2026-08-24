'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { ACCOUNT_COUNT, GRID_GAP, TOOLBAR_HEIGHT, calculateLayout } = require('../src/layout.cjs')

test('modo de uma conta mostra somente a conta aberta selecionada', () => {
  const first = calculateLayout(1200, 800, 'single', 1, [1, 2])
  assert.equal(first.accounts[0].visible, true)
  assert.equal(first.accounts[1].visible, false)
  assert.deepEqual(first.accounts[0].bounds, {
    x: 0,
    y: TOOLBAR_HEIGHT,
    width: 1200,
    height: 800 - TOOLBAR_HEIGHT
  })

  const fallback = calculateLayout(1200, 800, 'single', 4, [2, 3])
  assert.equal(fallback.accounts[1].visible, true)
  assert.equal(fallback.accounts.filter((account) => account.visible).length, 1)
})

test('grade com duas contas usa duas colunas inteiras', () => {
  const result = calculateLayout(1201, 801, 'grid', 1, [1, 3])
  const first = result.accounts[0]
  const third = result.accounts[2]

  assert.equal(first.visible, true)
  assert.equal(third.visible, true)
  assert.equal(result.accounts.filter((account) => account.visible).length, 2)
  assert.equal(first.bounds.height, 801 - TOOLBAR_HEIGHT)
  assert.equal(third.bounds.x, first.bounds.width + GRID_GAP)
  assert.equal(third.bounds.x + third.bounds.width, 1201)
})

test('grade com três contas amplia a última na linha inferior', () => {
  const result = calculateLayout(1200, 800, 'grid', 1, [1, 2, 4])
  const [first, second, , fourth] = result.accounts

  assert.equal(result.accounts.filter((account) => account.visible).length, 3)
  assert.equal(second.bounds.x, first.bounds.width + GRID_GAP)
  assert.equal(fourth.bounds.x, 0)
  assert.equal(fourth.bounds.width, 1200)
  assert.equal(fourth.bounds.y, first.bounds.y + first.bounds.height + GRID_GAP)
})

test('grade com quatro contas usa duas linhas e duas colunas', () => {
  const result = calculateLayout(1201, 801, 'grid', 1, [1, 2, 3, 4])
  const [topLeft, topRight, bottomLeft, bottomRight] = result.accounts

  assert.ok(result.accounts.every((account) => account.visible))
  assert.equal(topRight.bounds.x, topLeft.bounds.width + GRID_GAP)
  assert.equal(topRight.bounds.x + topRight.bounds.width, 1201)
  assert.equal(bottomLeft.bounds.y, topLeft.bounds.y + topLeft.bounds.height + GRID_GAP)
  assert.equal(bottomRight.bounds.y, bottomLeft.bounds.y)
  assert.equal(bottomLeft.bounds.y + bottomLeft.bounds.height, 801)
})

test('dimensões mínimas nunca ficam negativas', () => {
  const result = calculateLayout(0, 0, 'grid', 1, [1, 2, 3, 4])
  assert.equal(result.accounts.length, ACCOUNT_COUNT)
  result.accounts.forEach((account) => {
    assert.ok(account.bounds.width >= 1)
    assert.ok(account.bounds.height >= 1)
  })
})

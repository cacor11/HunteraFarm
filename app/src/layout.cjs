'use strict'

const {
  MAX_ACCOUNT_COUNT,
  normalizeAccountIds,
  selectAvailableAccount
} = require('./account-config.cjs')

const ACCOUNT_COUNT = MAX_ACCOUNT_COUNT
const TOOLBAR_HEIGHT = 84
const GRID_GAP = 4

function emptyAccountLayout(contentHeight) {
  return {
    visible: false,
    bounds: { x: 0, y: TOOLBAR_HEIGHT, width: 1, height: Math.max(1, contentHeight) }
  }
}

function calculateLayout(width, height, mode, selectedAccount, activeAccountIds) {
  const safeWidth = Math.max(1, Math.floor(width))
  const safeHeight = Math.max(1, Math.floor(height))
  const contentHeight = Math.max(1, safeHeight - TOOLBAR_HEIGHT)
  const toolbar = { x: 0, y: 0, width: safeWidth, height: TOOLBAR_HEIGHT }
  const active = normalizeAccountIds(activeAccountIds)
  const accounts = Array.from({ length: ACCOUNT_COUNT }, () => emptyAccountLayout(contentHeight))

  function show(accountId, bounds) {
    accounts[accountId - 1] = { visible: true, bounds }
  }

  if (mode === 'grid' && active.length > 1) {
    const availableWidth = Math.max(2, safeWidth - GRID_GAP)
    const leftWidth = Math.floor(availableWidth / 2)
    const rightWidth = availableWidth - leftWidth

    if (active.length === 2) {
      show(active[0], { x: 0, y: TOOLBAR_HEIGHT, width: leftWidth, height: contentHeight })
      show(active[1], {
        x: leftWidth + GRID_GAP,
        y: TOOLBAR_HEIGHT,
        width: rightWidth,
        height: contentHeight
      })
      return { toolbar, accounts }
    }

    const availableHeight = Math.max(2, contentHeight - GRID_GAP)
    const topHeight = Math.floor(availableHeight / 2)
    const bottomHeight = availableHeight - topHeight

    show(active[0], { x: 0, y: TOOLBAR_HEIGHT, width: leftWidth, height: topHeight })
    show(active[1], {
      x: leftWidth + GRID_GAP,
      y: TOOLBAR_HEIGHT,
      width: rightWidth,
      height: topHeight
    })

    if (active.length === 3) {
      show(active[2], {
        x: 0,
        y: TOOLBAR_HEIGHT + topHeight + GRID_GAP,
        width: safeWidth,
        height: bottomHeight
      })
      return { toolbar, accounts }
    }

    show(active[2], {
      x: 0,
      y: TOOLBAR_HEIGHT + topHeight + GRID_GAP,
      width: leftWidth,
      height: bottomHeight
    })
    show(active[3], {
      x: leftWidth + GRID_GAP,
      y: TOOLBAR_HEIGHT + topHeight + GRID_GAP,
      width: rightWidth,
      height: bottomHeight
    })

    return { toolbar, accounts }
  }

  const selected = selectAvailableAccount(active, selectedAccount)
  show(selected, { x: 0, y: TOOLBAR_HEIGHT, width: safeWidth, height: contentHeight })

  return {
    toolbar,
    accounts
  }
}

module.exports = {
  ACCOUNT_COUNT,
  GRID_GAP,
  TOOLBAR_HEIGHT,
  calculateLayout
}

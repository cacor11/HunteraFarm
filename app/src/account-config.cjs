'use strict'

const MAX_ACCOUNT_COUNT = 4
const DEFAULT_ACTIVE_ACCOUNT_IDS = Object.freeze([1])

function normalizeAccountIds(value, fallback = DEFAULT_ACTIVE_ACCOUNT_IDS) {
  const normalized = Array.isArray(value)
    ? [...new Set(value.map(Number))]
        .filter((id) => Number.isInteger(id) && id >= 1 && id <= MAX_ACCOUNT_COUNT)
        .sort((left, right) => left - right)
    : []

  if (normalized.length > 0) return normalized
  return [...fallback]
}

function nextAvailableAccountId(activeAccountIds) {
  const active = new Set(normalizeAccountIds(activeAccountIds, []))
  for (let id = 1; id <= MAX_ACCOUNT_COUNT; id += 1) {
    if (!active.has(id)) return id
  }
  return null
}

function selectAvailableAccount(activeAccountIds, preferredAccount) {
  const active = normalizeAccountIds(activeAccountIds)
  const preferred = Number(preferredAccount)
  return active.includes(preferred) ? preferred : active[0]
}

function selectAfterRemoval(activeAccountIds, removedAccount) {
  const active = normalizeAccountIds(activeAccountIds)
  const removed = Number(removedAccount)
  return active.find((id) => id > removed) || active[active.length - 1]
}

module.exports = {
  DEFAULT_ACTIVE_ACCOUNT_IDS,
  MAX_ACCOUNT_COUNT,
  nextAvailableAccountId,
  normalizeAccountIds,
  selectAfterRemoval,
  selectAvailableAccount
}

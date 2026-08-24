'use strict'

const HUNTERA_ORIGIN = 'https://huntera.com.br'
const HUNTERA_REFERRAL_URL = `${HUNTERA_ORIGIN}/?r=Caco`
const GOOGLE_ACCOUNTS_ORIGIN = 'https://accounts.google.com'

function parseHttpsUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function isHunteraUrl(value) {
  const url = parseHttpsUrl(value)
  return Boolean(url && url.origin === HUNTERA_ORIGIN)
}

function isGoogleAccountsUrl(value) {
  const url = parseHttpsUrl(value)
  return Boolean(url && url.origin === GOOGLE_ACCOUNTS_ORIGIN)
}

function isAllowedPopupNavigation(value) {
  return isHunteraUrl(value) || isGoogleAccountsUrl(value)
}

function isAllowedGamePermission(permission, requestingOrigin) {
  return (
    (permission === 'fullscreen' || permission === 'pointerLock') &&
    isHunteraUrl(requestingOrigin)
  )
}

module.exports = {
  GOOGLE_ACCOUNTS_ORIGIN,
  HUNTERA_ORIGIN,
  HUNTERA_REFERRAL_URL,
  isAllowedGamePermission,
  isAllowedPopupNavigation,
  isGoogleAccountsUrl,
  isHunteraUrl,
  parseHttpsUrl
}

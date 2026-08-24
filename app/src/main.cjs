'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  session,
  WebContentsView
} = require('electron')

const { ACCOUNT_COUNT, calculateLayout } = require('./layout.cjs')
const {
  DEFAULT_ACTIVE_ACCOUNT_IDS,
  nextAvailableAccountId,
  normalizeAccountIds,
  selectAfterRemoval,
  selectAvailableAccount
} = require('./account-config.cjs')
const {
  HUNTERA_ORIGIN,
  HUNTERA_REFERRAL_URL,
  isAllowedGamePermission,
  isAllowedPopupNavigation,
  isGoogleAccountsUrl,
  isHunteraUrl
} = require('./security.cjs')

const APP_NAME = 'HunteraFarm'
const GAME_URL = `${HUNTERA_ORIGIN}/game`
const IPC_COMMAND = 'hunterafarm:command'
const IPC_GET_STATE = 'hunterafarm:get-state'
const IPC_STATE = 'hunterafarm:state'
const IPC_SUPPORT_COMMAND = 'hunterafarm:support-command'
const PREFERENCES_FILE = 'preferences.json'
const PIX_PAYLOAD = '00020101021126580014br.gov.bcb.pix01369d2f23e4-d823-4a79-a3aa-545b4b6d3e9a5204000053039865802BR5922ACACIO SANTOS DA SILVA6010POCO VERDE62070503***6304638F'
const SESSION_PARTITIONS = Array.from(
  { length: ACCOUNT_COUNT },
  (_value, index) => `persist:hunterafarm-account-${index + 1}`
)
const ACCOUNT_LABELS = Array.from(
  { length: ACCOUNT_COUNT },
  (_value, index) => `Conta ${index + 1}`
)
const isSessionSmokeTest = process.argv.includes('--smoke-test')
const isLifecycleSmokeTest = process.argv.includes('--lifecycle-smoke-test')
const isSmokeTest = isSessionSmokeTest || isLifecycleSmokeTest

let mainWindow = null
let supportWindow = null
let accountViews = Array(ACCOUNT_COUNT).fill(null)
let selectedAccount = 1
let layoutMode = 'single'
let toolbarReady = false
let appIsQuitting = false
const configuredSessions = new WeakSet()

app.setName(APP_NAME)
app.setAppUserModelId('br.com.hunterafarm.app')
Menu.setApplicationMenu(null)

if (isSmokeTest) {
  app.setPath('userData', path.join(process.cwd(), '.cache', 'smoke-profile'))
}

if (!isSmokeTest) {
  const hasSingleInstanceLock = app.requestSingleInstanceLock()
  if (!hasSingleInstanceLock) {
    app.quit()
  } else {
    app.on('second-instance', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    })
  }
}

app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
  event.preventDefault()
  callback(false)
})

app.on('before-quit', () => {
  appIsQuitting = true
})

function accountIndexFromNumber(accountNumber) {
  const parsed = Number(accountNumber)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > ACCOUNT_COUNT) return -1
  return parsed - 1
}

function getSelectedAccount() {
  const index = accountIndexFromNumber(selectedAccount)
  return index >= 0 ? accountViews[index] : null
}

function activeAccountIds() {
  return accountViews.flatMap((account, index) => (account ? [index + 1] : []))
}

function preferencesPath() {
  return path.join(app.getPath('userData'), PREFERENCES_FILE)
}

function loadActiveAccountIds() {
  try {
    const preferences = JSON.parse(fs.readFileSync(preferencesPath(), 'utf8'))
    return normalizeAccountIds(preferences.activeAccountIds)
  } catch {
    return [...DEFAULT_ACTIVE_ACCOUNT_IDS]
  }
}

function saveActiveAccountIds() {
  try {
    const target = preferencesPath()
    const temporary = `${target}.tmp`
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(
      temporary,
      `${JSON.stringify({ activeAccountIds: activeAccountIds() }, null, 2)}\n`,
      'utf8'
    )
    fs.renameSync(temporary, target)
  } catch (error) {
    console.warn(`Não foi possível salvar as telas abertas: ${error.message}`)
  }
}

function routeLabel(rawUrl) {
  try {
    const url = new URL(rawUrl)
    if (url.pathname.startsWith('/game')) return 'Jogo'
    if (url.pathname.startsWith('/login')) return 'Entrar'
    return 'Huntera'
  } catch {
    return 'Huntera'
  }
}

function publicState() {
  const active = activeAccountIds()
  return {
    selectedAccount,
    layoutMode,
    maxAccounts: ACCOUNT_COUNT,
    openAccountCount: active.length,
    fullscreen: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFullScreen()),
    accounts: accountViews.map((account, index) => {
      if (!account) {
        return {
          id: index + 1,
          label: ACCOUNT_LABELS[index],
          open: false,
          loading: false,
          muted: false,
          busy: false,
          status: 'Fechada',
          route: ''
        }
      }

      return {
        id: index + 1,
        label: ACCOUNT_LABELS[index],
        open: true,
        loading: account.loading,
        muted: account.webContents.isAudioMuted(),
        busy: account.busy,
        status: account.status,
        route: routeLabel(account.webContents.getURL())
      }
    })
  }
}

function sendState() {
  if (
    !toolbarReady ||
    !mainWindow ||
    mainWindow.isDestroyed() ||
    mainWindow.webContents.isDestroyed()
  ) {
    return
  }

  mainWindow.webContents.send(IPC_STATE, publicState())
}

function setAccountStatus(account, status, loading = account.loading) {
  account.status = status
  account.loading = loading
  sendState()
}

function applyLayout() {
  if (!mainWindow || mainWindow.isDestroyed()) return

  const active = activeAccountIds()
  if (active.length === 0) return

  selectedAccount = selectAvailableAccount(active, selectedAccount)
  if (active.length === 1) layoutMode = 'single'

  const { width, height } = mainWindow.getContentBounds()
  const layout = calculateLayout(width, height, layoutMode, selectedAccount, active)

  accountViews.forEach((account, index) => {
    if (!account) return
    const next = layout.accounts[index]
    account.view.setBounds(next.bounds)
    account.view.setVisible(next.visible)
  })

  sendState()
}

function selectAccount(accountNumber, focusGame = true) {
  const index = accountIndexFromNumber(accountNumber)
  if (index < 0 || !accountViews[index]) return false

  selectedAccount = index + 1
  applyLayout()

  if (focusGame) {
    const selected = getSelectedAccount()
    if (selected && !selected.webContents.isDestroyed()) {
      selected.webContents.focus()
    }
  }

  return true
}

function toggleLayout() {
  if (activeAccountIds().length <= 1) {
    layoutMode = 'single'
    applyLayout()
    return
  }

  layoutMode = layoutMode === 'single' ? 'grid' : 'single'
  applyLayout()
}

function reloadSelectedAccount() {
  const account = getSelectedAccount()
  if (!account || account.busy || account.webContents.isDestroyed()) return

  if (isHunteraUrl(account.webContents.getURL())) {
    account.webContents.reload()
  } else {
    void loadGame(account)
  }
}

function toggleMuteSelectedAccount() {
  const account = getSelectedAccount()
  if (!account || account.webContents.isDestroyed()) return

  account.webContents.setAudioMuted(!account.webContents.isAudioMuted())
  sendState()
}

function toggleFullscreen() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.setFullScreen(!mainWindow.isFullScreen())
  sendState()
}

function createSupportWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return

  if (supportWindow && !supportWindow.isDestroyed()) {
    if (supportWindow.isMinimized()) supportWindow.restore()
    supportWindow.show()
    supportWindow.focus()
    return
  }

  supportWindow = new BrowserWindow({
    width: 500,
    height: 720,
    minWidth: 440,
    minHeight: 640,
    parent: mainWindow,
    modal: true,
    show: false,
    center: true,
    title: 'Apoiar o HunteraFarm',
    backgroundColor: '#07100c',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'support-preload.cjs'),
      devTools: false,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false
    }
  })

  supportWindow.setMenuBarVisibility(false)
  const localPage = pathToFileURL(path.join(__dirname, 'renderer', 'support.html')).href
  const guardNavigation = (details) => {
    if (details.url === localPage) return
    details.preventDefault()
  }

  supportWindow.webContents.on('will-navigate', guardNavigation)
  supportWindow.webContents.on('will-redirect', guardNavigation)
  supportWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  supportWindow.once('ready-to-show', () => {
    if (supportWindow && !supportWindow.isDestroyed()) supportWindow.show()
  })

  supportWindow.once('closed', () => {
    supportWindow = null
  })

  void supportWindow.loadFile(path.join(__dirname, 'renderer', 'support.html'))
}

async function clearSelectedSession() {
  const index = accountIndexFromNumber(selectedAccount)
  let account = index >= 0 ? accountViews[index] : null
  if (!account) return { ok: false }
  if (accountViews.some((candidate) => candidate && candidate.busy)) {
    return { ok: false, busy: true }
  }

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: `Limpar ${ACCOUNT_LABELS[index]}`,
    message: `Limpar o login e os dados da ${ACCOUNT_LABELS[index]}?`,
    detail: 'As outras contas continuarão conectadas. Esta ação não apaga sua conta no Huntera.',
    buttons: ['Cancelar', `Limpar ${ACCOUNT_LABELS[index]}`],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  })

  if (result.response !== 1) return { ok: true, cancelled: true }

  account.busy = true
  setAccountStatus(account, 'Limpando sessão…', true)

  try {
    account = await replaceAccountView(index, {
      busy: true,
      loading: true,
      status: 'Limpando sessão…'
    })

    await Promise.all([
      account.session.clearAuthCache(),
      account.session.clearCache(),
      account.session.clearStorageData()
    ])

    await loadGame(account, { useReferral: true })
    return { ok: true, cancelled: false }
  } catch (error) {
    setAccountStatus(account, 'Falha ao limpar', false)
    throw error
  } finally {
    account.busy = false
    sendState()
  }
}

function handleShortcut(event, input) {
  if (input.type !== 'keyDown' || input.isAutoRepeat || input.isComposing || input.alt) return

  const commandKey = input.control || input.meta
  const key = String(input.key || '').toLowerCase()

  if (commandKey && !input.shift && /^[1-4]$/.test(key)) {
    if (selectAccount(Number(key))) event.preventDefault()
    return
  }

  if (commandKey && input.shift && key === 'l') {
    event.preventDefault()
    toggleLayout()
    return
  }

  if (commandKey && !input.shift && key === 'r') {
    event.preventDefault()
    reloadSelectedAccount()
    return
  }

  if (commandKey && !input.shift && key === 'm') {
    event.preventDefault()
    toggleMuteSelectedAccount()
    return
  }

  if (key === 'f11') {
    event.preventDefault()
    toggleFullscreen()
  }
}

function configureAccountSession(accountSession) {
  if (configuredSessions.has(accountSession)) return
  configuredSessions.add(accountSession)

  accountSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return isAllowedGamePermission(permission, requestingOrigin)
  })

  accountSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingOrigin = details.requestingUrl || webContents.getURL()
    callback(isAllowedGamePermission(permission, requestingOrigin))
  })

  accountSession.on('will-download', (event) => {
    event.preventDefault()
  })
}

function guardPopupWindow(childWindow) {
  const guardNavigation = (details) => {
    if (isAllowedPopupNavigation(details.url)) return
    details.preventDefault()
    if (!childWindow.isDestroyed()) childWindow.close()
  }

  childWindow.webContents.on('will-navigate', guardNavigation)
  childWindow.webContents.on('will-redirect', guardNavigation)
  childWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  childWindow.setMenuBarVisibility(false)
}

function configureGameWebContents(account, index) {
  const { webContents } = account

  const guardNavigation = (details) => {
    if (isHunteraUrl(details.url)) return
    details.preventDefault()
    setAccountStatus(account, 'Link externo bloqueado', false)
  }

  webContents.on('will-navigate', guardNavigation)
  webContents.on('will-redirect', guardNavigation)

  webContents.setWindowOpenHandler((details) => {
    if (isHunteraUrl(details.url)) {
      void webContents.loadURL(details.url)
      return { action: 'deny' }
    }

    if (isGoogleAccountsUrl(details.url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          minWidth: 420,
          minHeight: 560,
          parent: mainWindow,
          modal: false,
          autoHideMenuBar: true,
          title: `Entrar com Google — ${ACCOUNT_LABELS[index]}`,
          icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
          webPreferences: {
            partition: SESSION_PARTITIONS[index],
            devTools: false,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            webviewTag: false
          }
        }
      }
    }

    setAccountStatus(account, 'Pop-up externo bloqueado', false)
    return { action: 'deny' }
  })

  webContents.on('did-create-window', (childWindow) => {
    account.popupWindows.add(childWindow)
    childWindow.once('closed', () => account.popupWindows.delete(childWindow))
    guardPopupWindow(childWindow)
  })

  webContents.on('did-start-loading', () => {
    account.loadFailed = false
    setAccountStatus(account, 'Carregando…', true)
  })

  webContents.on('did-finish-load', () => {
    if (account.loadFailed) return
    setAccountStatus(account, 'Pronta', false)
  })

  webContents.on(
    'did-fail-load',
    (_event, errorCode, _errorDescription, _validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return
      account.loadFailed = true
      setAccountStatus(account, 'Sem conexão — recarregue', false)
    }
  )

  webContents.on('render-process-gone', () => {
    setAccountStatus(account, 'Falha — recarregue', false)
  })

  webContents.on('unresponsive', () => {
    setAccountStatus(account, 'Não está respondendo', false)
  })

  webContents.on('responsive', () => {
    setAccountStatus(account, 'Pronta', false)
  })

  webContents.on('focus', () => {
    selectedAccount = index + 1
    sendState()
  })

  webContents.on('before-input-event', handleShortcut)
}

function createAccountView(index) {
  const accountSession = session.fromPartition(SESSION_PARTITIONS[index], { cache: true })
  configureAccountSession(accountSession)

  const view = new WebContentsView({
    webPreferences: {
      session: accountSession,
      devTools: false,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      backgroundThrottling: true,
      navigateOnDragDrop: false,
      spellcheck: false
    }
  })

  view.setBackgroundColor('#070b09')

  const account = {
    view,
    webContents: view.webContents,
    session: accountSession,
    loading: true,
    busy: false,
    loadFailed: false,
    popupWindows: new Set(),
    status: 'Carregando…'
  }

  configureGameWebContents(account, index)
  return account
}

async function replaceAccountView(index, initialState = {}) {
  const previous = accountViews[index]
  const wasMuted = previous ? previous.webContents.isAudioMuted() : false

  if (previous) await destroyAccountView(index)

  const replacement = createAccountView(index)

  replacement.busy = Boolean(initialState.busy)
  replacement.loading = Boolean(initialState.loading)
  replacement.status = initialState.status || replacement.status
  replacement.webContents.setAudioMuted(wasMuted)

  mainWindow.contentView.addChildView(replacement.view)
  accountViews[index] = replacement

  applyLayout()
  return replacement
}

async function destroyAccountView(index) {
  const account = accountViews[index]
  if (!account) return false

  account.popupWindows.forEach((popup) => {
    if (!popup.isDestroyed()) popup.destroy()
  })

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.contentView.removeChildView(account.view)
  }

  if (!account.webContents.isDestroyed()) {
    account.webContents.close({ waitForBeforeUnload: false })
  }

  const destroyed = await waitForWebContentsDestroyed(account.webContents)
  if (destroyed) {
    try {
      await account.session.closeAllConnections()
    } catch {
      // A tela já foi encerrada; uma falha ao fechar sockets não deve impedir a remoção.
    }
  }

  if (accountViews[index] === account) accountViews[index] = null
  return true
}

function waitForWebContentsDestroyed(webContents, timeoutMs = 3000) {
  if (!webContents || webContents.isDestroyed()) return Promise.resolve(true)

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(webContents.isDestroyed()), timeoutMs)
    webContents.once('destroyed', () => {
      clearTimeout(timeout)
      resolve(true)
    })
  })
}

function addAccountView({ loadGamePage = true } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, reason: 'window-closed' }

  const accountId = nextAvailableAccountId(activeAccountIds())
  if (!accountId) return { ok: false, reason: 'maximum-open' }

  const index = accountId - 1
  const account = createAccountView(index)
  accountViews[index] = account
  mainWindow.contentView.addChildView(account.view)
  selectedAccount = accountId
  saveActiveAccountIds()
  applyLayout()
  if (loadGamePage) void loadGame(account, { useReferral: true })
  return { ok: true, account: accountId }
}

async function removeAccountView(accountNumber) {
  const index = accountIndexFromNumber(accountNumber)
  if (index < 0 || !accountViews[index]) return { ok: false, reason: 'not-open' }

  const active = activeAccountIds()
  if (active.length <= 1) return { ok: false, reason: 'minimum-open' }

  const removedAccount = index + 1
  const wasSelected = selectedAccount === removedAccount
  await destroyAccountView(index)
  const remaining = activeAccountIds()

  if (wasSelected) selectedAccount = selectAfterRemoval(remaining, removedAccount)
  if (remaining.length === 1) layoutMode = 'single'

  saveActiveAccountIds()
  applyLayout()
  selectAccount(selectedAccount)

  return { ok: true, account: removedAccount }
}

async function loadGame(account, { useReferral = false } = {}) {
  setAccountStatus(account, 'Carregando…', true)

  try {
    // A primeira abertura (e uma sessão recém-limpa) passa pelo link indicado.
    // Navegações posteriores continuam no próprio jogo, sem reaplicar o referral.
    await account.webContents.loadURL(useReferral ? HUNTERA_REFERRAL_URL : GAME_URL)
  } catch {
    setAccountStatus(account, 'Sem conexão — recarregue', false)
  }
}

function registerIpcHandlers() {
  ipcMain.handle(IPC_GET_STATE, (event) => {
    if (!mainWindow || event.sender.id !== mainWindow.webContents.id) {
      throw new Error('Origem IPC não autorizada')
    }
    return publicState()
  })

  ipcMain.handle(IPC_COMMAND, async (event, request) => {
    if (!mainWindow || event.sender.id !== mainWindow.webContents.id) {
      throw new Error('Origem IPC não autorizada')
    }

    const command = request && request.command

    switch (command) {
      case 'select-account':
        return { ok: selectAccount(request.account) }
      case 'add-account':
        return addAccountView()
      case 'remove-account':
        return removeAccountView(request.account)
      case 'toggle-layout':
        toggleLayout()
        return { ok: true }
      case 'reload':
        reloadSelectedAccount()
        return { ok: true }
      case 'toggle-mute':
        toggleMuteSelectedAccount()
        return { ok: true }
      case 'toggle-fullscreen':
        toggleFullscreen()
        return { ok: true }
      case 'open-support':
        createSupportWindow()
        return { ok: true }
      case 'clear-session':
        return clearSelectedSession()
      default:
        throw new Error('Comando desconhecido')
    }
  })

  ipcMain.handle(IPC_SUPPORT_COMMAND, (event, request) => {
    if (!supportWindow || event.sender.id !== supportWindow.webContents.id) {
      throw new Error('Origem IPC não autorizada')
    }

    const command = request && request.command
    if (command === 'copy-pix') {
      clipboard.writeText(PIX_PAYLOAD)
      return { ok: true }
    }

    if (command === 'close') {
      supportWindow.close()
      return { ok: true }
    }

    throw new Error('Comando desconhecido')
  })
}

function lockToolbarNavigation() {
  const localPage = pathToFileURL(path.join(__dirname, 'renderer', 'index.html')).href
  const guardNavigation = (details) => {
    if (details.url === localPage) return
    details.preventDefault()
  }

  mainWindow.webContents.on('will-navigate', guardNavigation)
  mainWindow.webContents.on('will-redirect', guardNavigation)
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    show: false,
    center: true,
    title: APP_NAME,
    backgroundColor: '#07100c',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      devTools: false,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false
    }
  })

  mainWindow.setMenuBarVisibility(false)
  lockToolbarNavigation()
  mainWindow.webContents.on('before-input-event', handleShortcut)

  accountViews = Array(ACCOUNT_COUNT).fill(null)
  const initialAccountIds = loadActiveAccountIds()
  initialAccountIds.forEach((accountId) => {
    const index = accountId - 1
    const account = createAccountView(index)
    accountViews[index] = account
    mainWindow.contentView.addChildView(account.view)
  })
  selectedAccount = initialAccountIds[0]

  mainWindow.on('resize', applyLayout)
  mainWindow.on('enter-full-screen', sendState)
  mainWindow.on('leave-full-screen', sendState)

  mainWindow.on('closed', () => {
    if (supportWindow && !supportWindow.isDestroyed()) supportWindow.destroy()
    supportWindow = null
    accountViews.forEach((account) => {
      if (account && !account.webContents.isDestroyed()) account.webContents.close()
    })
    accountViews = Array(ACCOUNT_COUNT).fill(null)
    toolbarReady = false
    mainWindow = null
  })

  mainWindow.webContents.on('did-finish-load', () => {
    toolbarReady = true
    sendState()
  })

  mainWindow.once('ready-to-show', () => {
    applyLayout()
    mainWindow.show()
    selectAccount(selectedAccount)
  })

  void mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  accountViews.forEach((account) => {
    if (account) void loadGame(account, { useReferral: true })
  })
  applyLayout()
}

async function runSmokeTest() {
  const stamp = `${process.pid}-${Date.now()}`
  const smokeSessions = Array.from({ length: ACCOUNT_COUNT }, (_value, index) =>
    session.fromPartition(`hunterafarm-smoke-${index + 1}-${stamp}`)
  )

  try {
    await Promise.all(
      smokeSessions.map((smokeSession, index) =>
        smokeSession.cookies.set({
          url: HUNTERA_ORIGIN,
          name: 'hunterafarm-smoke',
          value: `account-${index + 1}`,
          secure: true,
          sameSite: 'lax'
        })
      )
    )

    const cookiesBySession = await Promise.all(
      smokeSessions.map((smokeSession) =>
        smokeSession.cookies.get({ name: 'hunterafarm-smoke' })
      )
    )
    const sessionsIsolated = cookiesBySession.every(
      (cookies, index) => cookies.length === 1 && cookies[0].value === `account-${index + 1}`
    )
    const passed = sessionsIsolated

    console.log(
      `HUNTERAFARM_SMOKE ${JSON.stringify({
        passed,
        sessionsIsolated
      })}`
    )

    return passed ? 0 : 1
  } catch (error) {
    console.error(`HUNTERAFARM_SMOKE ${JSON.stringify({ passed: false, error: error.message })}`)
    return 1
  } finally {
    await Promise.allSettled(smokeSessions.map((smokeSession) => smokeSession.clearStorageData()))
  }
}

async function runLifecycleSmokeTest() {
  let removedWebContents = null

  try {
    mainWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      show: false,
      webPreferences: {
        devTools: false,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    })
    accountViews = Array(ACCOUNT_COUNT).fill(null)
    selectedAccount = 1
    layoutMode = 'single'
    toolbarReady = false

    const first = addAccountView({ loadGamePage: false })
    const second = addAccountView({ loadGamePage: false })
    removedWebContents = accountViews[1].webContents
    const removed = await removeAccountView(2)
    const destroyedAfterClose = await waitForWebContentsDestroyed(removedWebContents)
    const reopened = addAccountView({ loadGamePage: false })
    const third = addAccountView({ loadGamePage: false })
    const fourth = addAccountView({ loadGamePage: false })
    const maximum = addAccountView({ loadGamePage: false })

    await removeAccountView(4)
    await removeAccountView(3)
    await removeAccountView(2)
    const minimum = await removeAccountView(1)

    const passed =
      first.ok &&
      first.account === 1 &&
      second.ok &&
      second.account === 2 &&
      removed.ok &&
      destroyedAfterClose &&
      reopened.ok &&
      reopened.account === 2 &&
      third.account === 3 &&
      fourth.account === 4 &&
      maximum.reason === 'maximum-open' &&
      minimum.reason === 'minimum-open' &&
      activeAccountIds().length === 1

    console.log(
      `HUNTERAFARM_LIFECYCLE_SMOKE ${JSON.stringify({
        passed,
        destroyedAfterClose,
        maximumEnforced: maximum.reason === 'maximum-open',
        minimumEnforced: minimum.reason === 'minimum-open',
        remainingAccounts: activeAccountIds()
      })}`
    )

    return passed ? 0 : 1
  } catch (error) {
    console.error(
      `HUNTERAFARM_LIFECYCLE_SMOKE ${JSON.stringify({ passed: false, error: error.message })}`
    )
    return 1
  } finally {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy()
    removedWebContents = null
  }
}

app.whenReady().then(async () => {
  if (isSessionSmokeTest) {
    const exitCode = await runSmokeTest()
    app.exit(exitCode)
    return
  }

  if (isLifecycleSmokeTest) {
    const exitCode = await runLifecycleSmokeTest()
    app.exit(exitCode)
    return
  }

  registerIpcHandlers()
  createMainWindow()
})

app.on('activate', () => {
  if (!isSmokeTest && BrowserWindow.getAllWindows().length === 0) createMainWindow()
})

app.on('window-all-closed', () => {
  if (isSmokeTest) return
  if (process.platform !== 'darwin' || appIsQuitting) app.quit()
})

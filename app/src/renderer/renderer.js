'use strict'

const accountSlots = document.querySelector('#account-slots')
const addAccountButton = document.querySelector('#add-account-button')
const layoutButton = document.querySelector('#layout-button')
const reloadButton = document.querySelector('#reload-button')
const muteButton = document.querySelector('#mute-button')
const clearButton = document.querySelector('#clear-button')
const fullscreenButton = document.querySelector('#fullscreen-button')
const supportButton = document.querySelector('#support-button')
const announcer = document.querySelector('#announcer')
const api = window.hunteraFarm

const previewState = {
  selectedAccount: 1,
  layoutMode: 'single',
  fullscreen: false,
  maxAccounts: 4,
  openAccountCount: 1,
  accounts: [
    {
      id: 1,
      label: 'Conta 1',
      open: true,
      loading: false,
      muted: false,
      busy: false,
      status: 'Pronta',
      route: 'Entrar'
    },
    {
      id: 2,
      label: 'Conta 2',
      open: false,
      loading: false,
      muted: false,
      busy: false,
      status: 'Fechada',
      route: ''
    },
    {
      id: 3,
      label: 'Conta 3',
      open: false,
      loading: false,
      muted: false,
      busy: false,
      status: 'Fechada',
      route: ''
    },
    {
      id: 4,
      label: 'Conta 4',
      open: false,
      loading: false,
      muted: false,
      busy: false,
      status: 'Fechada',
      route: ''
    }
  ]
}

const accountElements = new Map()
let currentState = previewState

function statusClass(account) {
  if (account.loading) return 'loading'
  if (/sem conexão|falha|bloqueado|não está/i.test(account.status)) return 'error'
  return 'ready'
}

function createAccountSlot(accountId) {
  const slot = document.createElement('div')
  slot.className = 'account-slot'
  slot.dataset.accountSlot = String(accountId)

  const tab = document.createElement('button')
  tab.className = 'account-tab'
  tab.type = 'button'
  tab.dataset.account = String(accountId)
  tab.setAttribute('aria-pressed', 'false')
  tab.innerHTML = `
    <span class="account-status loading" data-status-dot aria-hidden="true"></span>
    <span class="account-copy">
      <span class="account-name" data-account-name>Conta ${accountId}</span>
      <span class="account-detail" data-account-detail>Carregando…</span>
    </span>
    <span class="mute-badge" data-mute-badge hidden aria-label="Sem som">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11 6 7 10H4v4h3l4 4V6Z"></path>
        <path d="m16 10 4 4m0-4-4 4"></path>
      </svg>
    </span>
    <span class="key-hint" aria-hidden="true">Ctrl+${accountId}</span>
  `

  const close = document.createElement('button')
  close.className = 'account-close'
  close.type = 'button'
  close.dataset.removeAccount = String(accountId)
  close.title = `Fechar a tela da Conta ${accountId} e reduzir o uso de memória`
  close.setAttribute('aria-label', `Fechar a tela da Conta ${accountId} e reduzir o uso de memória`)
  close.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 7 10 10M17 7 7 17"></path>
    </svg>
  `

  tab.addEventListener('click', () => {
    void runCommand(
      { command: 'select-account', account: accountId },
      `Conta ${accountId} selecionada.`
    )
  })

  close.addEventListener('click', async () => {
    const result = await runCommand({ command: 'remove-account', account: accountId })
    if (!result) return
    if (result.ok) {
      announcer.textContent = `Tela da Conta ${accountId} fechada. O navegador dessa conta foi encerrado.`
    } else if (result.reason === 'minimum-open') {
      announcer.textContent = 'Mantenha pelo menos uma tela aberta.'
    }
  })

  slot.append(tab, close)
  accountSlots.append(slot)
  accountElements.set(accountId, { slot, tab, close })
}

for (let accountId = 1; accountId <= 4; accountId += 1) {
  createAccountSlot(accountId)
}

function render(state) {
  if (!state || !Array.isArray(state.accounts) || state.accounts.length !== 4) return
  currentState = state

  state.accounts.forEach((account) => {
    const elements = accountElements.get(account.id)
    if (!elements) return

    const { slot, tab, close } = elements
    slot.hidden = !account.open
    if (!account.open) return

    const selected = state.selectedAccount === account.id
    const dot = tab.querySelector('[data-status-dot]')

    tab.classList.toggle('active', selected)
    tab.setAttribute('aria-pressed', String(selected))
    tab.querySelector('[data-account-name]').textContent = account.label
    tab.querySelector('[data-account-detail]').textContent = `${account.route} · ${account.status}`
    tab.querySelector('[data-mute-badge]').hidden = !account.muted
    dot.className = `account-status ${statusClass(account)}`
    close.hidden = state.openAccountCount <= 1
    close.disabled = account.busy
  })

  const openAccounts = state.accounts.filter((account) => account.open)
  const selected = openAccounts.find((account) => account.id === state.selectedAccount) || openAccounts[0]
  if (!selected) return

  const grid = state.layoutMode === 'grid'
  const cleanupInProgress = openAccounts.some((account) => account.busy)
  const maximumReached = state.openAccountCount >= state.maxAccounts

  accountSlots.style.setProperty('--open-account-count', String(state.openAccountCount))
  addAccountButton.disabled = maximumReached
  addAccountButton.querySelector('span').textContent = maximumReached ? '4 abertas' : 'Adicionar'
  addAccountButton.title = maximumReached
    ? 'As quatro telas já estão abertas'
    : `Adicionar outra tela (${state.openAccountCount} de ${state.maxAccounts} abertas)`

  layoutButton.disabled = state.openAccountCount <= 1
  layoutButton.classList.toggle('active', grid)
  layoutButton.setAttribute('aria-pressed', String(grid))
  layoutButton.title = grid
    ? 'Voltar para uma tela por vez (Ctrl+Shift+L)'
    : `Mostrar as ${state.openAccountCount} telas abertas juntas (Ctrl+Shift+L)`

  muteButton.querySelector('.sound-on').hidden = selected.muted
  muteButton.querySelector('.sound-off').hidden = !selected.muted
  muteButton.title = selected.muted
    ? `Ativar som da ${selected.label} (Ctrl+M)`
    : `Silenciar ${selected.label} (Ctrl+M)`
  muteButton.setAttribute(
    'aria-label',
    selected.muted ? `Ativar som da ${selected.label}` : `Silenciar ${selected.label}`
  )

  clearButton.title = `Limpar login somente da ${selected.label}`
  clearButton.setAttribute('aria-label', `Limpar login da ${selected.label}`)
  clearButton.querySelector('[data-clear-label]').textContent = `Limpar ${selected.label}`
  clearButton.disabled = cleanupInProgress
  reloadButton.disabled = selected.busy

  fullscreenButton.querySelector('.expand-icon').hidden = state.fullscreen
  fullscreenButton.querySelector('.contract-icon').hidden = !state.fullscreen
  fullscreenButton.title = state.fullscreen ? 'Sair da tela cheia (F11)' : 'Tela cheia (F11)'
}

async function runCommand(request, announcement) {
  if (!api) return null

  try {
    const result = await api.command(request)
    if (announcement && result?.ok !== false) announcer.textContent = announcement
    return result
  } catch {
    announcer.textContent = 'Não foi possível executar esta ação.'
    return null
  }
}

addAccountButton.addEventListener('click', async () => {
  const result = await runCommand({ command: 'add-account' })
  if (!result) return
  if (result.ok) {
    announcer.textContent = `Tela da Conta ${result.account} adicionada.`
  } else if (result.reason === 'maximum-open') {
    announcer.textContent = 'O limite de quatro telas já foi atingido.'
  }
})

layoutButton.addEventListener('click', () => {
  const nextIsGrid = currentState.layoutMode !== 'grid'
  void runCommand(
    { command: 'toggle-layout' },
    nextIsGrid ? 'Telas abertas exibidas juntas.' : 'Modo de uma tela ativado.'
  )
})

reloadButton.addEventListener('click', () => {
  void runCommand({ command: 'reload' }, 'Conta selecionada recarregando.')
})

muteButton.addEventListener('click', () => {
  const selected = currentState.accounts.find(
    (account) => account.open && account.id === currentState.selectedAccount
  )
  if (!selected) return

  void runCommand(
    { command: 'toggle-mute' },
    selected.muted ? `Som da ${selected.label} ativado.` : `${selected.label} silenciada.`
  )
})

clearButton.addEventListener('click', async () => {
  const selected = currentState.accounts.find(
    (account) => account.open && account.id === currentState.selectedAccount
  )
  if (!selected) return

  const result = await runCommand({ command: 'clear-session' })
  if (!result) return

  if (!result.ok) {
    announcer.textContent = 'Já existe uma limpeza de sessão em andamento.'
  } else {
    announcer.textContent = result.cancelled
      ? `Limpeza da ${selected.label} cancelada.`
      : `Sessão da ${selected.label} limpa.`
  }
})

fullscreenButton.addEventListener('click', () => {
  void runCommand(
    { command: 'toggle-fullscreen' },
    currentState.fullscreen ? 'Tela cheia encerrada.' : 'Tela cheia ativada.'
  )
})

supportButton.addEventListener('click', () => {
  void runCommand({ command: 'open-support' }, 'Área de apoio aberta.')
})

render(previewState)

if (api) {
  api.onState(render)
  api.getState().then(render).catch(() => {
    announcer.textContent = 'Não foi possível carregar o estado do aplicativo.'
  })
}

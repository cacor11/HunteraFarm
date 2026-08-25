'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  TelemetryClient,
  createHeartbeatPayload,
  loadTelemetrySettings,
  saveTelemetrySettings,
  telemetryFilePath
} = require('../src/telemetry.cjs')

const INSTALLATION_ID = '9d2f23e4-d823-4a79-a3aa-545b4b6d3e9a'

test('cria e mantém um UUID anônimo no diretório do usuário', (context) => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'hunterafarm-telemetry-'))
  context.after(() => fs.rmSync(userDataPath, { recursive: true, force: true }))

  const first = loadTelemetrySettings(userDataPath, () => INSTALLATION_ID)
  const second = loadTelemetrySettings(userDataPath, () => assert.fail('não deve gerar outro UUID'))

  assert.deepEqual(first, { installationId: INSTALLATION_ID, enabled: true })
  assert.deepEqual(second, first)
  assert.deepEqual(JSON.parse(fs.readFileSync(telemetryFilePath(userDataPath), 'utf8')), first)
})

test('preferência de desativação é persistida sem trocar o UUID', (context) => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'hunterafarm-telemetry-'))
  context.after(() => fs.rmSync(userDataPath, { recursive: true, force: true }))

  saveTelemetrySettings(userDataPath, { installationId: INSTALLATION_ID, enabled: false })
  assert.deepEqual(loadTelemetrySettings(userDataPath), {
    installationId: INSTALLATION_ID,
    enabled: false
  })
})

test('heartbeat contém somente os três campos públicos combinados com o servidor', () => {
  assert.deepEqual(
    createHeartbeatPayload({
      installationId: INSTALLATION_ID,
      platform: 'windows',
      version: '1.2.1'
    }),
    {
      installation_id: INSTALLATION_ID,
      platform: 'windows',
      version: '1.2.1'
    }
  )
})

test('desativar interrompe imediatamente o heartbeat em andamento', async () => {
  let calls = 0
  let observedSignal = null

  const client = new TelemetryClient({
    payload: {},
    intervalMs: 60_000,
    send: (_endpoint, _payload, { signal }) => {
      calls += 1
      observedSignal = signal
      return new Promise((resolve) => signal.addEventListener('abort', () => resolve(false)))
    }
  })

  client.setEnabled(true)
  assert.equal(calls, 1)
  assert.equal(observedSignal.aborted, false)

  client.setEnabled(false)
  assert.equal(observedSignal.aborted, true)
  assert.equal(client.timer, null)
  assert.equal(await client.ping(), false)
})

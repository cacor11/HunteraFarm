'use strict'

const fs = require('node:fs')
const path = require('node:path')
const https = require('node:https')
const { randomUUID } = require('node:crypto')

// Endpoint público que recebe somente installation_id, platform e version.
const TELEMETRY_ENDPOINT = 'https://hunterafarm-stats.yacaciio.workers.dev/heartbeat'
const TELEMETRY_FILE = 'anonymous-stats.json'
const HEARTBEAT_INTERVAL_MS = 60_000
const HEARTBEAT_TIMEOUT_MS = 5_000
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidInstallationId(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function telemetryFilePath(userDataPath) {
  return path.join(userDataPath, TELEMETRY_FILE)
}

function normalizeTelemetrySettings(value, createId = randomUUID) {
  return {
    installationId: isValidInstallationId(value && value.installationId)
      ? value.installationId
      : createId(),
    enabled: typeof (value && value.enabled) === 'boolean' ? value.enabled : true
  }
}

function saveTelemetrySettings(userDataPath, settings) {
  const target = telemetryFilePath(userDataPath)
  const temporary = `${target}.tmp`
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600
  })
  fs.renameSync(temporary, target)
}

function loadTelemetrySettings(userDataPath, createId = randomUUID) {
  let stored = null

  try {
    stored = JSON.parse(fs.readFileSync(telemetryFilePath(userDataPath), 'utf8'))
  } catch {
    // Primeira execução ou arquivo inválido: um identificador novo será criado localmente.
  }

  const settings = normalizeTelemetrySettings(stored, createId)
  const unchanged =
    stored &&
    stored.installationId === settings.installationId &&
    stored.enabled === settings.enabled

  if (!unchanged) {
    try {
      saveTelemetrySettings(userDataPath, settings)
    } catch {
      // A contagem nunca pode impedir a abertura do player.
    }
  }
  return settings
}

function createHeartbeatPayload({ installationId, platform, version }) {
  if (!isValidInstallationId(installationId)) throw new TypeError('installationId inválido')

  return {
    installation_id: installationId,
    platform: String(platform),
    version: String(version)
  }
}

function postHeartbeat(endpoint, payload, { signal, timeoutMs = HEARTBEAT_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let url
    try {
      url = new URL(endpoint)
      if (url.protocol !== 'https:') return resolve(false)
    } catch {
      return resolve(false)
    }

    if (signal && signal.aborted) return resolve(false)

    const body = Buffer.from(JSON.stringify(payload), 'utf8')
    let settled = false
    let request
    let deadline

    const finish = (result) => {
      if (settled) return
      settled = true
      if (deadline) clearTimeout(deadline)
      if (signal) signal.removeEventListener('abort', abortRequest)
      resolve(result)
    }

    const abortRequest = () => {
      if (request) request.destroy()
      finish(false)
    }

    try {
      request = https.request(
        url,
        {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'content-length': body.length
          }
        },
        (response) => {
          response.resume()
          response.once('end', () => {
            const statusCode = response.statusCode || 0
            finish(statusCode >= 200 && statusCode < 300)
          })
          response.once('error', () => finish(false))
        }
      )
    } catch {
      finish(false)
      return
    }

    deadline = setTimeout(abortRequest, timeoutMs)
    if (typeof deadline.unref === 'function') deadline.unref()
    request.setTimeout(timeoutMs, abortRequest)
    request.once('error', () => finish(false))
    if (signal) signal.addEventListener('abort', abortRequest, { once: true })
    request.end(body)
  })
}

class TelemetryClient {
  constructor({
    endpoint = TELEMETRY_ENDPOINT,
    payload,
    intervalMs = HEARTBEAT_INTERVAL_MS,
    timeoutMs = HEARTBEAT_TIMEOUT_MS,
    send = postHeartbeat
  }) {
    this.endpoint = endpoint
    this.payload = payload
    this.intervalMs = intervalMs
    this.timeoutMs = timeoutMs
    this.send = send
    this.enabled = false
    this.timer = null
    this.inFlight = null
  }

  start() {
    if (!this.enabled || this.timer) return
    void this.ping()
    this.timer = setInterval(() => void this.ping(), this.intervalMs)
    if (typeof this.timer.unref === 'function') this.timer.unref()
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.inFlight) this.inFlight.abort()
    this.inFlight = null
  }

  setEnabled(enabled) {
    this.enabled = enabled === true
    if (this.enabled) this.start()
    else this.stop()
  }

  async ping() {
    if (!this.enabled || this.inFlight) return false

    const controller = new AbortController()
    this.inFlight = controller

    try {
      return await this.send(this.endpoint, this.payload, {
        signal: controller.signal,
        timeoutMs: this.timeoutMs
      })
    } catch {
      return false
    } finally {
      if (this.inFlight === controller) this.inFlight = null
    }
  }
}

module.exports = {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  TELEMETRY_ENDPOINT,
  TelemetryClient,
  createHeartbeatPayload,
  isValidInstallationId,
  loadTelemetrySettings,
  normalizeTelemetrySettings,
  postHeartbeat,
  saveTelemetrySettings,
  telemetryFilePath
}

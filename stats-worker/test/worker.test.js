import assert from "node:assert/strict";
import test from "node:test";

import { D1StatsStore, handleRequest } from "../src/worker.js";

const UUID_A = "b7d980cf-7fab-47b0-834b-832b5bee69ab";
const UUID_B = "be5d73f1-6410-4d2f-a7d1-c3e6cc96eaea";
const START_MS = Date.parse("2026-08-25T12:00:00.000Z");

class MemoryStatsStore {
  constructor() {
    this.installations = new Map();
  }

  async heartbeat({ installation_id, platform, version, now }) {
    const existing = this.installations.get(installation_id);
    if (!existing) {
      this.installations.set(installation_id, {
        installation_id,
        platform,
        version,
        first_seen: now,
        last_seen: now,
      });
      return;
    }

    if (
      now >= existing.last_seen + 15
      || existing.platform !== platform
      || existing.version !== version
    ) {
      Object.assign(existing, { platform, version, last_seen: now });
    }
  }

  async stats(onlineSince) {
    const rows = [...this.installations.values()];
    return {
      total: rows.length,
      online: rows.filter((row) => row.last_seen >= onlineSince).length,
      tracking_since: rows.length ? Math.min(...rows.map((row) => row.first_seen)) : null,
    };
  }
}

function request(path, options = {}) {
  return new Request(`https://stats.example.test${path}`, options);
}

function heartbeatRequest(payload, headers = {}) {
  return request("/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
}

async function json(response) {
  return JSON.parse(await response.text());
}

test("registra uma instalação anônima e retorna estatísticas públicas", async () => {
  const store = new MemoryStatsStore();
  const post = await handleRequest(
    heartbeatRequest({ installation_id: UUID_A, platform: "android", version: "0.1.2-beta" }),
    {},
    { store, now: () => START_MS },
  );
  assert.equal(post.status, 204);

  const response = await handleRequest(request("/stats"), {}, {
    store,
    now: () => START_MS + 30_000,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await json(response), {
    online: 1,
    total: 1,
    generated_at: "2026-08-25T12:00:30.000Z",
    tracking_since: "2026-08-25T12:00:00.000Z",
  });
  assert.match(response.headers.get("Cache-Control"), /max-age=10/);
});

test("o total conta instalações únicas e online usa a janela de 120 segundos", async () => {
  const store = new MemoryStatsStore();
  await handleRequest(
    heartbeatRequest({ installation_id: UUID_A, platform: "windows", version: "1.2.0" }),
    {},
    { store, now: () => START_MS },
  );
  await handleRequest(
    heartbeatRequest({ installation_id: UUID_B, platform: "android", version: "0.1.2-beta" }),
    {},
    { store, now: () => START_MS + 121_000 },
  );
  await handleRequest(
    heartbeatRequest({ installation_id: UUID_B, platform: "android", version: "0.1.2-beta" }),
    {},
    { store, now: () => START_MS + 130_000 },
  );

  const response = await handleRequest(request("/stats"), {}, {
    store,
    now: () => START_MS + 130_000,
  });
  const body = await json(response);
  assert.equal(body.total, 2);
  assert.equal(body.online, 1);
  assert.equal(store.installations.get(UUID_B).last_seen, Math.floor((START_MS + 121_000) / 1000));
});

test("a mesma instalação não aumenta o total e pode atualizar versão", async () => {
  const store = new MemoryStatsStore();
  await handleRequest(
    heartbeatRequest({ installation_id: UUID_A, platform: "android", version: "0.1.2-beta" }),
    {},
    { store, now: () => START_MS },
  );
  await handleRequest(
    heartbeatRequest({ installation_id: UUID_A.toUpperCase(), platform: "ANDROID", version: "0.1.3-beta" }),
    {},
    { store, now: () => START_MS + 1_000 },
  );

  const saved = store.installations.get(UUID_A);
  assert.equal(store.installations.size, 1);
  assert.equal(saved.version, "0.1.3-beta");
  assert.equal(saved.first_seen, Math.floor(START_MS / 1000));
});

test("rejeita UUID, plataforma e versão inválidos", async () => {
  const store = new MemoryStatsStore();
  const cases = [
    [{ installation_id: "not-a-uuid", platform: "android", version: "1.0" }, "invalid_installation_id"],
    [{ installation_id: UUID_A, platform: "ios", version: "1.0" }, "invalid_platform"],
    [{ installation_id: UUID_A, platform: "android", version: "bad version" }, "invalid_version"],
  ];

  for (const [payload, error] of cases) {
    const response = await handleRequest(heartbeatRequest(payload), {}, {
      store,
      now: () => START_MS,
    });
    assert.equal(response.status, 400);
    assert.equal((await json(response)).error, error);
  }
  assert.equal(store.installations.size, 0);
});

test("limita o corpo e exige JSON", async () => {
  const store = new MemoryStatsStore();
  const tooLarge = await handleRequest(request("/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ padding: "x".repeat(1100) }),
  }), {}, { store, now: () => START_MS });
  assert.equal(tooLarge.status, 413);

  const wrongType = await handleRequest(request("/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "{}",
  }), {}, { store, now: () => START_MS });
  assert.equal(wrongType.status, 415);
});

test("CORS responde preflight e restringe origem quando configurado", async () => {
  const response = await handleRequest(request("/heartbeat", {
    method: "OPTIONS",
    headers: { Origin: "https://cacor11.github.io" },
  }), { CORS_ALLOW_ORIGIN: "https://cacor11.github.io" });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://cacor11.github.io");
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "GET, POST, OPTIONS");
  assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type");
  assert.equal(response.headers.get("Vary"), "Origin");
});

test("não depende de IP ou User-Agent e passa somente campos anônimos ao armazenamento", async () => {
  let captured;
  const store = {
    async heartbeat(value) { captured = value; },
    async stats() { return { online: 0, total: 0, tracking_since: null }; },
  };
  const response = await handleRequest(heartbeatRequest(
    { installation_id: UUID_A, platform: "android", version: "0.1.2-beta" },
    { "User-Agent": "private-value", "CF-Connecting-IP": "203.0.113.42" },
  ), {}, { store, now: () => START_MS });

  assert.equal(response.status, 204);
  assert.deepEqual(Object.keys(captured).sort(), ["installation_id", "now", "platform", "version"]);
  assert.equal(JSON.stringify(captured).includes("203.0.113.42"), false);
  assert.equal(JSON.stringify(captured).includes("private-value"), false);
});

test("D1 usa UPSERT defensivo e consulta agregada parametrizada", async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      const call = { sql, values: [] };
      calls.push(call);
      return {
        bind(...values) {
          call.values = values;
          return this;
        },
        async run() { return { success: true }; },
        async first() { return { total: 3, online: 2, tracking_since: 100 }; },
      };
    },
  };
  const store = new D1StatsStore(db);
  await store.heartbeat({ installation_id: UUID_A, platform: "android", version: "1.0", now: 200 });
  const stats = await store.stats(80);

  assert.match(calls[0].sql, /ON CONFLICT\(installation_id\) DO UPDATE/);
  assert.deepEqual(calls[0].values, [UUID_A, "android", "1.0", 200, 15]);
  assert.match(calls[1].sql, /last_seen >= \?1/);
  assert.deepEqual(calls[1].values, [80]);
  assert.deepEqual(stats, { total: 3, online: 2, tracking_since: 100 });
});

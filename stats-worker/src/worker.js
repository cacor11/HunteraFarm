const ONLINE_WINDOW_SECONDS = 120;
const MIN_HEARTBEAT_WRITE_INTERVAL_SECONDS = 15;
const MAX_BODY_BYTES = 1024;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,31}$/;
const PLATFORMS = new Set(["android", "windows"]);

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function asNonNegativeInteger(value) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.trunc(parsed);
}

function toIsoDateTime(epochSeconds) {
  if (epochSeconds === null || epochSeconds === undefined) return null;
  const parsed = Number(epochSeconds);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return new Date(Math.trunc(parsed) * 1000).toISOString();
}

function allowedOrigin(request, env) {
  const configured = String(env?.CORS_ALLOW_ORIGIN ?? "*").trim();
  if (!configured || configured === "*") return "*";

  const origin = request.headers.get("Origin");
  if (!origin) return null;

  const allowed = configured
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

function responseHeaders(request, env, cacheControl) {
  const headers = new Headers({
    "Cache-Control": cacheControl,
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });

  const origin = allowedOrigin(request, env);
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  if (origin && origin !== "*") headers.append("Vary", "Origin");
  return headers;
}

function jsonResponse(request, env, value, status = 200, cacheControl = "no-store") {
  return new Response(JSON.stringify(value), {
    status,
    headers: responseHeaders(request, env, cacheControl),
  });
}

function emptyResponse(request, env, status = 204) {
  const headers = responseHeaders(request, env, "no-store");
  headers.delete("Content-Type");
  return new Response(null, { status, headers });
}

function optionsResponse(request, env) {
  const headers = responseHeaders(request, env, "public, max-age=86400");
  headers.delete("Content-Type");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Max-Age", "86400");
  return new Response(null, { status: 204, headers });
}

function validateHeartbeat(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "invalid_body", "O corpo deve ser um objeto JSON.");
  }

  const installationId = typeof payload.installation_id === "string"
    ? payload.installation_id.trim().toLowerCase()
    : "";
  const platform = typeof payload.platform === "string"
    ? payload.platform.trim().toLowerCase()
    : "";
  const version = typeof payload.version === "string" ? payload.version.trim() : "";

  if (!UUID_PATTERN.test(installationId)) {
    throw new HttpError(400, "invalid_installation_id", "installation_id deve ser um UUID válido.");
  }
  if (!PLATFORMS.has(platform)) {
    throw new HttpError(400, "invalid_platform", "platform deve ser android ou windows.");
  }
  if (!VERSION_PATTERN.test(version)) {
    throw new HttpError(400, "invalid_version", "version deve ter entre 1 e 32 caracteres seguros.");
  }

  return { installation_id: installationId, platform, version };
}

async function readJsonBody(request) {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new HttpError(415, "unsupported_media_type", "Use Content-Type: application/json.");
  }

  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isFinite(parsedLength) || parsedLength < 0) {
      throw new HttpError(400, "invalid_content_length", "Content-Length inválido.");
    }
    if (parsedLength > MAX_BODY_BYTES) {
      throw new HttpError(413, "body_too_large", "O corpo excede o limite permitido.");
    }
  }

  if (!request.body) {
    throw new HttpError(400, "invalid_json", "Envie um objeto JSON válido.");
  }

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new HttpError(413, "body_too_large", "O corpo excede o limite permitido.");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    throw new HttpError(400, "invalid_json", "Envie um objeto JSON válido.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json", "Envie um objeto JSON válido.");
  }
}

export class D1StatsStore {
  constructor(db) {
    if (!db || typeof db.prepare !== "function") {
      throw new Error("D1 binding DB is not configured");
    }
    this.db = db;
  }

  async heartbeat({ installation_id, platform, version, now }) {
    await this.db.prepare(`
      INSERT INTO installations (
        installation_id, platform, version, first_seen, last_seen
      ) VALUES (?1, ?2, ?3, ?4, ?4)
      ON CONFLICT(installation_id) DO UPDATE SET
        platform = excluded.platform,
        version = excluded.version,
        last_seen = excluded.last_seen
      WHERE excluded.last_seen >= installations.last_seen + ?5
         OR installations.platform <> excluded.platform
         OR installations.version <> excluded.version
    `).bind(
      installation_id,
      platform,
      version,
      now,
      MIN_HEARTBEAT_WRITE_INTERVAL_SECONDS,
    ).run();
  }

  async stats(onlineSince) {
    const row = await this.db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM installations WHERE last_seen >= ?1) AS online,
        (SELECT COUNT(*) FROM installations) AS total,
        (SELECT MIN(first_seen) FROM installations) AS tracking_since
    `).bind(onlineSince).first();

    return {
      total: asNonNegativeInteger(row?.total),
      online: asNonNegativeInteger(row?.online),
      tracking_since: row?.tracking_since ?? null,
    };
  }
}

function methodNotAllowed(request, env, allowedMethods) {
  const response = jsonResponse(
    request,
    env,
    { error: "method_not_allowed", message: "Método não permitido." },
    405,
  );
  response.headers.set("Allow", allowedMethods.join(", "));
  return response;
}

export async function handleRequest(request, env = {}, options = {}) {
  const url = new URL(request.url);
  const store = options.store ?? (env.DB ? new D1StatsStore(env.DB) : null);
  const nowSeconds = Math.floor((options.now?.() ?? Date.now()) / 1000);

  if (request.method === "OPTIONS") return optionsResponse(request, env);

  try {
    if (url.pathname === "/heartbeat") {
      if (request.method !== "POST") {
        return methodNotAllowed(request, env, ["POST", "OPTIONS"]);
      }
      if (!store) throw new Error("D1 binding DB is not configured");

      const heartbeat = validateHeartbeat(await readJsonBody(request));
      await store.heartbeat({ ...heartbeat, now: nowSeconds });
      return emptyResponse(request, env);
    }

    if (url.pathname === "/stats") {
      if (request.method !== "GET") {
        return methodNotAllowed(request, env, ["GET", "OPTIONS"]);
      }
      if (!store) throw new Error("D1 binding DB is not configured");

      const stats = await store.stats(nowSeconds - ONLINE_WINDOW_SECONDS);
      return jsonResponse(
        request,
        env,
        {
          online: asNonNegativeInteger(stats.online),
          total: asNonNegativeInteger(stats.total),
          generated_at: toIsoDateTime(nowSeconds),
          tracking_since: toIsoDateTime(stats.tracking_since),
        },
        200,
        "public, max-age=10, stale-while-revalidate=20",
      );
    }

    return jsonResponse(
      request,
      env,
      { error: "not_found", message: "Endpoint não encontrado." },
      404,
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(
        request,
        env,
        { error: error.code, message: error.message },
        error.status,
      );
    }

    return jsonResponse(
      request,
      env,
      { error: "service_unavailable", message: "Estatísticas temporariamente indisponíveis." },
      503,
    );
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};

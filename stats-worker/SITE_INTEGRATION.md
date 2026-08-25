# Integração no site

Use a URL final do Worker no lugar de `https://example.invalid/stats`. O endpoint fica centralizado em uma única constante.

## HTML

Inserir depois de `.hero-strip`:

```html
<section class="usage-stats section-shell" aria-labelledby="usage-stats-title">
  <div class="usage-stats-copy">
    <p class="section-kicker">COMUNIDADE HUNTERAFARM</p>
    <h2 id="usage-stats-title">HunteraFarm em números.</h2>
    <p id="stats-status" role="status" aria-live="polite">Carregando estatísticas anônimas…</p>
  </div>
  <div class="usage-stats-grid" aria-describedby="stats-explanation">
    <article class="usage-stat-card">
      <span class="status-dot" aria-hidden="true"></span>
      <strong id="stats-online">—</strong>
      <span>usando agora</span>
    </article>
    <article class="usage-stat-card">
      <span class="usage-stat-icon" aria-hidden="true">+</span>
      <strong id="stats-total">—</strong>
      <span>já usaram o app</span>
    </article>
  </div>
  <p class="usage-stats-note" id="stats-explanation">
    Valores aproximados por instalação/dispositivo anônimo. “Agora” considera os últimos 2 minutos;
    o total começa na ativação desta medição e não representa downloads ou pessoas garantidamente únicas.
  </p>
</section>
```

## JavaScript

Adicionar próximo às constantes em `site/app.js`:

```js
const STATS_ENDPOINT = 'https://example.invalid/stats';
const STATS_POLL_INTERVAL_MS = 30_000;
const statsNumberFormatter = new Intl.NumberFormat('pt-BR');
let statsTimer = null;

function setStatsStatus(message) {
  const status = document.querySelector('#stats-status');
  if (status) status.textContent = message;
}

async function updateUsageStats() {
  const online = document.querySelector('#stats-online');
  const total = document.querySelector('#stats-total');
  if (!online || !total) return;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(STATS_ENDPOINT, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('stats unavailable');
    const data = await response.json();
    if (!Number.isSafeInteger(data.online) || data.online < 0 ||
        !Number.isSafeInteger(data.total) || data.total < 0) {
      throw new Error('invalid stats');
    }
    online.textContent = statsNumberFormatter.format(data.online);
    total.textContent = statsNumberFormatter.format(data.total);
    setStatsStatus('Estatísticas atualizadas.');
  } catch {
    setStatsStatus('Estatísticas temporariamente indisponíveis.');
  } finally {
    window.clearTimeout(timeout);
  }
}

function scheduleStatsUpdate() {
  window.clearInterval(statsTimer);
  if (document.hidden) return;
  updateUsageStats();
  statsTimer = window.setInterval(updateUsageStats, STATS_POLL_INTERVAL_MS);
}
```

Depois da inicialização existente:

```js
scheduleStatsUpdate();
document.addEventListener('visibilitychange', scheduleStatsUpdate);
```

## CSS

```css
.usage-stats { display: grid; grid-template-columns: .85fr 1.15fr; gap: 42px; align-items: center; padding: 88px 0 34px; }
.usage-stats-copy h2 { margin: 12px 0 9px; font-size: clamp(34px, 4vw, 52px); letter-spacing: -2px; }
.usage-stats-copy > p:last-child { margin: 0; color: #91a198; font-size: 13px; }
.usage-stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.usage-stat-card { min-height: 154px; display: grid; grid-template-columns: auto 1fr; grid-template-rows: 1fr auto; column-gap: 13px; align-items: end; padding: 25px; border: 1px solid var(--line); border-radius: 18px; background: linear-gradient(145deg, rgba(255,255,255,.045), rgba(255,255,255,.018)); }
.usage-stat-card strong { align-self: center; color: var(--lime); font-size: clamp(38px, 5vw, 58px); line-height: 1; letter-spacing: -2px; }
.usage-stat-card > span:last-child { grid-column: 1 / -1; color: #aebbb4; font-size: 13px; font-weight: 700; }
.usage-stat-card .status-dot, .usage-stat-icon { align-self: center; }
.usage-stat-icon { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: rgba(184,255,91,.12); color: var(--lime); font-weight: 900; }
.usage-stats-note { grid-column: 1 / -1; margin: -22px 0 0; color: #65766d; font-size: 11px; line-height: 1.55; }

@media (max-width: 680px) {
  .usage-stats { grid-template-columns: 1fr; gap: 24px; padding-top: 70px; }
  .usage-stats-grid { grid-template-columns: 1fr 1fr; gap: 9px; }
  .usage-stat-card { min-height: 135px; padding: 18px; }
  .usage-stats-note { margin-top: -10px; }
}
```

O fallback `—` permanece legível se o serviço estiver fora do ar. A mensagem com `role="status"` informa a indisponibilidade sem bloquear downloads ou outras funções do site.

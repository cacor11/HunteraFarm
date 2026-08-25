const PIX_PAYLOAD = '00020101021126580014br.gov.bcb.pix01369d2f23e4-d823-4a79-a3aa-545b4b6d3e9a5204000053039865802BR5922ACACIO SANTOS DA SILVA6010POCO VERDE62070503***6304638F';
const GITHUB_OWNER = 'cacor11';
const REPOSITORY_NAME = 'HunteraFarm';
const RELEASE_TAG = 'v1.2.1';
const INSTALLER_NAME = 'HunteraFarm-Setup-1.2.1-x64.exe';
const PORTABLE_NAME = 'HunteraFarm-Sem-Instalar-1.2.1-x64.zip';
const ANDROID_RELEASE_TAG = 'v0.1.3-android-beta';
const ANDROID_APK_NAME = 'HunteraFarm-Android-0.1.3-beta.apk';
const STATS_ENDPOINT = 'https://hunterafarm-stats.yacaciio.workers.dev/stats';
const STATS_POLL_INTERVAL_MS = 30_000;
const statsNumberFormatter = new Intl.NumberFormat('pt-BR');
let statsTimer = null;

function configureDownloads() {
  const releaseUrl = `https://github.com/${GITHUB_OWNER}/${REPOSITORY_NAME}/releases/download/${RELEASE_TAG}/${INSTALLER_NAME}`;
  const portableUrl = `https://github.com/${GITHUB_OWNER}/${REPOSITORY_NAME}/releases/download/${RELEASE_TAG}/${PORTABLE_NAME}`;
  const androidUrl = `https://github.com/${GITHUB_OWNER}/${REPOSITORY_NAME}/releases/download/${ANDROID_RELEASE_TAG}/${ANDROID_APK_NAME}`;
  document.querySelectorAll('.download-link').forEach((link) => {
    link.href = releaseUrl;
  });
  document.querySelectorAll('.portable-download-link').forEach((link) => {
    link.href = portableUrl;
  });
  document.querySelectorAll('.android-download-link').forEach((link) => {
    link.href = androidUrl;
  });
}

async function copyPix() {
  const button = document.querySelector('#copy-pix');
  const label = button.querySelector('span');
  const icon = button.querySelector('span[aria-hidden="true"]');
  const status = document.querySelector('#copy-status');

  try {
    await navigator.clipboard.writeText(PIX_PAYLOAD);
  } catch {
    const field = document.createElement('textarea');
    field.value = PIX_PAYLOAD;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    document.execCommand('copy');
    field.remove();
  }

  label.textContent = 'Código Pix copiado';
  icon.textContent = '✓';
  status.textContent = 'Código Pix copiado.';

  window.setTimeout(() => {
    label.textContent = 'Copiar código Pix';
    icon.textContent = '⧉';
    status.textContent = '';
  }, 2600);
}

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
  statsTimer = null;
  if (document.hidden) return;
  updateUsageStats();
  statsTimer = window.setInterval(updateUsageStats, STATS_POLL_INTERVAL_MS);
}

configureDownloads();
document.querySelector('#copy-pix').addEventListener('click', copyPix);
scheduleStatsUpdate();
document.addEventListener('visibilitychange', scheduleStatsUpdate);

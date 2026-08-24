const PIX_PAYLOAD = '00020101021126580014br.gov.bcb.pix01369d2f23e4-d823-4a79-a3aa-545b4b6d3e9a5204000053039865802BR5922ACACIO SANTOS DA SILVA6010POCO VERDE62070503***6304638F';
const GITHUB_OWNER = 'cacor11';
const REPOSITORY_NAME = 'HunteraFarm';
const RELEASE_TAG = 'v1.2.0';
const INSTALLER_NAME = 'HunteraFarm-Setup-1.2.0-x64.exe';
const PORTABLE_NAME = 'HunteraFarm-Sem-Instalar-1.2.0-x64.zip';

function configureDownloads() {
  const releaseUrl = `https://github.com/${GITHUB_OWNER}/${REPOSITORY_NAME}/releases/download/${RELEASE_TAG}/${INSTALLER_NAME}`;
  const portableUrl = `https://github.com/${GITHUB_OWNER}/${REPOSITORY_NAME}/releases/download/${RELEASE_TAG}/${PORTABLE_NAME}`;
  document.querySelectorAll('.download-link').forEach((link) => {
    link.href = releaseUrl;
  });
  document.querySelectorAll('.portable-download-link').forEach((link) => {
    link.href = portableUrl;
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

configureDownloads();
document.querySelector('#copy-pix').addEventListener('click', copyPix);

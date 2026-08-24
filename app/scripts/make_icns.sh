#!/usr/bin/env bash
# Gera assets/icon.icns a partir de assets/icon-source.png.
# Requer macOS: sips e iconutil já vêm com o sistema.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_png="${root}/assets/icon-source.png"

if [ ! -f "${source_png}" ]; then
  echo "Fonte do ícone não encontrada: ${source_png}" >&2
  exit 1
fi

workdir="$(mktemp -d)"
trap 'rm -rf "${workdir}"' EXIT
iconset="${workdir}/icon.iconset"
mkdir -p "${iconset}"

for size in 16 32 128 256 512; do
  sips -z "${size}" "${size}" "${source_png}" --out "${iconset}/icon_${size}x${size}.png" >/dev/null
  sips -z "$((size * 2))" "$((size * 2))" "${source_png}" \
    --out "${iconset}/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "${iconset}" -o "${root}/assets/icon.icns"
echo "Ícone gerado: ${root}/assets/icon.icns"

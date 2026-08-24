# Code signing policy

## Objetivo

O HunteraFarm busca oferecer downloads rastreáveis e verificáveis. A partir da versão 1.2, um lançamento público para Windows só deve ser promovido no site depois de passar pelos testes automatizados e receber uma assinatura Authenticode válida.

## Origem do binário

1. O código do lançamento deve corresponder a uma tag pública deste repositório.
2. As dependências são fixadas por [`app/pnpm-lock.yaml`](app/pnpm-lock.yaml).
3. O GitHub Actions executa os testes de unidade e de ciclo de vida antes de empacotar o aplicativo.
4. Os arquivos EXE e ZIP recebem hashes SHA-256 e uma atestação de procedência do GitHub.
5. A assinatura final deve usar um certificado Authenticode confiável ou o serviço da SignPath Foundation, caso o projeto seja aprovado, e incluir carimbo de tempo quando o provedor permitir.

A atestação do GitHub prova a origem de uma compilação, mas não substitui a assinatura Authenticode reconhecida pelo Windows.

## Proteção das chaves

Certificados, senhas e chaves privadas não são armazenados no código-fonte. Quando usados, ficam somente no armazenamento protegido do provedor de assinatura ou nos segredos do ambiente de compilação.

Certificados autoassinados não são usados em lançamentos públicos, pois não estabelecem confiança em outros computadores.

## Verificação pelo usuário

Em um lançamento assinado, o usuário pode abrir **Propriedades > Assinaturas Digitais** no instalador e confirmar o editor e a validade da assinatura. No PowerShell, a mesma verificação pode ser feita com `Get-AuthenticodeSignature .\\HunteraFarm-Setup-VERSAO-x64.exe`.

O SHA-256 também pode ser comparado com o arquivo `SHA256SUMS.txt` publicado junto ao lançamento usando `certutil -hashfile HunteraFarm-Setup-VERSAO-x64.exe SHA256`.

## Estado atual

A versão pública estável 1.1 foi lançada antes desta política. A versão 1.2 está em preparação e não será definida como download estável enquanto não concluir o processo de assinatura.

Detalhes para mantenedores estão em [`app/SIGNING.md`](app/SIGNING.md).

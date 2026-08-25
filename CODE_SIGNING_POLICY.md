# Code signing policy

## Objetivo

O HunteraFarm busca oferecer downloads rastreáveis e verificáveis. Uma versão pública para Windows deve passar pelos testes automatizados e, preferencialmente, receber uma assinatura Authenticode válida. Enquanto um certificado não estiver disponível, uma exceção sem assinatura exige autorização explícita do mantenedor, tag pública, hashes SHA-256 e aviso destacado no site e na Release. Quando disponível, uma compilação de revisão atestada deve ser vinculada como evidência adicional da origem.

## Origem do binário

1. O código do lançamento deve corresponder a uma tag pública deste repositório.
2. As dependências são fixadas por [`app/pnpm-lock.yaml`](app/pnpm-lock.yaml).
3. O GitHub Actions executa os testes de unidade e de ciclo de vida antes de empacotar o aplicativo.
4. Os arquivos EXE e ZIP recebem hashes SHA-256 e uma atestação de procedência do GitHub.
5. Quando disponível, a assinatura final deve usar um certificado Authenticode confiável ou o serviço da SignPath Foundation, caso o projeto seja aprovado, e incluir carimbo de tempo quando o provedor permitir.

A atestação do GitHub prova a origem de uma compilação, mas não substitui a assinatura Authenticode reconhecida pelo Windows.

## Proteção das chaves

Certificados, senhas e chaves privadas não são armazenados no código-fonte. Quando usados, ficam somente no armazenamento protegido do provedor de assinatura ou nos segredos do ambiente de compilação.

Certificados autoassinados não são usados em lançamentos públicos, pois não estabelecem confiança em outros computadores.

## Verificação pelo usuário

Em um lançamento assinado, o usuário pode abrir **Propriedades > Assinaturas Digitais** no instalador e confirmar o editor e a validade da assinatura. No PowerShell, a mesma verificação pode ser feita com `Get-AuthenticodeSignature .\\HunteraFarm-Setup-VERSAO-x64.exe`. Em uma exceção sem assinatura, o resultado esperado é `NotSigned`, que deve ser informado publicamente.

O SHA-256 também pode ser comparado com o arquivo `SHA256SUMS.txt` publicado junto ao lançamento usando `certutil -hashfile HunteraFarm-Setup-VERSAO-x64.exe SHA256`.

## Estado atual

As versões 1.2.0 e 1.2.1 foram autorizadas como exceções públicas sem assinatura Authenticode, condicionadas à aprovação dos testes e à publicação de hashes. Quando disponível, uma compilação de revisão do mesmo commit também recebe atestação de procedência do GitHub; os arquivos da Release possuem seus próprios hashes publicados. O site e a Release informam que o Windows pode exibir o SmartScreen. O objetivo continua sendo assinar uma compilação futura assim que houver certificado confiável ou aprovação na SignPath Foundation.

Detalhes para mantenedores estão em [`app/SIGNING.md`](app/SIGNING.md).

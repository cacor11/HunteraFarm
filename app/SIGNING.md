# Assinatura de código

## Política de assinatura de código

O HunteraFarm publica o código-fonte correspondente às versões distribuídas. Uma
versão assinada só pode ser criada a partir de uma tag pública, com dependências
fixadas pelo `pnpm-lock.yaml`, testes aprovados e hashes SHA-256 publicados junto aos
downloads.

As chaves privadas nunca devem ser adicionadas ao repositório. O processo aceita:

- certificado Authenticode válido por `WIN_CSC_LINK` e `WIN_CSC_KEY_PASSWORD`; ou
- assinatura gerenciada pela SignPath Foundation, depois que o projeto for aprovado.

Certificados autoassinados não são usados em versões públicas, pois não estabelecem
confiança para outros computadores Windows.

## Compilação local verificável

Requisitos: Windows x64, Node.js 22.12 ou superior e pnpm.

```text
pnpm install --frozen-lockfile
pnpm test
pnpm smoke
pnpm smoke:lifecycle
pnpm dist
```

## Compilação com certificado Authenticode

Configure as credenciais somente no ambiente protegido da compilação e execute:

```text
pnpm install --frozen-lockfile
pnpm test
pnpm dist:signed
```

`dist:signed` ativa `forceCodeSigning`; a compilação falha caso o certificado não
esteja disponível ou algum executável não possa ser assinado.

Depois da compilação, confirme a assinatura de cada EXE com o Authenticode e gere um
arquivo `SHA256SUMS.txt` para acompanhar a versão.

## SignPath Foundation

O projeto mantém licença MIT, código-fonte público e uma cadeia de compilação auditável para
se candidatar ao programa gratuito de assinatura de projetos open source. A integração
final exige os identificadores e o token fornecidos pela SignPath após a aprovação.

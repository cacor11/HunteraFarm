# HunteraFarm

Player não oficial para Windows que reúne de uma a quatro contas do Huntera em uma única janela, com sessões separadas.

Site público: <https://cacor11.github.io/HunteraFarm/>

## Versões

- **Versão disponível no site:** `v1.2.0`, em instalador EXE e pacote portátil ZIP.
- **Versão anterior no histórico:** `v1.1.0`.

A versão 1.2 inicia com uma conta para economizar memória e permite adicionar ou fechar telas individualmente até o limite de quatro. Ela passou pelos testes automatizados e os arquivos públicos possuem hashes SHA-256. Uma compilação de revisão do mesmo commit recebeu atestação de procedência, mas a Release foi publicada antes da assinatura Authenticode por decisão explícita do mantenedor. Por isso, o Windows pode exibir um aviso do SmartScreen.

## Código do aplicativo

O código-fonte do player fica em [`app`](app). Para testar e compilar no Windows:

```text
cd app
pnpm install --frozen-lockfile
pnpm test
pnpm smoke
pnpm smoke:lifecycle
pnpm dist
```

O fluxo de integração contínua repete esses testes, cria os pacotes de revisão e publica os hashes SHA-256. A procedência gerada pelo GitHub não substitui a assinatura Authenticode do Windows.

## Site

O conteúdo público fica em [`site`](site) e é publicado automaticamente pelo GitHub Pages.

## Segurança e assinatura

Consulte a [Code signing policy](CODE_SIGNING_POLICY.md) e a [política de segurança](.github/SECURITY.md). Chaves privadas e certificados nunca são armazenados neste repositório.

## Licença e aviso

O código do HunteraFarm é disponibilizado sob a [licença MIT](LICENSE). HunteraFarm é um projeto independente e não oficial, sem vínculo com o Huntera ou seus responsáveis.

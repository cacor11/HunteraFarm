# HunteraFarm

Player não oficial para Android e Windows que reúne de uma a quatro contas do Huntera em uma única janela, com sessões separadas.

Site público: <https://cacor11.github.io/HunteraFarm/>

## Versões

- **Windows:** `v1.2.1`, em instalador EXE e pacote portátil ZIP.
- **Android:** `v0.1.3-android-beta`, em APK para Android 7 ou superior.

No Windows, a versão 1.2.1 inicia com uma conta para economizar memória e permite adicionar ou fechar telas individualmente até o limite de quatro. No Android, a versão 0.1.3 beta mantém até quatro telas carregadas em aparelhos compatíveis e permite fechá-las separadamente para liberar memória.

As duas versões incluem uma contagem anônima opcional. Quando ativada, ela envia apenas um identificador aleatório da instalação, a plataforma e a versão para exibir no site quantas instalações foram vistas e quantas estiveram ativas nos últimos dois minutos. A contagem começa nessas versões e não inclui o uso anterior. Consulte a [política de privacidade da medição](stats-worker/PRIVACY.md).

Os arquivos públicos passam pelos testes automatizados e são acompanhados por hashes SHA-256. A versão Windows é publicada sem assinatura Authenticode por decisão explícita do mantenedor e, por isso, o Windows pode exibir um aviso do SmartScreen.

## Código dos aplicativos

O código-fonte do player para Windows fica em [`app`](app). Para testar e compilar:

```text
cd app
pnpm install --frozen-lockfile
pnpm test
pnpm smoke
pnpm smoke:lifecycle
pnpm dist
```

O fluxo de integração contínua repete esses testes, cria os pacotes de revisão e publica os hashes SHA-256. A procedência gerada pelo GitHub não substitui a assinatura Authenticode do Windows.

O aplicativo móvel fica em [`android`](android), e o serviço anônimo dos contadores fica em [`stats-worker`](stats-worker).

## Site

O conteúdo público fica em [`site`](site) e é publicado automaticamente pelo GitHub Pages.

## Segurança e assinatura

Consulte a [Code signing policy](CODE_SIGNING_POLICY.md) e a [política de segurança](.github/SECURITY.md). Chaves privadas e certificados nunca são armazenados neste repositório.

## Licença e aviso

O código do HunteraFarm é disponibilizado sob a [licença MIT](LICENSE). HunteraFarm é um projeto independente e não oficial, sem vínculo com o Huntera ou seus responsáveis.

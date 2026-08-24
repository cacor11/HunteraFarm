# HunteraFarm

Cliente desktop **não oficial** para abrir de uma a quatro contas do [Huntera](https://huntera.com.br/game) ao mesmo tempo.

## O que ele faz

- Abre uma tela por padrão para consumir menos memória e permite adicionar até quatro sessões persistentes e separadas.
- Fecha qualquer tela que não estiver em uso para destruir o navegador daquela conta e liberar memória RAM.
- Reabrir uma tela usa a mesma partição persistente, mantendo o login salvo.
- Alterna entre as contas com abas ou mostra todas as telas abertas juntas.
- Telas que ficam em segundo plano usam o modo de economia do Chromium.
- Mantém a conta escondida ativa, sem copiar teclado ou mouse entre as contas.
- Permite recarregar, silenciar e limpar somente a sessão selecionada.
- Inclui uma área opcional de apoio via Pix dentro do player.
- Não contém bot, macro, automação, leitura de senha ou modificação do jogo.

## Atalhos

- `Ctrl+1` a `Ctrl+4`: selecionar uma conta.
- `Ctrl+Shift+L`: alternar entre uma conta e a grade 2×2.
- `Ctrl+R`: recarregar a conta selecionada.
- `Ctrl+M`: silenciar a conta selecionada.
- `F11`: entrar ou sair da tela cheia.

## Desenvolvimento

```text
pnpm install
pnpm test
pnpm start
pnpm dist
```

Use `pnpm smoke:lifecycle` para testar a criação e destruição das telas. A compilação
assinada exige credenciais Authenticode válidas e usa `pnpm dist:signed`.

Os logins ficam apenas nas partições locais do Electron, dentro dos dados do usuário do HunteraFarm. Ao usar **Limpar sessão**, somente a conta selecionada é apagada.

A opção sem instalação é distribuída em ZIP. Ela também mantém os logins no perfil do
Windows; fechar uma tela não apaga a sessão daquela conta.

## Política de assinatura de código

As versões públicas devem ser construídas a partir deste código, testadas e assinadas
com Authenticode antes da publicação. Consulte `SIGNING.md` para o processo e para a
forma de verificar os hashes dos arquivos.

O HunteraFarm não é afiliado ao Huntera. Confirme e respeite as regras do jogo sobre o uso simultâneo de contas.

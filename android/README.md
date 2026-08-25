# HunteraFarm para Android

Versão móvel do HunteraFarm. O aplicativo começa com uma conta e permite abrir até quatro perfis separados em aparelhos compatíveis.

## Como funciona

- cada conta aberta mantém sua própria `WebView` carregada;
- trocar de conta apenas oculta uma tela e mostra a outra, sem criar uma nova navegação ou recarregar a página;
- o estado visível do jogo, a rolagem e os campos da conta permanecem na tela enquanto o Android mantiver o processo;
- fechar uma conta destrói somente a `WebView` daquela tela e libera sua memória;
- cookies e login continuam salvos no perfil isolado daquela conta;
- redirecionamentos externos nunca recarregam a conta automaticamente;
- a última página só é salva depois de concluir o carregamento;
- contas 2 a 4 só são habilitadas quando o Android System WebView oferece perfis isolados;
- em aparelhos incompatíveis, o app limita o uso a uma conta para não misturar logins;
- links fora do domínio Huntera são abertos no navegador padrão;
- não há bot, macro ou automação;
- a contagem anônima envia apenas um identificador aleatório da instalação, `android` e a versão do app enquanto ele está em primeiro plano; ela pode ser desligada imediatamente pelo botão **Uso ON/OFF**.

O primeiro acesso de cada perfil abre a página oficial do jogo. Depois disso, as contas abertas permanecem carregadas para troca imediata. Manter até quatro telas ativas usa mais RAM, bateria e processamento. Sob forte pressão de memória, o próprio Android ainda pode encerrar uma tela; nesse caso, o HunteraFarm aguarda o usuário tocar em **Atualizar** em vez de iniciar um ciclo de recargas.

## Estado da versão

`0.1.3-beta` é uma versão de teste distribuída como APK. Esta atualização mantém até quatro contas abertas na memória, deixa o botão **Fechar** liberar somente a tela escolhida e adiciona uma contagem anônima opcional de instalações totais e online. Redirecionamentos externos ou uma tela encerrada pelo Android exigem recarga manual para evitar repetição automática. O fluxo normal de login do Huntera precisa ser validado em aparelhos reais. O login com Google pode ser recusado porque o Google não permite OAuth em navegadores incorporados; isso depende de uma integração oficial do Huntera. Como esta beta usa assinatura de desenvolvimento, a instalação poderá exigir a desinstalação da versão anterior.

## Privacidade da contagem

Quando a contagem está ligada, o app envia um pequeno `POST` aproximadamente uma vez por minuto e somente enquanto a Activity está em primeiro plano. O corpo contém exatamente três campos: `installation_id` (UUID aleatório salvo nas preferências privadas do app), `platform` (`android`) e `version`. Ele não lê nem envia login, nome, senha, cookies, URL, conteúdo do jogo ou dados das contas.

O botão **Uso ON/OFF** abre a explicação completa e permite desativar ou reativar a contagem. Ao desativar, o agendamento e uma eventual conexão em andamento são interrompidos imediatamente; a preferência permanece desligada nas próximas aberturas. O total representa instalações aproximadas, não pessoas identificadas, e uma reinstalação pode receber outro UUID.

O endereço público fica centralizado na constante `HEARTBEAT_ENDPOINT`, em `AnonymousUsageReporter.java`. O Worker grava apenas o UUID aleatório, plataforma, versão e os horários da primeira e última aparição.

Veja [BUILDING.md](BUILDING.md) para compilar e validar o projeto.

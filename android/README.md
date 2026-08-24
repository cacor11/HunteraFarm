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
- não há bot, macro, automação ou coleta de dados.

O primeiro acesso de cada perfil abre a página oficial do jogo. Depois disso, as contas abertas permanecem carregadas para troca imediata. Manter até quatro telas ativas usa mais RAM, bateria e processamento. Sob forte pressão de memória, o próprio Android ainda pode encerrar uma tela; nesse caso, o HunteraFarm aguarda o usuário tocar em **Atualizar** em vez de iniciar um ciclo de recargas.

## Estado da versão

`0.1.2-beta` é uma versão de teste distribuída como APK. Esta atualização mantém até quatro contas abertas na memória e deixa o botão **Fechar** liberar somente a tela escolhida. Redirecionamentos externos ou uma tela encerrada pelo Android exigem recarga manual para evitar repetição automática. O fluxo normal de login do Huntera precisa ser validado em aparelhos reais. O login com Google pode ser recusado porque o Google não permite OAuth em navegadores incorporados; isso depende de uma integração oficial do Huntera. Como esta beta usa assinatura de desenvolvimento, a instalação poderá exigir a desinstalação da versão anterior.

Veja [BUILDING.md](BUILDING.md) para compilar e validar o projeto.

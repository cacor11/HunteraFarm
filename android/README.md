# HunteraFarm para Android

Versão móvel leve do HunteraFarm. O aplicativo começa com uma conta e permite salvar até quatro perfis separados em aparelhos compatíveis.

## Como funciona

- somente a conta selecionada mantém uma `WebView` carregada;
- ao trocar ou fechar uma tela, a `WebView` anterior é destruída para liberar memória;
- cookies e login continuam salvos no perfil daquela conta;
- redirecionamentos externos nunca recarregam a conta automaticamente;
- a última página só é salva depois de concluir o carregamento;
- contas 2 a 4 só são habilitadas quando o Android System WebView oferece perfis isolados;
- em aparelhos incompatíveis, o app limita o uso a uma conta para não misturar logins;
- links fora do domínio Huntera são abertos no navegador padrão;
- não há bot, macro, automação ou coleta de dados.

O primeiro acesso de cada perfil abre a página oficial do jogo. As quatro contas não ficam carregadas ao mesmo tempo: somente a selecionada mantém uma `WebView` carregada.

## Estado da versão

`0.1.1-beta` é uma versão de teste distribuída como APK. Esta atualização impede o ciclo de recarga automática após redirecionamentos externos e tenta preservar a tela durante recriações normais da Activity. O fluxo normal de login do Huntera precisa ser validado em aparelhos reais. O login com Google pode ser recusado porque o Google não permite OAuth em navegadores incorporados; isso depende de uma integração oficial do Huntera. Como esta beta usa assinatura de desenvolvimento, uma atualização futura poderá exigir a desinstalação da versão anterior.

Veja [BUILDING.md](BUILDING.md) para compilar e validar o projeto.

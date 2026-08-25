# Privacidade das estatísticas do HunteraFarm

Quando a medição estiver ativada, o aplicativo enviará periodicamente apenas:

- um identificador aleatório da instalação (UUID), criado pelo próprio aplicativo;
- a plataforma (`android` ou `windows`);
- a versão do HunteraFarm.

O serviço registra a primeira e a última vez em que esse identificador foi visto. O código do HunteraFarm não lê, usa nem grava no banco nome, login, personagem, conteúdo do jogo, identificador de hardware, endereço IP ou User-Agent. Como provedora da infraestrutura, a Cloudflare processa os metadados técnicos necessários para entregar a requisição conforme a política dela. O UUID não deve ser derivado de IMEI, Android ID, MAC ou qualquer outro identificador do aparelho.

“Usando agora” é uma estimativa das instalações que enviaram sinal nos últimos 120 segundos. “Já usaram” é o total de UUIDs únicos observados desde a ativação da medição; não representa downloads nem pessoas únicas. Reinstalar ou limpar os dados do aplicativo pode gerar um novo UUID.

Desligar a medição interrompe imediatamente os novos sinais. O registro anônimo de primeira e última atividade que já tiver sido enviado permanece no total histórico, sem login ou dados do jogo.

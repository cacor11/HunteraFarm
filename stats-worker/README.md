# Estatísticas anônimas do HunteraFarm

Cloudflare Worker com D1 para exibir duas métricas aproximadas:

- `online`: instalações que enviaram um sinal nos últimos 120 segundos;
- `total`: instalações anônimas únicas observadas desde a ativação.

O código do serviço não lê nem grava no D1 IP, User-Agent, conta, personagem ou conteúdo do jogo. A infraestrutura Cloudflare ainda processa os metadados técnicos necessários para entregar cada requisição. Leia [PRIVACY.md](./PRIVACY.md).

## API

### `POST /heartbeat`

Corpo JSON exato:

```json
{
  "installation_id": "b7d980cf-7fab-47b0-834b-832b5bee69ab",
  "platform": "android",
  "version": "0.1.3-beta"
}
```

O aplicativo deve criar `installation_id` uma única vez com um UUID aleatório e persistir esse valor. Nunca derive o UUID de um identificador do aparelho. Envie o sinal enquanto o aplicativo estiver ativo, no máximo uma vez a cada 60 segundos. Resposta de sucesso: `204 No Content`.

### `GET /stats`

```json
{
  "online": 12,
  "total": 184,
  "generated_at": "2026-08-25T12:00:30.000Z",
  "tracking_since": "2026-08-25T09:15:00.000Z"
}
```

`tracking_since` é `null` até chegar o primeiro sinal. O total começa em zero na ativação e representa instalações/dispositivos anônimos, não downloads nem pessoas garantidamente únicas.

## Publicar no Cloudflare

Pré-requisitos: Node.js, uma conta Cloudflare e Wrangler autenticado.

1. Entre nesta pasta e execute `npx wrangler login`.
2. O banco `hunterafarm-stats` e seu `database_id` já estão configurados em `wrangler.toml` para a implantação oficial. Para outra conta, crie um novo banco e atualize esse ID.
3. Aplique o esquema remoto: `npx wrangler d1 migrations apply hunterafarm-stats --remote`.
4. Publique: `npx wrangler deploy`.
5. Teste `https://hunterafarm-stats.yacaciio.workers.dev/stats`.

Para testar em outra origem antes da publicação, use temporariamente `CORS_ALLOW_ORIGIN = "*"`. Em produção, mantenha `https://cacor11.github.io` ou uma lista separada por vírgulas.

## Proteções

- corpo máximo de 1 KiB;
- UUID canônico e plataformas/versões validadas;
- UPSERT que preserva `first_seen` e limita gravações repetidas do mesmo UUID a uma a cada 15 segundos;
- resposta pública de `/stats` em cache por apenas 10 segundos;
- nenhuma leitura, log ou persistência de IP e User-Agent no código da aplicação.

Uma API pública não consegue impedir completamente UUIDs falsos sem autenticar os aplicativos. O total deve ser apresentado como uma estimativa.

## Testes locais

Não exigem Wrangler, D1 ou acesso à internet:

```text
npm test
npm run check
```

# Compilando o HunteraFarm para Android

## Requisitos

- Android Studio com o Android SDK instalado;
- JDK 17;
- Gradle 9.5.0, caso a compilacao seja feita pelo terminal;
- acesso a internet na primeira compilacao, para baixar as dependencias.

O workflow do GitHub instala automaticamente a versao correta do Gradle. No computador, o Android Studio tambem pode importar e compilar o projeto sem que seja necessario executar comandos manualmente.

## Gerar e validar o APK beta

Abra um terminal na pasta `android` e execute:

No Windows:

```powershell
gradle lintDebug testDebugUnitTest assembleDebug
```

No Linux ou macOS:

```bash
gradle lintDebug testDebugUnitTest assembleDebug
```

Se tudo terminar corretamente, o APK local sera criado em:

```text
app/build/outputs/apk/debug/app-debug.apk
```

Tambem e possivel abrir a pasta `android` no Android Studio e executar a configuracao `app` em um celular conectado ou emulador.

## Compilacao automatica no GitHub

O workflow `Android Beta` executa analise do codigo, testes unitarios e a compilacao sempre que houver mudancas no projeto Android. Ao terminar, o APK pode ser baixado na pagina da execucao, na secao **Artifacts**, com o nome `HunteraFarm-Android-Beta-*`.

Dentro do artefato, o arquivo publico se chama `HunteraFarm-Android-0.1.1-beta.apk` e acompanha um `SHA256SUMS.txt` para verificacao de integridade.

## Aviso sobre a assinatura

O arquivo `app-debug.apk` e uma versao beta para testes. Ele e assinado automaticamente com uma chave de desenvolvimento e nao representa a assinatura definitiva do HunteraFarm.

Para publicar na Google Play, sera necessario criar e proteger uma chave de lancamento, configurar a compilacao `release` e gerar um Android App Bundle (`.aab`). A chave privada de lancamento nunca deve ser adicionada ao repositorio.

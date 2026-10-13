# Rift Wave Arena 4.3 · Multiplayer cooperativo

## Estado atual

- ✅ Interface e arena 3D cooperativa prontas.
- ✅ Servidor WebSocket Node.js sem bibliotecas externas.
- ✅ Salas privadas com código de 6 caracteres e até 4 participantes.
- ✅ Compartilhamento de posições, drones, ondas, vida, placar e revive.
- ✅ 24 testes automatizados passaram, incluindo dois jogadores conectados de verdade no mesmo servidor local.
- ⚠️ O servidor público ainda precisa ser hospedado: sem um endereço `wss://`, o multiplayer online não vai conectar.
- ⚠️ É o MVP cooperativo, independente do modo solo; os upgrades, todas as armas e a progressão do modo solo ainda não foram portados para a arena multiplayer.

## Como ativar online pelo Android, sem PC

### Opção recomendada: GitHub + Render

1. Faça login em https://github.com e crie um repositório **novo** chamado `rift-wave-multiplayer-server`. Deixe público (o código não contém chaves ou segredos). O site da GitHub pode ser usado pelo navegador do Android. Não publique tokens ou senhas nele.
2. Adicione os três arquivos da pasta `server/` do ZIP: `package.json`, `ws-lite.mjs` e `game-server.mjs`. Preserve a pasta `server/`. Como alternativa, envie também `server/render.yaml` (não é obrigatório).
3. Abra https://dashboard.render.com/ e crie uma conta, se necessário. Toque em **New → Web Service**.
4. Conecte sua conta GitHub ao Render e escolha o repositório.
5. Preencha:
   - **Name:** `rift-wave-multiplayer` (se disponível; pode ser outro)
   - **Language / Runtime:** `Node`
   - **Branch:** `main`
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance:** `Free` (se estiver disponível)
   - **Health Check Path:** `/health`
   - **Environment Variable (opcional):** `ALLOWED_ORIGIN=https://rift-wave-arena.vercel.app`
6. Clique em **Deploy Web Service**. Espere a mensagem de que o serviço está disponível. Você receberá um endereço real, por exemplo `https://SEU-NOME.onrender.com` (exemplo, não é um servidor já ativo).
7. Abra `https://SEU-NOME.onrender.com/health` no navegador. O resultado deve conter `"ok":true`.
8. Abra https://rift-wave-arena.vercel.app/multiplayer.html ou use o botão **Multiplayer online** do menu principal.
9. No campo **Servidor multiplayer**, cole o endereço real trocando `https` por `wss` e acrescentando `/ws`: `wss://SEU-NOME.onrender.com/ws`.
10. Digite seu apelido e pressione **CRIAR SALA**. Copie o código de 6 caracteres. Seu amigo abre a mesma tela, coloca o mesmo endereço do servidor, seu apelido e o código em **ENTRAR**.
11. O criador da sala pressiona **INICIAR PARTIDA**. Pronto: uma única onda e os mesmos drones para todos.

**Importante:** Render Free hiberna com aproximadamente 15 minutos sem tráfego. A primeira conexão pode levar cerca de 1 minuto para acordar o servidor. O servidor não é um recurso do Vercel. Usuários do APK antigo recebem a interface multiplayer automaticamente porque ela é servida pelo mesmo domínio; mas ainda precisam configurar o endereço WSS uma vez.

### Sem GitHub ainda?

Crie primeiro o repositório vazio pela página https://github.com/new e me diga **o nome do repositório**. Posso tentar preencher os arquivos do servidor pela integração com GitHub ligada ao ChatGPT, se seu repositório estiver visível para ela.

## Testes locais (para quem tiver Node.js)

Dentro de `server/`:

```bash
node --test game-server.test.mjs
node game-server.mjs
```

Depois sirva os arquivos do jogo por HTTP na porta 5173, abra `http://localhost:5173/multiplayer.html` e use `ws://localhost:3000/ws` como servidor. Não use conexão `ws://` num site `https://` porque navegadores modernos bloqueiam conteúdo misto.

## Resumo de arquitetura

- Hospedagem web: Vercel (HTML, CSS e Three.js)
- Partida: servidor Node WebSocket de longa duração (Render ou outro provedor com suporte WebSocket)
- Simulação compartilhada: tick 20 Hz; snapshots 10 Hz
- Código de salas aleatório e anfitrião com comando de iniciar
- Sem cadastro, sem chat público, sem pagamentos e sem dados pessoais obrigatórios
- O código de sala **não** é autenticação forte; envie-o apenas para amigos
- O servidor mantém salas em memória. Reinícios encerram as salas abertas

## Limitações conhecidas desta primeira versão

O modo cooperativo tem dinâmica própria e ações básicas. Ele não é ainda o sistema completo de build, raridades e 23 armas do modo solo. Sem servidor hospedado, o botão Multiplayer apenas abre a tela de salas. A movimentação é mostrada aos demais por snapshots, sem predição avançada nem rollback. Teste a latência e o FPS no Android antes de ampliar a quantidade de jogadores.
# RIFT WAVE ARENA 4.4 · MULTIPLAYER COM ARSENAL ORIGINAL

O modo solo original permanece completo na página principal `index.html`. O novo cooperativo é acessado por `/coop.html` e usa o mesmo catálogo `core.mjs` e os mesmos modelos procedurais `models.mjs` de **23 armas 3D**, incluindo todas as sete raridades (a Divina fica disponível somente a partir da onda 12).

## Como jogar

1. Abra https://rift-wave-arena.vercel.app/coop.html no aplicativo ou navegador.
2. Crie a sala e envie o código de seis caracteres. Até 4 pessoas por sala, inclusive em casas diferentes.
3. Cada jogador começa com PULSO M1 3D. Os três slots de inventário aparecem na tela; 1, 2 e 3 no teclado ou toque nos slots/↻ no celular.
4. Entre ondas, cada piloto recebe três recompensas (armas ou melhorias). Se o inventário estiver cheio, escolha a arma que deseja substituir.
5. Ative o scanner do VISOR ÔMEGA com E ou botão ◉ no celular, e proteja os colegas que precisam ser revividos (R ou ✚).
6. No lobby, toque nos botões de gráficos e FPS para alternar de LEVE até DDLS5 e de 30 a 120 FPS. As seleções usam o mesmo armazenamento local da campanha solo e dependem da tela e da GPU.

## Integração de servidor e segurança

O cliente usa `wss://rift-wave-multiplayer-server.onrender.com/ws`. O servidor real está no repositório `https://github.com/siwijoo/rift-wave-multiplayer-server`, com a pasta `server` configurada como Root Directory no Render. Entre em `/health` para ver se a versão é `4.4-arsenal`.

O servidor autoriza salas, tiros, cadência, escolha de recompensas, inventário, dano, escudos, movimentação, scanner ÔMEGA e revive. O cliente não controla dano e não pode equipar arma que não possui. O compartilhamento de estado depende do servidor WebSocket, que pode entrar em modo de economia de recursos no Render Free.

A campanha solo conserva as 23 armas, melhorias, ÔMEGA, opções gráficas, o inventário e o modo desenvolvedor. O cooperativo mantém uma seleção de melhorias com efeitos implementados no servidor, mas os contratos, a Fundição, o MOD MENU e toda a progressão da campanha solo ainda não foram portados integralmente para a sessão online. Eles continuam disponíveis no solo.

## Testes

Do diretório raiz: `node --test core.test.mjs eclipse.test.mjs frame-rate.test.mjs graphics.test.mjs integration.test.mjs`
Da pasta `server`: `node --test game-server.test.mjs`

O teste de rede usa duas conexões WebSocket locais, com a mesma sala, troca de arsenal, recompensa de onda e rejeição de trapaça em arma/dano. A verificação visual em um navegador automatizado pode depender do ambiente.
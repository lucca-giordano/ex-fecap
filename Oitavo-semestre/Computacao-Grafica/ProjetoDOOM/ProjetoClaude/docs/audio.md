# Som

Código: `src/audio/dmx.js` (formato DMX), `src/audio/soundMath.js` (volume e estéreo),
`src/audio/channels.js` (canais) e `src/audio/AudioEngine.js` (Web Audio). Página de depuração:
`debug/sounds.html`.

## Formato DMX

Cada som é um lump `DS` + nome (`DSPISTOL` vira o som "pistol"); os `DP*` (alto-falante do PC) ficam de
fora, e em nome repetido vale a última ocorrência. Cabeçalho little-endian de 8 bytes: `uint16` formato
(3), `uint16` taxa em Hz, `uint32` N (amostras, contando 32 bytes de preenchimento). As amostras são de 8
bits sem sinal; os 16 primeiros e os 16 últimos bytes são preenchimento e são descartados, ficando
N − 32 amostras a partir do byte 24. Conversão: `f = (byte − 128) / 128` (128 → 0, 0 → −1,
255 → 0.9921875). Validação: formato 3, N > 32, lump com pelo menos 8 + N bytes (bytes extras no fim são
aceitos) e taxa entre 8000 e 96000 Hz. Lumps inválidos são pulados com aviso.

## Cadeia do Web Audio

`AudioBufferSourceNode` → `GainNode` (volume por distância) → `StereoPannerNode` (pan) → `GainNode`
mestre → saída. Cada som vira um `AudioBuffer` (taxa do lump, um canal) criado uma vez e guardado em
cache. O volume mestre muda com `setTargetAtTime(valor, agora, 0.02)`; ao cortar um canal, o ganho cai a
zero numa rampa linear de 5 ms antes de parar, para não estalar. No evento `ended`, o canal é liberado e
os nós desconectados.

## Volume e posição (S_AdjustSoundParams do Doom)

- Distância aproximada: `|dx| + |dy| − min(|dx|, |dy|) / 2` (P_AproxDistance).
- Volume: 1 até 200 unidades (S_CLOSE_DIST); não toca acima de 1200 (S_CLIPPING_DIST); entre os dois,
  `(1200 − d) / 1000`.
- Pan: `ang` = ângulo do ouvinte até a fonte menos o ângulo do olhar (graus anti-horários do Doom);
  `pan = −0.75 · sin(ang)`. À esquerda (+90°) dá −0.75, à direita (−90°) dá +0.75, na frente e atrás 0.
  O 0.75 corresponde ao S_STEREO_SWING do Doom (96 de 128).
- Volume mestre: `nível · 8 / 127`, nível de 0 a 15 (S_SetSfxVolume); mudo dá 0.
- Sons sem posição (menu, jogador): volume 1 e pan 0. O ouvinte é atualizado a cada frame com a posição
  e o ângulo da câmera em coordenadas do Doom.

## Canais

8 canais (snd_channels do Doom). Uma origem já tocando reutiliza o próprio canal (o som anterior é
cortado; por isso o "oof" corta um tiro em andamento, como no Doom, já que os dois saem do jogador). Sem
isso, usa o primeiro canal livre; com os 8 ocupados, rouba o mais antigo. Sons sem origem (menu) nunca
substituem outros pela origem.

Simplificações em relação ao Doom: sem prioridade por som no roubo de canal (o mais antigo é cortado),
sem pausa dos sons com o menu aberto, sem música, e só os sons do menu, da pistola e da queda. A
infraestrutura posicional existe, mas nenhum som do jogo usa posição nesta etapa.

## Desbloqueio por gesto

O `AudioContext` só é criado no primeiro `pointerdown` ou `keydown` (ouvidos na fase de captura), com
`resume()` se ele nascer suspenso; assim o Chrome não avisa sobre autoplay ao carregar a página. Pedidos
de som antes disso, ou com o contexto parado, são descartados em silêncio, e o som do próprio primeiro
gesto pode ser perdido.

## Integração

- Pistola: cada tiro que gasta munição emite um evento e toca "pistol".
- Queda: o pouso vindo de queda emite um evento com a velocidade vertical de impacto; acima de 280 u/s
  (8 unidades por tic × 35 tics/s, do P_ZMovement do Doom, quedas maiores que 32 unidades) toca "oof".
  Subir degraus não gera evento.
- Menu (como o m_menu.c): mover o cursor "pstop"; mudar um valor "stnmov"; confirmar uma ação ou entrar
  num submenu "pistol"; voltar uma tela "swtchn"; abrir o menu com o jogo começado "swtchn"; fechar o
  menu para retomar o jogo "swtchx".
- Tecla M alterna o mudo; SFX VOLUME (opções) muda o nível.

## Valores padrão

Volume dos efeitos 12 (de 0 a 15) e som ligado, persistidos. O Doom usa 8 por padrão; 12 foi escolhido
porque se ouve melhor numa sala de apresentação.

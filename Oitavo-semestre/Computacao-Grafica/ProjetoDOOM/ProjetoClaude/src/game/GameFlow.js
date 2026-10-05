// Progressão entre mapas (etapa 23), como o G_DoCompleted / G_WorldDone do Doom 1. Puro.

// Volta do mapa secreto quando se entra nele sem passar pela saída secreta (IDCLEV): mapa seguinte ao
// de onde o Doom 1 sai para o secreto em cada episódio (E1M3 -> E1M9 volta ao E1M4, etc.).
export const SECRET_RETURN = { 1: 4, 2: 6, 3: 7, 4: 3 };

// has(episódio, mapa) -> existe. secretReturn: mapa guardado ao entrar no 9 pela saída secreta.
// Devolve { kind: 'map', episode, map } ou { kind: 'finale', episode }.
export function nextMap(episode, map, secretExit, has, secretReturn = null) {
  const go = (m) => (has(episode, m) ? { kind: 'map', episode, map: m } : { kind: 'finale', episode });
  if (secretExit && map !== 9 && has(episode, 9)) return { kind: 'map', episode, map: 9 };
  if (map === 9) return go(secretReturn ?? SECRET_RETURN[episode] ?? 1);
  if (map === 8) return { kind: 'finale', episode }; // fim do episódio, sem intermissão
  return go(map + 1);
}

// Mapa para onde o 9 volta: origem + 1 (guardado ao entrar pela saída secreta).
export const secretReturnFrom = (originMap) => originMap + 1;

// Como o jogador entra em cada mapa, por motivo. player: 'pistol' (G_PlayerReborn: começo do zero),
// 'carry' (G_PlayerFinishLevel) ou 'keep' (nada muda); resetCheats: desliga o modo deus e o noclip.
export const LEVEL_ENTRY = {
  newGame: { player: 'pistol', resetCheats: true },
  idclev: { player: 'pistol', resetCheats: true },
  death: { player: 'pistol', resetCheats: false }, // morrer reinicia o mapa atual
  exit: { player: 'carry', resetCheats: false },
  debugMap: { player: 'carry', resetCheats: false }, // NEXT MAP e PREV MAP
  reload: { player: 'keep', resetCheats: false },   // RELOAD LEVEL
};

// Aplica a entrada ao PlayerStats.
export function applyPlayerEntry(stats, player) {
  if (player === 'pistol') stats.reset();
  else if (player === 'carry') finishLevelCarry(stats);
}

// Estado do jogador ao trocar de mapa (G_PlayerFinishLevel): passam vida, armadura e tipo, armas, arma
// atual, munição e mochila; zeram chaves e contadores de flash. stats: PlayerStats.
export function finishLevelCarry(stats) {
  for (const k of Object.keys(stats.keys)) stats.keys[k] = false;
  stats.damageCount = 0;
  stats.bonusCount = 0;
  stats.lastAttacker = null;
  stats.deathTics = 0;
}

// Sessão de jogo (etapa 23): fases, dificuldade, episódio e mapa atuais. Puro.
// Fases: 'title' (tela de título com o menu), 'loading' (construindo o nível), 'playing',
// 'intermission' (estatísticas da fase) e 'finale' (fim de episódio).
// O jogador (PlayerStats, godMode, noclip) fica fora do nível, no main.

export const PHASES = ['title', 'loading', 'playing', 'intermission', 'finale'];
export const DEFAULT_SKILL = 3;
const MAP_LUMPS = ['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP'];

// Mapas do WAD pelo mesmo critério do loadMap (marcador seguido dos 10 lumps), em ordem de episódio e
// mapa. Sem ExMy: o primeiro MAPxx, como mapa único (sem progressão). Devolve [{ name, episode, map }].
export function listMaps(wad) {
  const found = [];
  wad.lumps.forEach((l, i) => {
    if (!MAP_LUMPS.every((n, k) => wad.lumps[i + 1 + k]?.name === n)) return;
    const m = /^E(\d)M(\d)$/.exec(l.name);
    if (m) found.push({ name: l.name, episode: Number(m[1]), map: Number(m[2]) });
    else if (/^MAP\d\d$/.test(l.name)) found.push({ name: l.name, episode: 0, map: 0 });
  });
  const exmy = found.filter((f) => f.episode > 0).sort((a, b) => a.episode - b.episode || a.map - b.map);
  if (exmy.length) return exmy;
  const first = found[0];
  return first ? [{ name: first.name, episode: 1, map: 1, single: true }] : [];
}

export class GameSession {
  constructor(maps) {
    if (!maps.length) throw new Error('nenhum mapa no WAD');
    this.maps = maps;
    this.phase = 'title';
    this.skill = DEFAULT_SKILL; // 1 a 5, só da sessão (nunca persistido)
    this.episode = maps[0].episode;
    this.map = maps[0].map;
    this.secretReturn = null;   // mapa para onde a saída normal do mapa 9 volta
  }

  episodes() {
    return [...new Set(this.maps.map((m) => m.episode))].sort((a, b) => a - b);
  }

  find(episode, map) {
    return this.maps.find((m) => m.episode === episode && m.map === map) ?? null;
  }

  has(episode, map) { return Boolean(this.find(episode, map)); }

  get current() { return this.find(this.episode, this.map); }

  // Vizinho na lista (debug NEXT MAP e PREV MAP), com volta.
  neighbor(delta) {
    const i = this.maps.findIndex((m) => m.episode === this.episode && m.map === this.map);
    return this.maps[(i + delta + this.maps.length) % this.maps.length];
  }
}

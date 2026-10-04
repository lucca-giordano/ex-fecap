// Estado mutável da fase (etapa 20). Puro.
// As alturas dos setores (map.sectors[i].floorHeight e ceilingHeight) e os nomes de textura das
// sidedefs (map.sidedefs[i].*Texture) passam a mudar em tempo de execução NO PRÓPRIO mapa, para que
// física, visão, hitscan, IA e geometria leiam sempre o valor corrente. As cópias originais ficam
// aqui, para o reset. Os especiais das linhas ficam numa cópia (lineSpecial); o mapa não muda.

import { NO_SIDE } from '../wad/MapData.js';

export const NO_NEIGHBOR = 32000; // Doom: valor inicial das buscas de vizinho (sem vizinho)
export const INTERMISSION_DELAY = 35; // tics entre a saída e a tela de estatísticas

// Esmagamento: todos os alvos vivos do setor s cabem no vão? targets: [{ sector, height }] (jogador
// vivo, monstros e barris vivos; corpos, itens e largados ficam de fora).
export function targetsFit(targets, s, gap) {
  return targets.every((t) => t.sector !== s || t.height <= gap);
}

export class LevelState {
  constructor(map) {
    this.map = map;
    this.sectors = map.sectors;
    this.origHeights = map.sectors.map((s) => ({ floor: s.floorHeight, ceiling: s.ceilingHeight }));
    this.origSpecials = map.linedefs.map((l) => l.special);
    this.lineSpecial = this.origSpecials.slice(); // restaurado NO MESMO array (outros módulos guardam a referência)
    this.origTextures = map.sidedefs.map((s) => ({ upperTexture: s.upperTexture, middleTexture: s.middleTexture, lowerTexture: s.lowerTexture }));

    // tag -> setores; setor -> linedefs que o tocam; setor -> centro da caixa das suas linhas.
    this.tagMap = new Map();
    map.sectors.forEach((s, i) => {
      if (!this.tagMap.has(s.tag)) this.tagMap.set(s.tag, []);
      this.tagMap.get(s.tag).push(i);
    });
    this.sectorLines = map.sectors.map(() => []);
    map.linedefs.forEach((l, li) => {
      for (const sd of [l.rightSidedef, l.leftSidedef]) {
        if (sd === NO_SIDE || !map.sidedefs[sd]) continue;
        const s = map.sidedefs[sd].sector;
        if (this.sectorLines[s] && !this.sectorLines[s].includes(li)) this.sectorLines[s].push(li);
      }
    });
    this.soundOrg = this.sectorLines.map((lines) => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const li of lines) {
        for (const v of [map.vertexes[map.linedefs[li].v1], map.vertexes[map.linedefs[li].v2]]) {
          minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
        }
      }
      return lines.length ? { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } : { x: 0, y: 0 };
    });

    // Avisos de mudança (geometria dinâmica): setor (alturas) e linha (textura).
    this.onSectorChanged = null;
    this.onLineChanged = null;
    this.reset();
  }

  // Restaura alturas, especiais e texturas; remove thinkers e botões; zera o fim de fase e os tempos.
  reset() {
    this.map.sectors.forEach((s, i) => {
      s.floorHeight = this.origHeights[i].floor;
      s.ceilingHeight = this.origHeights[i].ceiling;
    });
    this.origSpecials.forEach((v, i) => { this.lineSpecial[i] = v; });
    this.map.sidedefs.forEach((s, i) => Object.assign(s, this.origTextures[i]));
    this.thinkers = new Map(); // setor -> thinker (porta ou elevador): sector.activeThinker do Doom
    this.buttons = [];         // interruptores SR esperando para voltar
    this.finished = false;
    this.secretExit = false;
    this.finishTics = 0;
    this.levelTics = 0;
    this.lastUse = '-';
    this.unsupportedUses = 0;
  }

  // Setores vizinhos por linhas de dois lados.
  neighbors(s) {
    const out = [];
    for (const li of this.sectorLines[s]) {
      const l = this.map.linedefs[li];
      if (l.leftSidedef === NO_SIDE) continue;
      const a = this.map.sidedefs[l.rightSidedef].sector, b = this.map.sidedefs[l.leftSidedef].sector;
      const other = a === s ? b : a;
      if (other !== s) out.push(other);
    }
    return out;
  }

  // P_FindLowestCeilingSurrounding e P_FindLowestFloorSurrounding (32000 sem vizinho).
  lowestNeighborCeiling(s) {
    return this.neighbors(s).reduce((m, o) => Math.min(m, this.sectors[o].ceilingHeight), NO_NEIGHBOR);
  }

  lowestNeighborFloor(s) {
    return this.neighbors(s).reduce((m, o) => Math.min(m, this.sectors[o].floorHeight), NO_NEIGHBOR);
  }

  setCeiling(s, h) {
    if (this.sectors[s].ceilingHeight === h) return;
    this.sectors[s].ceilingHeight = h;
    this.onSectorChanged?.(s);
  }

  setFloor(s, h) {
    if (this.sectors[s].floorHeight === h) return;
    this.sectors[s].floorHeight = h;
    this.onSectorChanged?.(s);
  }

  setSideTexture(sidedef, where, name) {
    this.map.sidedefs[sidedef][where] = name;
    const li = this.map.linedefs.findIndex((l) => l.rightSidedef === sidedef || l.leftSidedef === sidedef);
    if (li >= 0) this.onLineChanged?.(li);
  }

  // Um tic de jogo ativo: conta o tempo de fase, ou os tics desde o fim da fase.
  advanceClock() {
    if (this.finished) this.finishTics++;
    else this.levelTics++;
  }

  // Tela de estatísticas: 35 tics depois do fim da fase (a simulação congela).
  get intermission() {
    return this.finished && this.finishTics >= INTERMISSION_DELAY;
  }

  // Fim de fase (saídas 11, 51, 52, 124).
  finish(secret) {
    this.finished = true;
    this.secretExit = Boolean(secret);
    this.finishTics = 0;
  }

  // Instantâneo para comparação (verificações): alturas, especiais, texturas e estado.
  snapshot() {
    return JSON.stringify({
      h: this.sectors.map((s) => [s.floorHeight, s.ceilingHeight]),
      sp: this.lineSpecial,
      tx: this.map.sidedefs.map((s) => [s.upperTexture, s.middleTexture, s.lowerTexture]),
      th: [...this.thinkers.keys()], b: this.buttons.length, f: this.finished, t: this.levelTics,
    });
  }
}

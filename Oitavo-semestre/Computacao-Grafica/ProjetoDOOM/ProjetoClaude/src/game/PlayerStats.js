// Estado do jogador: vida, armadura, munição, armas, chaves. Puro: sem DOM e sem WebGPU.
// Valores sempre inteiros. A API antiga (ammoClip, maxClip, addAmmo, spendAmmo sem tipo) continua
// valendo para as balas.

export const INITIAL_HEALTH = 100;  // vida ao começar (Doom: player->health = 100)
export const MAX_HEALTH = 200;      // limite com as esferas (Doom: soulsphere e bônus até 200)
export const MAX_ARMOR = 200;       // armadura máxima (Doom: megaarmor = 200)
export const PISTOL_SLOT = 2;       // slot da pistola no painel de armas
export const FIST_SLOT = 1;         // soco/motosserra

// Munição (Doom: d_items.c / p_inter.c): inicial, máximo sem mochila e tamanho do "clip" de cada tipo.
export const AMMO_TYPES = ['clip', 'shell', 'rocket', 'cell'];
export const INITIAL_AMMO = { clip: 50, shell: 0, rocket: 0, cell: 0 };      // player->ammo[am_clip] = 50
export const MAX_AMMO = { clip: 200, shell: 50, rocket: 50, cell: 300 };     // maxammo[]
export const CLIP_AMMO = { clip: 10, shell: 4, rocket: 1, cell: 20 };        // clipammo[]
export const INITIAL_CLIP = INITIAL_AMMO.clip;
export const MAX_CLIP = MAX_AMMO.clip;

// Armadura: tipo 1 (verde) absorve 1/3 do dano; tipo 2 (azul) absorve 1/2 (P_DamageMobj do Doom).
// A absorção só será usada na etapa de dano ao jogador.
export const ARMOR_NONE = 0;
export const ARMOR_GREEN = 1;
export const ARMOR_BLUE = 2;

export const BONUS_ADD = 6; // bonuscount += 6 a cada coleta (Doom: BONUSADD); decai 1 por tic

export const KEY_NAMES = ['blueCard', 'yellowCard', 'redCard', 'blueSkull', 'yellowSkull', 'redSkull'];

const clampInt = (v, min, max) => Math.min(max, Math.max(min, Math.trunc(v)));

export class PlayerStats {
  constructor() {
    this.reset();
  }

  reset() {
    this.health = INITIAL_HEALTH;
    this.armor = 0;
    this.armorType = ARMOR_NONE;
    this.ammo = { ...INITIAL_AMMO };
    this.hasBackpack = false;
    this.weaponsOwned = new Set([FIST_SLOT, PISTOL_SLOT]); // espingarda (3) a BFG (7) ausentes
    // Soco e motosserra dividem o slot 1 (como no Doom, são armas separadas): a motosserra tem campo próprio.
    this.hasChainsaw = false;
    this.keys = Object.fromEntries(KEY_NAMES.map((k) => [k, false]));
    this.bonusCount = 0;
  }

  get isDead() {
    return this.health <= 0;
  }

  // Máximo corrente de um tipo de munição (a mochila dobra).
  maxAmmoOf(type) {
    return MAX_AMMO[type] * (this.hasBackpack ? 2 : 1);
  }

  // Compatibilidade: balas.
  get ammoClip() { return this.ammo.clip; }
  set ammoClip(v) { this.ammo.clip = clampInt(v, 0, this.maxAmmoOf('clip')); }
  get maxClip() { return this.maxAmmoOf('clip'); }

  addHealth(n, limit = MAX_HEALTH) { this.health = clampInt(this.health + n, 0, Math.max(limit, 0)); }

  addArmor(n) {
    this.armor = clampInt(this.armor + n, 0, MAX_ARMOR);
    if (this.armor === 0) this.armorType = ARMOR_NONE;
  }

  addAmmo(n, type = 'clip') {
    this.ammo[type] = clampInt(this.ammo[type] + n, 0, this.maxAmmoOf(type));
  }

  // Gasta n de um tipo; devolve false (sem gastar) se não houver o suficiente.
  spendAmmo(n = 1, type = 'clip') {
    if (this.ammo[type] < n) return false;
    this.ammo[type] = clampInt(this.ammo[type] - n, 0, this.maxAmmoOf(type));
    return true;
  }

  // Um tic de jogo: o contador de bônus decai (gancho para um efeito visual futuro).
  tickBonus() {
    if (this.bonusCount > 0) this.bonusCount--;
  }
}

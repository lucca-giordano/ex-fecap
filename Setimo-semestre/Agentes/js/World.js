export const BLOCK_SIZE = 32;
export const WORLD_COLS = 25; // 800 / 32
export const WORLD_ROWS = 19; // 608 / 32

export const BLOCK_TYPES = {
    EMPTY: 0,
    DIRT: 1,
    WOOD: 2,
    STONE: 3,
    LEAVES: 4
};

// Colors for the placeholders
export const BLOCK_COLORS = {
    [BLOCK_TYPES.DIRT]: 0x8b4513,  // SaddleBrown
    [BLOCK_TYPES.WOOD]: 0x5c4033,  // Dark Wood
    [BLOCK_TYPES.STONE]: 0x808080, // Gray
    [BLOCK_TYPES.LEAVES]: 0x228b22 // ForestGreen
};

export class World {
    constructor(scene) {
        this.scene = scene;
        // The 2D grid storing block types
        this.grid = [];
        // The 2D grid storing Phaser GameObjects (Rectangles)
        this.blockSprites = [];
        // A physics static group to hold all solid blocks for collision
        this.blocksGroup = this.scene.physics.add.staticGroup();
        this.dropsGroup = this.scene.physics.add.group(); // Grupos para os itens caídos

        this.generateWorld();
        this.renderWorld();
    }

    generateWorld() {
        for (let y = 0; y < WORLD_ROWS; y++) {
            this.grid[y] = [];
            this.blockSprites[y] = [];
            for (let x = 0; x < WORLD_COLS; x++) {
                this.grid[y][x] = BLOCK_TYPES.EMPTY;
                this.blockSprites[y][x] = null;
            }
        }

        for (let x = 0; x < WORLD_COLS; x++) {
            // Camada 1 (Superfície - Y: 0)
            this.grid[WORLD_ROWS - 5][x] = BLOCK_TYPES.DIRT;
            // Camada 2 (Y: 1)
            this.grid[WORLD_ROWS - 4][x] = Math.random() < 0.75 ? BLOCK_TYPES.DIRT : BLOCK_TYPES.STONE;
            // Camada 3 (Y: 2)
            this.grid[WORLD_ROWS - 3][x] = Math.random() < 0.25 ? BLOCK_TYPES.DIRT : BLOCK_TYPES.STONE;
            // Camadas 4 e 5 (Fundo do mapa)
            this.grid[WORLD_ROWS - 2][x] = BLOCK_TYPES.STONE;
            this.grid[WORLD_ROWS - 1][x] = BLOCK_TYPES.STONE;

            // Chance de árvore
            if (Math.random() < 0.1) {
                this.spawnTree(x, WORLD_ROWS - 6);
            }
        }
    }

    spawnTree(x, baseY) {
        const isLarge = Math.random() < 0.5;
        const canopyWidth = isLarge ? 5 : 3;
        const halfCanopy = Math.floor(canopyWidth / 2);

        // Regra: Verifica limites do mapa para não desenhar folhas pra fora
        if (x < halfCanopy || x > WORLD_COLS - 1 - halfCanopy) {
            return;
        }

        if (isLarge) {
            // Modelo 2: Árvore Grande
            const trunkHeight = Math.floor(Math.random() * 2) + 3; // 3 ou 4
            for (let i = 0; i < trunkHeight; i++) {
                if (this.grid[baseY - i][x] === BLOCK_TYPES.EMPTY) {
                    this.grid[baseY - i][x] = BLOCK_TYPES.WOOD;
                }
            }

            const topY = baseY - trunkHeight;

            // Base da copa (5 de largura)
            for (let i = -2; i <= 2; i++) {
                if (this.grid[topY + 1][x + i] === BLOCK_TYPES.EMPTY) this.grid[topY + 1][x + i] = BLOCK_TYPES.LEAVES;
            }
            // Meio da copa (3 de largura)
            for (let i = -1; i <= 1; i++) {
                if (this.grid[topY][x + i] === BLOCK_TYPES.EMPTY) this.grid[topY][x + i] = BLOCK_TYPES.LEAVES;
            }
            // Topo (1 de largura)
            if (this.grid[topY - 1][x] === BLOCK_TYPES.EMPTY) this.grid[topY - 1][x] = BLOCK_TYPES.LEAVES;

        } else {
            // Modelo 1: Árvore Pequena
            if (this.grid[baseY][x] === BLOCK_TYPES.EMPTY) this.grid[baseY][x] = BLOCK_TYPES.WOOD;
            if (this.grid[baseY - 1][x] === BLOCK_TYPES.EMPTY) this.grid[baseY - 1][x] = BLOCK_TYPES.WOOD;

            const topY = baseY - 2;

            // Base da copa (3 de largura)
            for (let i = -1; i <= 1; i++) {
                if (this.grid[topY + 1][x + i] === BLOCK_TYPES.EMPTY) this.grid[topY + 1][x + i] = BLOCK_TYPES.LEAVES;
            }
            // Topo (1 de largura)
            if (this.grid[topY][x] === BLOCK_TYPES.EMPTY) this.grid[topY][x] = BLOCK_TYPES.LEAVES;
        }
    }

    renderWorld() {
        for (let y = 0; y < WORLD_ROWS; y++) {
            for (let x = 0; x < WORLD_COLS; x++) {
                const blockType = this.grid[y][x];
                if (blockType !== BLOCK_TYPES.EMPTY) {
                    this.createBlockSprite(x, y, blockType);
                }
            }
        }
    }

    createBlockSprite(x, y, type) {
        const color = BLOCK_COLORS[type];
        // Coordinates in Phaser are typically centered for shapes unless origin is changed.
        // We set origin(0,0) so x,y matches the top-left corner of the grid cell.
        const pixelX = x * BLOCK_SIZE;
        const pixelY = y * BLOCK_SIZE;

        const rect = this.scene.add.rectangle(pixelX, pixelY, BLOCK_SIZE, BLOCK_SIZE, color).setOrigin(0, 0);

        // Add to the physics static group
        this.blocksGroup.add(rect);
        // Sync static body to origin 0,0 position
        rect.body.updateFromGameObject();

        // Outline for visual grid (optional, but helps terraria feel)
        rect.setStrokeStyle(1, 0x000000, 0.5);

        this.blockSprites[y][x] = rect;
    }

    breakBlock(gx, gy) {
        if (gx < 0 || gx >= WORLD_COLS || gy < 0 || gy >= WORLD_ROWS) return;

        const type = this.grid[gy][gx];
        if (type === BLOCK_TYPES.EMPTY) return;

        // Limpar do grid
        this.grid[gy][gx] = BLOCK_TYPES.EMPTY;

        // Remover sprite e física
        const sprite = this.blockSprites[gy][gx];
        if (sprite) {
            sprite.destroy();
            this.blockSprites[gy][gx] = null;
        }

        // Dropar item físico (um mini retângulo)
        this.spawnDrop(gx, gy, type);
    }

    placeBlock(gx, gy, type) {
        if (gx < 0 || gx >= WORLD_COLS || gy < 0 || gy >= WORLD_ROWS) return;
        if (this.grid[gy][gx] !== BLOCK_TYPES.EMPTY) return;

        this.grid[gy][gx] = type;
        this.createBlockSprite(gx, gy, type);
    }

    spawnDrop(gx, gy, type) {
        const color = BLOCK_COLORS[type];
        const pixelX = gx * BLOCK_SIZE + BLOCK_SIZE / 2;
        const pixelY = gy * BLOCK_SIZE + BLOCK_SIZE / 2;

        const drop = this.scene.add.rectangle(pixelX, pixelY, BLOCK_SIZE / 3, BLOCK_SIZE / 3, color);
        this.dropsGroup.add(drop);

        // Configurar física do drop
        drop.body.setBounce(0.4);
        drop.body.setCollideWorldBounds(true);
        // Pequena força aleatória
        drop.body.setVelocity(Phaser.Math.Between(-50, 50), -150);

        // Armazena o tipo de bloco no drop para uso no inventário (Fase 5)
        drop.blockType = type;
    }
}

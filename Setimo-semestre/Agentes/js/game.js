import { World, BLOCK_SIZE, BLOCK_TYPES } from './World.js';
import { Player } from './Player.js';
import { Inventory } from './Inventory.js';

// Configuração base do jogo usando Phaser 3
const config = {
    type: Phaser.AUTO, // Usa WebGL se disponível, caso contrário Canvas
    width: 800,
    height: 608,
    parent: 'game-container', // ID da div no HTML
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 600 }, // Gravidade puxando para baixo
            debug: false // Desativado debug para ver os gráficos mais limpamente
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let world;
let player;
let inventory;

function preload() { }

function create() {
    world = new World(this);

    player = new Player(this, 400, 100);

    inventory = new Inventory(this);

    // Colisões do mundo estático
    this.physics.add.collider(player.sprite, world.blocksGroup);
    this.physics.add.collider(world.dropsGroup, world.blocksGroup);

    // Coletar itens jogados no chão
    this.physics.add.overlap(player.sprite, world.dropsGroup, (pSprite, drop) => {
        // Tenta adicionar ao inventário
        if (inventory.addItem(drop.blockType)) {
            drop.destroy(); // Se foi adicionado com sucesso, destrói o físico no mundo
        }
    });

    this.input.mouse.disableContextMenu();

    this.input.on('pointerdown', (pointer) => {
        const x = pointer.worldX;
        const y = pointer.worldY;

        const gx = Math.floor(x / BLOCK_SIZE);
        const gy = Math.floor(y / BLOCK_SIZE);

        if (pointer.rightButtonDown()) {
            const typeToPlace = inventory.getHandBlockType();
            if (typeToPlace !== BLOCK_TYPES.EMPTY) {
                // Modificamos placeBlock no World.js, que apenas coloca. Aqui validamos se teve sucesso e consumimos 1 item da mão.
                if (world.grid[gy] && world.grid[gy][gx] === BLOCK_TYPES.EMPTY) {
                    world.placeBlock(gx, gy, typeToPlace);
                    inventory.consumeHandItem();
                }
            }
        } else {
            world.breakBlock(gx, gy);
        }
    });
}

function update() {
    if (player) {
        player.update();
    }
}

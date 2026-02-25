export class Player {
    constructor(scene, x, y) {
        this.scene = scene;

        // Crie o retângulo azul representando o jogador
        this.sprite = this.scene.add.rectangle(x, y, 24, 48, 0x0000ff);

        // Habilite a física
        this.scene.physics.add.existing(this.sprite);

        // Configurações do corpo físico
        this.sprite.body.setCollideWorldBounds(true);
        this.sprite.body.setBounce(0.1); // Leve quique ao cair

        // Controles de teclado
        this.cursors = this.scene.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
            space: Phaser.Input.Keyboard.KeyCodes.SPACE
        });

        // Constantes de Movimento
        this.speed = 160;
        this.jumpForce = -400;
    }

    update() {
        // Movimento Horizontal
        if (this.cursors.left.isDown) {
            this.sprite.body.setVelocityX(-this.speed);
        } else if (this.cursors.right.isDown) {
            this.sprite.body.setVelocityX(this.speed);
        } else {
            this.sprite.body.setVelocityX(0);
        }

        // Pulo (W ou Espaço)
        const isJumping = this.cursors.up.isDown || this.cursors.space.isDown;
        const touchingGround = this.sprite.body.blocked.down || this.sprite.body.touching.down;

        if (isJumping && touchingGround) {
            this.sprite.body.setVelocityY(this.jumpForce);
        }
    }
}

import { BLOCK_COLORS, BLOCK_TYPES } from './World.js';

export class Inventory {
    constructor(scene) {
        this.scene = scene;

        // 3x3 para mochila, 1 para a Mão. Total 10 slots
        // Slots serão objetos: { type: BLOCK_TYPES.EMPTY, amount: 0, uiRect: null, uiText: null }
        this.slots = [];
        this.maxSlots = 10;

        this.handSlotIndex = 9; // O último slot será a "Mão"

        // Posições base da UI
        this.startX = 20;
        this.startY = 20;
        this.slotSize = 40;
        this.spacing = 10;

        this.initSlots();
        this.createUI();
    }

    initSlots() {
        for (let i = 0; i < this.maxSlots; i++) {
            this.slots.push({
                type: BLOCK_TYPES.EMPTY,
                amount: 0,
                uiBg: null,
                uiIcon: null,
                uiText: null
            });
        }
    }

    createUI() {
        this.uiGroup = this.scene.add.group();

        // 3x3 Backpack
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const index = row * 3 + col;
                const x = this.startX + col * (this.slotSize + this.spacing);
                const y = this.startY + row * (this.slotSize + this.spacing);
                this.drawSlot(index, x, y);
            }
        }

        // Hand Slot (Destaque)
        const handX = this.startX + 1.5 * (this.slotSize + this.spacing) - (this.slotSize / 2); // Center below 3x3
        const handY = this.startY + 3.5 * (this.slotSize + this.spacing);
        this.drawSlot(this.handSlotIndex, handX, handY, 0xffff00); // Yellow outline for hand

        // Label for hand slot
        const handLabel = this.scene.add.text(handX + this.slotSize / 2, handY - 15, "Mão (1)", { fontSize: '12px', fill: '#fff' })
            .setOrigin(0.5)
            .setScrollFactor(0);
        this.uiGroup.add(handLabel);

        // Hotkey setup (Press 1 to move first slot item to hand)
        this.scene.input.keyboard.on('keydown-ONE', () => {
            this.moveToHand(0);
        });
        this.scene.input.keyboard.on('keydown-TWO', () => {
            this.moveToHand(1);
        });
        this.scene.input.keyboard.on('keydown-THREE', () => {
            this.moveToHand(2);
        });
    }

    drawSlot(index, x, y, outlineColor = 0xffffff) {
        // Background
        const bg = this.scene.add.rectangle(x, y, this.slotSize, this.slotSize, 0x333333, 0.8)
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setStrokeStyle(2, outlineColor);

        // Icon Placeholder (drawn when item exists)
        const icon = this.scene.add.rectangle(x + this.slotSize / 2, y + this.slotSize / 2, this.slotSize / 2, this.slotSize / 2, 0x000000)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setVisible(false);

        // Amount Text
        const text = this.scene.add.text(x + this.slotSize - 4, y + this.slotSize - 4, '', { fontSize: '14px', fill: '#fff', fontStyle: 'bold' })
            .setOrigin(1, 1)
            .setScrollFactor(0);

        this.uiGroup.addMultiple([bg, icon, text]);

        this.slots[index].uiBg = bg;
        this.slots[index].uiIcon = icon;
        this.slots[index].uiText = text;
    }

    addItem(type) {
        // Tenta encontrar um slot com o mesmo tipo
        for (let i = 0; i < this.maxSlots; i++) {
            if (this.slots[i].type === type) {
                this.slots[i].amount++;
                this.updateSlotUI(i);
                return true;
            }
        }

        // Se não encontrar, busca o primeiro vazio
        for (let i = 0; i < this.maxSlots; i++) {
            if (this.slots[i].type === BLOCK_TYPES.EMPTY) {
                this.slots[i].type = type;
                this.slots[i].amount = 1;
                this.updateSlotUI(i);
                return true;
            }
        }

        // Inventário cheio
        return false;
    }

    consumeHandItem() {
        const hand = this.slots[this.handSlotIndex];
        if (hand.type === BLOCK_TYPES.EMPTY) return null;

        const typeToPlace = hand.type;
        hand.amount--;
        if (hand.amount <= 0) {
            hand.type = BLOCK_TYPES.EMPTY;
        }
        this.updateSlotUI(this.handSlotIndex);
        return typeToPlace;
    }

    getHandBlockType() {
        return this.slots[this.handSlotIndex].type;
    }

    moveToHand(slotIndex) {
        const slot = this.slots[slotIndex];
        const hand = this.slots[this.handSlotIndex];

        // Swap or move
        const tempType = hand.type;
        const tempAmount = hand.amount;

        hand.type = slot.type;
        hand.amount = slot.amount;

        slot.type = tempType;
        slot.amount = tempAmount;

        this.updateSlotUI(slotIndex);
        this.updateSlotUI(this.handSlotIndex);
    }

    updateSlotUI(index) {
        const slot = this.slots[index];
        if (slot.type === BLOCK_TYPES.EMPTY || slot.amount <= 0) {
            slot.type = BLOCK_TYPES.EMPTY; // Safety cleanup
            slot.uiIcon.setVisible(false);
            slot.uiText.setText('');
        } else {
            slot.uiIcon.setFillStyle(BLOCK_COLORS[slot.type]);
            slot.uiIcon.setVisible(true);
            slot.uiText.setText(slot.amount.toString());
        }
    }
}

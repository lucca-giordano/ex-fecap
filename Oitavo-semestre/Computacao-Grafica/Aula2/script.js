const canvas = document.getElementById('canvas');
const c = canvas.getContext('2d');

const width = canvas.width;
const height = canvas.height;

let cx = width / 2;
let cy = height / 2;

function draw() {

        c.strokeStyle = "blue";
        c.beginPath();
        c.moveTo(cx + 0, cy - 100);
        c.lineTo(cx + 100, cy +100);
        c.lineTo(cx -100, cy + 100);
        c.closePath();
        c.stroke();

        c.strokeStyle = "red";
        c.beginPath();
        c.moveTo(cx + 0, cy - 200);
        c.lineTo(cx + 200, cy + 200);
        c.lineTo(cx -200, cy + 200);
        c.closePath();
        c.stroke();

        c.strokeStyle = "white";
        c.beginPath();
        c.moveTo(cx + 70, cy - 70);
        c.lineTo(cx + 0, cy + 140);
        c.lineTo(cx -140, cy + 0);
        c.closePath();
        c.stroke();
        
}

const update = () => {
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();

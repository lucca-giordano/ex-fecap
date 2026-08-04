const canvas = document.getElementById('canvas');
const c = canvas.getContext('2d');

c.strokeStyle = 'blue';
c.lineWidth = 10;
c.fillStyle = 'red';
c.beginPath();
c.arc(200, 200, 50, 0, 2 * Math.PI);
c.fill();
c.stroke();

let angle = 0;
let speed = 0.005;
const width = canvas.width;
const height = canvas.height;

let cx = width / 2;
let cy = height / 2;
let distance = 150;
let ballRadius = 12;

let trail = [];
const maxTrail = 100;

const speedSlider = document.getElementById('speed');
const speedSpan = document.getElementById('speedValue');

speedSlider.addEventListener('input', (e) => {
    speed = parseFloat(e.target.value);
    speedSpan.textContent = speed;
});

const distanceSlider = document.getElementById('distance');
const distanceSpan = document.getElementById('distanceValue');

distanceSlider.addEventListener('input', (e) => {
    distance = parseFloat(e.target.value);
    distanceSpan.textContent = distance;
});

function draw() {
    const bx = cx + distance * Math.cos(angle);
    const by = cy - distance * Math.sin(angle);

    c.fillStyle = '#05050a';
    c.fillRect(0, 0, width, height);

    const applyNeon = (color) => {
        c.shadowColor = color;
        c.shadowBlur = 15;
        c.strokeStyle = color;
        c.fillStyle = color;
    }


    // Desenhar a grade no fundo
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(255, 255, 255, 0.3';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, cy); c.lineTo(width, cy);
    c.moveTo(cx, 0); c.lineTo(cx, height);
    c.stroke();

    // Desenhar o circulo trigonometrico
    c.strokeStyle = 'rgba(255, 255, 255, 1';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(cx, cy, distance, 0, Math.PI * 2);
    c.stroke();

    // Desenhar o raio / hipotenusa
    applyNeon('#f6f518')
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(bx, by);
    c.stroke();

    // Desenhar a bolinha
    applyNeon('#9664FF');
    c.beginPath();
    c.arc(bx, by, ballRadius, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
}

const update = () => {
    angle += speed;
    if(angle > Math.PI * 2) angle -= Math.PI * 2;
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();

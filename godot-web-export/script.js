const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GRAVITY = 0.3;
const THRUST = -0.8;
const FRICTION = 0.98;
const FISH_SPEED = 3;
const COLLECTIBLE_SPEED = 2;
const BUBBLE_SPEED = 1;
const PARTICLE_COUNT = 50;

// Game state
let score = 0;
let gameRunning = true;
let boostActive = false;
let boostEndTime = 0;

// Fish object
const fish = {
    x: 100,
    y: CANVAS_HEIGHT / 2,
    width: 50,
    height: 30,
    velocityY: 0,
    color: '#FFB6C1',
    eyeColor: '#000000',
    tailAngle: 0,
    shadowOffset: 5
};

// Collectibles array
let collectibles = [];

// Bubbles for background
let bubbles = [];

// Particles (micro bubbles)
let particles = [];

// Parallax layers
const backgroundLayers = [
    { x: 0, speed: 0.5, color: '#FF69B4', height: 100 }, // Coral
    { x: 0, speed: 0.3, color: '#87CEEB', height: 150 }, // Seaweed
    { x: 0, speed: 0.2, color: '#00CED1', height: 200 }  // Distant coral
];

// Audio context for sounds
let audioContext;
try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
} catch (e) {
    console.warn('Web Audio API not supported');
}

// Sound functions
function playSound(frequency, duration, type = 'sine') {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = type;
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function playCollectSound() {
    playSound(800, 0.1, 'square');
}

function playSwimSound() {
    playSound(400, 0.05, 'sine');
}

function playBackgroundMusic() {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
    oscillator.type = 'triangle';
    gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
    oscillator.start();
    // Loop every 4 seconds
    setInterval(() => {
        oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
    }, 4000);
}

// Initialize game
function init() {
    // Create initial bubbles
    for (let i = 0; i < 20; i++) {
        bubbles.push({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT,
            radius: Math.random() * 10 + 5,
            speed: Math.random() * 0.5 + 0.5
        });
    }

    // Create particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT,
            radius: Math.random() * 2 + 1,
            speed: Math.random() * 0.5 + 0.2
        });
    }

    playBackgroundMusic();
}

// Input handling
let isThrusting = false;

function handleInput() {
    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            isThrusting = true;
            playSwimSound();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            isThrusting = false;
        }
    });

    // Touch
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isThrusting = true;
        playSwimSound();
    });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        isThrusting = false;
    });

    // Mouse (for desktop testing)
    canvas.addEventListener('mousedown', () => {
        isThrusting = true;
        playSwimSound();
    });

    canvas.addEventListener('mouseup', () => {
        isThrusting = false;
    });
}

// Spawn collectibles
function spawnCollectible() {
    const types = [
        { name: 'shell', points: 1, color: '#FFD700', rarity: 0.6 },
        { name: 'starfish', points: 3, color: '#FF6347', rarity: 0.25 },
        { name: 'pearl', points: 5, color: '#F0E68C', rarity: 0.1 },
        { name: 'bubblePack', points: 0, color: '#87CEEB', rarity: 0.05 }
    ];

    const rand = Math.random();
    let cumulative = 0;
    let selectedType = types[0];

    for (const type of types) {
        cumulative += type.rarity;
        if (rand <= cumulative) {
            selectedType = type;
            break;
        }
    }

    collectibles.push({
        x: CANVAS_WIDTH,
        y: Math.random() * (CANVAS_HEIGHT - 100) + 50,
        width: 30,
        height: 30,
        type: selectedType.name,
        points: selectedType.points,
        color: selectedType.color,
        rotation: 0,
        glow: selectedType.name === 'pearl'
    });
}

// Update game state
function update() {
    if (!gameRunning) return;

    // Fish movement
    if (isThrusting) {
        fish.velocityY += THRUST;
    }
    fish.velocityY += GRAVITY;
    fish.velocityY *= FRICTION;
    fish.y += fish.velocityY;

    // Keep fish in bounds
    if (fish.y < 0) fish.y = 0;
    if (fish.y + fish.height > CANVAS_HEIGHT) fish.y = CANVAS_HEIGHT - fish.height;

    // Tail animation
    fish.tailAngle = Math.sin(Date.now() * 0.01) * 0.3;

    // Boost effect
    if (boostActive && Date.now() > boostEndTime) {
        boostActive = false;
    }

    // Update collectibles
    collectibles.forEach((collectible, index) => {
        collectible.x -= COLLECTIBLE_SPEED + (boostActive ? 2 : 0);
        collectible.rotation += 0.05;

        // Check collision
        if (fish.x < collectible.x + collectible.width &&
            fish.x + fish.width > collectible.x &&
            fish.y < collectible.y + collectible.height &&
            fish.y + fish.height > collectible.y) {
            if (collectible.type === 'bubblePack') {
                boostActive = true;
                boostEndTime = Date.now() + 3000;
            } else {
                score += collectible.points;
                scoreElement.textContent = `Score: ${score}`;
                playCollectSound();
            }
            collectibles.splice(index, 1);
        }

        // Remove off-screen collectibles
        if (collectible.x + collectible.width < 0) {
            collectibles.splice(index, 1);
        }
    });

    // Update bubbles
    bubbles.forEach(bubble => {
        bubble.y -= bubble.speed;
        if (bubble.y + bubble.radius < 0) {
            bubble.y = CANVAS_HEIGHT + bubble.radius;
            bubble.x = Math.random() * CANVAS_WIDTH;
        }
    });

    // Update particles
    particles.forEach(particle => {
        particle.y -= particle.speed;
        if (particle.y + particle.radius < 0) {
            particle.y = CANVAS_HEIGHT + particle.radius;
            particle.x = Math.random() * CANVAS_WIDTH;
        }
    });

    // Update parallax
    backgroundLayers.forEach(layer => {
        layer.x -= layer.speed;
        if (layer.x <= -CANVAS_WIDTH) layer.x = 0;
    });

    // Spawn collectibles occasionally
    if (Math.random() < 0.02) {
        spawnCollectible();
    }
}

// Draw functions
function drawFish() {
    ctx.save();
    ctx.translate(fish.x + fish.width / 2, fish.y + fish.height / 2);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.ellipse(0, fish.shadowOffset, fish.width * 0.8, fish.height * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = fish.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, fish.width / 2, fish.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = fish.eyeColor;
    ctx.beginPath();
    ctx.arc(-10, -5, 3, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.save();
    ctx.rotate(fish.tailAngle);
    ctx.fillStyle = fish.color;
    ctx.beginPath();
    ctx.moveTo(fish.width / 2, 0);
    ctx.lineTo(fish.width / 2 + 15, -10);
    ctx.lineTo(fish.width / 2 + 15, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Boost aura
    if (boostActive) {
        ctx.strokeStyle = '#87CEEB';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, fish.width / 2 + 10, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
}

function drawCollectible(collectible) {
    ctx.save();
    ctx.translate(collectible.x + collectible.width / 2, collectible.y + collectible.height / 2);
    ctx.rotate(collectible.rotation);

    if (collectible.glow) {
        ctx.shadowColor = collectible.color;
        ctx.shadowBlur = 10;
    }

    ctx.fillStyle = collectible.color;
    if (collectible.type === 'shell') {
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
    } else if (collectible.type === 'starfish') {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            ctx.lineTo(15 * Math.cos((i * 2 * Math.PI) / 5), 15 * Math.sin((i * 2 * Math.PI) / 5));
            ctx.lineTo(5 * Math.cos(((i + 0.5) * 2 * Math.PI) / 5), 5 * Math.sin(((i + 0.5) * 2 * Math.PI) / 5));
        }
        ctx.closePath();
        ctx.fill();
    } else if (collectible.type === 'pearl') {
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
    } else if (collectible.type === 'bubblePack') {
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    ctx.restore();
}

function drawBackground() {
    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#00CED1');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Sunlight rays
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 80, 0);
        ctx.lineTo(i * 80 + 20, CANVAS_HEIGHT);
        ctx.stroke();
    }

    // Parallax layers
    backgroundLayers.forEach(layer => {
        ctx.fillStyle = layer.color;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(layer.x, CANVAS_HEIGHT - layer.height, CANVAS_WIDTH, layer.height);
        ctx.fillRect(layer.x + CANVAS_WIDTH, CANVAS_HEIGHT - layer.height, CANVAS_WIDTH, layer.height);
        ctx.globalAlpha = 1;
    });

    // Bubbles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    bubbles.forEach(bubble => {
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    // Particles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    particles.forEach(particle => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Main render function
function render() {
    drawBackground();
    collectibles.forEach(drawCollectible);
    drawFish();
}

// Game loop
function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// Start game
init();
handleInput();
gameLoop();
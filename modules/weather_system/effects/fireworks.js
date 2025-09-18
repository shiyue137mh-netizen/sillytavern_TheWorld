/**
 * The World - Fireworks Effect
 * @description Renders a dynamic, progressive fireworks display on a canvas.
 * Heavily inspired by the core logic of "firework-simulator-v2" by Caleb Miller.
 */

// --- Constants ---
const PARTICLE_GRAVITY = 0.06;
const PARTICLE_FRICTION = 0.98;
const ROCKET_WOBBLE_SPEED = 0.05;

// New, warmer and more vibrant color palette, including a chance for white
const HUES = [0, 15, 30, 45, 60, 120, 210, 270, 300, 330, 'white', 'white']; // Red, Orange, Yellow, Green, Blue, Purple, Pink, and White

// --- Utility Functions ---
const rand = (min, max) => Math.random() * (max - min) + min;
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];


// --- Glow Class (for rocket trail and explosion flash) ---
class Glow {
    constructor(x, y, radius, hue) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.hue = hue;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        const color = this.hue === 'white' 
            ? `hsla(0, 0%, 100%, 0.5)` 
            : `hsla(${this.hue}, 100%, 70%, 0.5)`;

        gradient.addColorStop(0, color.replace(/, [\d.]+\)$/, ', 0.3)'));
        gradient.addColorStop(0.25, color.replace(/, [\d.]+\)$/, ', 0.1)'));
        gradient.addColorStop(1, color.replace(/, [\d.]+\)$/, ', 0)'));
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class ExplosionGlow {
    constructor(x, y, hue) {
        this.x = x;
        this.y = y;
        this.hue = hue;
        this.radius = 0;
        this.maxRadius = rand(200, 300);
        this.alpha = 0.5;
        this.dead = false;
    }

    update() {
        this.radius += 15;
        this.alpha -= 0.015;
        if (this.alpha <= 0) {
            this.dead = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        const colorStr = this.hue === 'white' 
            ? `hsla(0, 0%, 100%, ${this.alpha})` 
            : `hsla(${this.hue}, 100%, 70%, ${this.alpha})`;

        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        gradient.addColorStop(0, colorStr.replace(/, [\d.]+\)$/, `, ${this.alpha * 0.5})`));
        gradient.addColorStop(0.2, colorStr.replace(/, [\d.]+\)$/, `, ${this.alpha * 0.2})`));
        gradient.addColorStop(1, colorStr.replace(/, [\d.]+\)$/, ', 0)'));
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}


// --- Particle Class ---
class Particle {
    constructor(x, y, hue, speed, decay, gravity = PARTICLE_GRAVITY) {
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
        this.angle = rand(0, Math.PI * 2);
        this.speed = speed;
        this.friction = PARTICLE_FRICTION;
        this.gravity = gravity;
        this.hue = this.hue = hue === 'white' ? 'white' : rand(hue - 15, hue + 15);
        this.brightness = rand(50, 80);
        this.alpha = 1;
        this.decay = decay;
        this.dead = false;
    }

    update() {
        this.prevX = this.x;
        this.prevY = this.y;
        this.speed *= this.friction;
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed + this.gravity;
        this.alpha -= this.decay;
        if (this.alpha <= this.decay) {
            this.dead = true;
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.moveTo(this.prevX, this.prevY);
        ctx.lineTo(this.x, this.y);
        ctx.lineWidth = rand(1, 2.5);
        
        const strokeStyle = this.hue === 'white'
            ? `hsla(0, 0%, ${this.brightness}%, ${this.alpha})`
            : `hsla(${this.hue}, 100%, ${this.brightness}%, ${this.alpha})`;

        ctx.strokeStyle = strokeStyle;
        ctx.stroke();
    }
}

// --- Rocket Class ---
class Rocket {
    constructor(startX, startY, targetY, hue) {
        this.startX = startX;
        this.x = startX;
        this.y = startY;
        this.prevX = startX;
        this.prevY = startY;
        this.targetY = targetY;
        this.hue = hue;
        
        this.speed = rand(3, 5);
        this.angle = -Math.PI / 2;

        this.wobbleSpeed = rand(ROCKET_WOBBLE_SPEED * 0.8, ROCKET_WOBBLE_SPEED * 1.2);
        this.wobbleMagnitude = rand(1.5, 2.5);
        this.wobbleCounter = rand(0, Math.PI * 2);
        
        this.glow = new Glow(this.x, this.y, rand(12, 18), this.hue);
        
        this.dead = false;
        this.exploded = false;
    }

    update() {
        this.prevX = this.x;
        this.prevY = this.y;
        
        this.y += Math.sin(this.angle) * this.speed;
        
        this.wobbleCounter += this.wobbleSpeed;
        this.x = this.startX + Math.sin(this.wobbleCounter) * this.wobbleMagnitude;
        
        this.glow.x = this.x;
        this.glow.y = this.y;
        this.glow.radius = rand(12, 18); // Pulsating glow
        
        if (this.y <= this.targetY) {
            this.exploded = true;
            this.dead = true;
        }
    }

    draw(ctx) {
        this.glow.draw(ctx);

        ctx.beginPath();
        ctx.moveTo(this.prevX, this.prevY);
        ctx.lineTo(this.x, this.y);
        ctx.lineWidth = 2;
        
        const strokeStyle = this.hue === 'white'
            ? 'hsl(0, 0%, 80%)'
            : `hsl(${this.hue}, 100%, 70%)`;
        ctx.strokeStyle = strokeStyle;
        ctx.stroke();
    }
}

export class FireworksFX {
    constructor({ $, $fxTarget }) {
        this.$ = $;
        this.$fxTarget = $fxTarget;

        this.canvas = null;
        this.ctx = null;
        this.animationFrameId = null;

        this.rockets = [];
        this.particles = [];
        
        this.launchIntensity = 0.5;
        this.maxLaunchIntensity = 10;
        this.intensityIncrement = 0.005;

        this._loop = this._loop.bind(this);
    }

    init() {
        if (this.canvas) return;
        
        this.canvas = this.$('<canvas>').addClass('tw-fireworks-canvas').get(0);
        this.ctx = this.canvas.getContext('2d');
        this.$fxTarget.append(this.canvas);
        
        this._resize();
        this._boundResize = this._resize.bind(this);
        window.addEventListener('resize', this._boundResize);

        this.ctx.lineWidth = 1;
        this.launchIntensity = 0.5;
        this._loop();
    }

    stop() {
        if (!this.canvas) return;
        
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
        if (this._boundResize) {
            window.removeEventListener('resize', this._boundResize);
            this._boundResize = null;
        }
        
        this.$(this.canvas).remove();
        this.canvas = null;
        this.ctx = null;
        this.rockets = [];
        this.particles = [];
    }
    
    _resize() {
        if (!this.canvas) return;
        this.canvas.width = this.$fxTarget.width();
        this.canvas.height = this.$fxTarget.height();
    }

    _createExplosion(x, y, hue) {
        this.particles.push(new ExplosionGlow(x, y, hue));
        
        const typeRoll = Math.random();
        
        // 20% chance: Small burst
        if (typeRoll < 0.20) {
            const particleCount = 40 + Math.floor(rand(0, 20));
            for (let i = 0; i < particleCount; i++) {
                this.particles.push(new Particle(x, y, hue, rand(1, 4), rand(0.035, 0.05)));
            }
        } 
        // 65% chance: Medium burst
        else if (typeRoll < 0.85) {
            const particleCount = 100 + Math.floor(rand(0, 50));
            for (let i = 0; i < particleCount; i++) {
                this.particles.push(new Particle(x, y, hue, rand(2, 8), rand(0.015, 0.03)));
            }
        } 
        // 15% chance: Giant Willow
        else {
            const particleCount = 200 + Math.floor(rand(0, 50));
            for (let i = 0; i < particleCount; i++) {
                this.particles.push(new Particle(x, y, hue, rand(2, 9), rand(0.005, 0.01), PARTICLE_GRAVITY * 1.5));
            }
        }
    }

    _loop() {
        this.animationFrameId = requestAnimationFrame(this._loop);

        if (!this.ctx || !this.canvas) return;
        
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalCompositeOperation = 'lighter';
        
        if (this.launchIntensity < this.maxLaunchIntensity) {
            this.launchIntensity += this.intensityIncrement;
        }

        if (rand(0, 100) < this.launchIntensity) {
            this.rockets.push(new Rocket(
                rand(this.canvas.width * 0.2, this.canvas.width * 0.8),
                this.canvas.height,
                rand(this.canvas.height * 0.1, this.canvas.height * 0.55),
                choice(HUES)
            ));
        }
        
        for (let i = this.rockets.length - 1; i >= 0; i--) {
            const rocket = this.rockets[i];
            rocket.update();
            rocket.draw(this.ctx);
            if (rocket.exploded) {
                this._createExplosion(rocket.x, rocket.y, rocket.hue);
            }
            if (rocket.dead) {
                this.rockets.splice(i, 1);
            }
        }
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.update();
            particle.draw(this.ctx);
            if (particle.dead) {
                this.particles.splice(i, 1);
            }
        }
    }
}

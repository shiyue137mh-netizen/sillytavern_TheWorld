/**
 * The World - Vapor Trail Effect
 * @description Renders a plane with a vapor trail using canvas.
 * Adapted from a pen by Artem Zubkov: https://codepen.io/artzub/pen/RwYBdO
 */

// --- Utility Functions ---
const unsigRand = (max, min = 0) => {
    const m = max > min ? max : min;
    const effectiveMin = max === m ? min : max;
    return (Math.random() * (m - effectiveMin) + effectiveMin) | 0;
};

const rand = (to) => {
    const r = (Math.random() * 10 * 2 - 10) | 0;
    return unsigRand(to) * (r / (Math.abs(r) || 1));
};

// --- Particle Class ---
class Particle {
    constructor(x, y, r, target) {
        this.x = x;
        this.y = y;
        this.r = r || 5;
        this.life = 450; // ticks
        this.coff = 1;
        this.target = target;
        target.x += this.r * rand(2);
        target.y += this.r * rand(2);
        this.killed = false;
    }

    update() {
        const dx = this.x - this.target.x;
        const dy = this.y - this.target.y;
        let r = Math.sqrt(dx * dx + dy * dy);
        if (r !== this.r) {
            r = (r - this.r) / (r || 1) * 0.015;
            this.x -= dx * r;
            this.y -= dy * r;
        }

        if (this.coff > 0 && this.life-- < 0) {
            this.coff = -10;
        }
        this.r += 0.05 * this.coff;
        this.r = Math.max(0, this.r);
        this.killed = this.r <= 0;
    }

    draw(ctx, cloudImage) {
        const s = this.r;
        if (s > 0 && cloudImage) {
            ctx.globalAlpha = Math.min(1, s / (this.constructor.maxRadius || 1)) * 0.5; // Added alpha control
            ctx.drawImage(cloudImage, this.x - s / 2, this.y - s / 2, s, s);
        }
    }
}
Particle.maxRadius = 4; // Default value

// --- Plane Class ---
class Plane {
    constructor(x, y, r, w, h) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.w = w;
        this.h = h;
        this.vx = (1 + Math.random()) * 2.5;
        this.vy = this.vx * (rand(1) || -1) * 0.2;
        this.angle = Math.atan2(this.vy, this.vx);
        this.isOffscreen = false;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        const r2 = this.r / 2;
        if (this.x > this.w + r2 || this.y < -r2 || this.y > this.h + r2) {
            this.isOffscreen = true;
        }
    }

    draw(ctx, processedPlaneImage) {
        if (!processedPlaneImage) return;
        const s2 = this.r / 2;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI / 2); // Add 90 degrees for vertical image
        ctx.drawImage(processedPlaneImage, -s2, -s2, this.r, this.r);
        ctx.restore();
    }
}

export class VaporTrailFX {
    constructor({ $, $fxTarget, onComplete }) {
        this.$ = $;
        this.$fxTarget = $fxTarget;
        this.onComplete = onComplete;
        this.startTime = 0;

        this.canvas = null;
        this.ctx = null;
        this.particleCanvas = null;
        this.particleCtx = null;
        this.planeCanvas = null;
        this.planeCtx = null;

        this.particles = [];
        this.plane = null;
        this.animationFrameId = null;
        this.timeoutId = null;

        this.settings = {
            bunch: 5,
            maxRadius: 4,
            minRadius: 3,
            particleDisp: 10,
            planeSize: 40,
            planeSizeMin: 30
        };
        Particle.maxRadius = this.settings.maxRadius;

        this.planeImage = null;
        this.processedPlaneImage = null; // Canvas with transparent BG plane
        this.cloudImage = null;
        this.isDestroyed = false;
    }

    init() {
        this.isDestroyed = false;
        this.canvas = this.$('<canvas>').addClass('tw-vapor-trail-canvas').get(0);
        this.ctx = this.canvas.getContext('2d');
        this.$fxTarget.append(this.canvas);
        this.startTime = Date.now();

        this.particleCanvas = document.createElement('canvas');
        this.particleCtx = this.particleCanvas.getContext('2d');
        
        this.planeCanvas = document.createElement('canvas');
        this.planeCtx = this.planeCanvas.getContext('2d');

        this.timeoutId = setTimeout(() => this.destroy(), 30000); // 30-second lifetime guarantee

        const imagePath = new URL('../../../assets/images/plane.png', import.meta.url).pathname;
        this.planeImage = new Image();
        this.planeImage.onload = () => {
            this._processPlaneImage();
            this.cloudImage = this._createCloudParticleImage();
            this._resize();
            window.addEventListener('resize', this._resize.bind(this));
            this._start();
        };
        this.planeImage.onerror = () => {
             console.error("The World: Failed to load plane.png for vapor trail effect.");
             this.destroy();
        };
        this.planeImage.src = imagePath;
    }

    _processPlaneImage() {
        const img = this.planeImage;
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = img.width;
        offscreenCanvas.height = img.height;
        const ctx = offscreenCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] < 20 && data[i + 1] < 20 && data[i + 2] < 20) {
                data[i + 3] = 0; // Set alpha of black pixels to 0
            }
        }
        ctx.putImageData(imageData, 0, 0);
        this.processedPlaneImage = offscreenCanvas;
    }
    
    _createCloudParticleImage() {
        const w = 32, h = 32;
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = w;
        tempCanvas.height = h;
        const ctx = tempCanvas.getContext("2d");
        const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
        return tempCanvas;
    }

    _start() {
        if (this.isDestroyed) return;
        this.animationFrameId = requestAnimationFrame(this._animLoop.bind(this));
    }

    _resize() {
        if (this.isDestroyed || !this.canvas || !this.$fxTarget.width()) return;
        const w = this.$fxTarget.width();
        const h = this.$fxTarget.height();
        this.canvas.width = this.particleCanvas.width = this.planeCanvas.width = w;
        this.canvas.height = this.particleCanvas.height = this.planeCanvas.height = h;

        if (!this.plane) {
            const r = unsigRand(this.settings.planeSize, this.settings.planeSizeMin);
            this.plane = new Plane(-r, unsigRand(h * 0.8, h * 0.1), r, w, h);
        } else {
            this.plane.w = w;
            this.plane.h = h;
        }
    }

    _animLoop() {
        if (this.isDestroyed) return;

        this._drawParticles();
        this._drawPlanes();

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.particleCanvas, 0, 0);
        this.ctx.drawImage(this.planeCanvas, 0, 0);
        
        if ((this.plane && this.plane.isOffscreen && this.particles.length === 0) || this.isDestroyed) {
            this.destroy();
            return;
        }

        this.animationFrameId = requestAnimationFrame(this._animLoop.bind(this));
    }
    
    _drawParticles() {
        this.particleCtx.save();
        this.particleCtx.globalCompositeOperation = 'destination-out';
        this.particleCtx.fillStyle = 'rgba(0, 0, 0, .08)';
        this.particleCtx.fillRect(0, 0, this.particleCanvas.width, this.particleCanvas.height);
        this.particleCtx.restore();

        this.particleCtx.save();
        this.particleCtx.globalCompositeOperation = 'lighter';
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const item = this.particles[i];
            item.draw(this.particleCtx, this.cloudImage);
            item.update();
            if (item.killed) {
                this.particles.splice(i, 1);
            }
        }
        this.particleCtx.restore();
    }

    _drawPlanes() {
        this.planeCtx.clearRect(0, 0, this.planeCanvas.width, this.planeCanvas.height);
        if (this.plane && !this.plane.isOffscreen) {
            this.plane.draw(this.planeCtx, this.processedPlaneImage);
            this.plane.update();
            this._createParticlesForPlane(this.plane);
        }
    }

    _createParticlesForPlane(p) {
        for (let l = this.settings.bunch; l > 0; l--) {
            const angleRad = Math.atan2(p.vy, p.vx);
            const perpAngle = angleRad + Math.PI / 2;
            
            const wingOffsetX = Math.cos(perpAngle) * (p.r / 3.5);
            const wingOffsetY = Math.sin(perpAngle) * (p.r / 3.5);

            const trailStartX = p.x - Math.cos(angleRad) * (p.r / 2);
            const trailStartY = p.y - Math.sin(angleRad) * (p.r / 2);

            this._appendParticle({ x: trailStartX + wingOffsetX, y: trailStartY + wingOffsetY }, { x: trailStartX + wingOffsetX + rand(this.settings.particleDisp), y: trailStartY + wingOffsetY + rand(this.settings.particleDisp) });
            this._appendParticle({ x: trailStartX - wingOffsetX, y: trailStartY - wingOffsetY }, { x: trailStartX - wingOffsetX + rand(this.settings.particleDisp), y: trailStartY - wingOffsetY + rand(this.settings.particleDisp) });
        }
    }

    _appendParticle(from, target) {
        this.particles.push(new Particle(from.x, from.y, unsigRand(this.settings.maxRadius, this.settings.minRadius), target));
    }

    destroy() {
        if (this.isDestroyed) return;
        this.isDestroyed = true;
        
        window.removeEventListener('resize', this._resize.bind(this));
        cancelAnimationFrame(this.animationFrameId);
        clearTimeout(this.timeoutId);
        this.animationFrameId = null;
        this.timeoutId = null;

        if (this.canvas) {
            this.$(this.canvas).fadeOut(500, () => this.$(this.canvas).remove());
        }
        if (this.onComplete) {
            this.onComplete();
        }
    }
}
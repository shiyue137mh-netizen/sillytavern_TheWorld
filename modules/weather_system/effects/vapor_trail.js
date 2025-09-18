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
        const s2 = s / 2;
        if (s > 0 && cloudImage) {
            ctx.drawImage(cloudImage, this.x - s2, this.y - s2, s, s);
        }
    }
}

// --- Plane Class ---
class Plane {
    constructor(x, y, r, w, h) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.w = w;
        this.h = h;
        this.vx = (1 + Math.random()) * 2.5; // Ensure it moves right
        this.vy = this.vx * (rand(1) || -1) * 0.2; // Slower vertical speed
        this.angle = Math.atan2(this.vy, this.vx) + Math.PI / 2;
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

    draw(ctx, planeImage) {
        const s = this.r;
        const s2 = s / 2;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.drawImage(planeImage, -s2, -s2, s, s);
        ctx.restore();
    }
}


export class VaporTrailFX {
    constructor({ $, $fxTarget, onComplete }) {
        this.$ = $;
        this.$fxTarget = $fxTarget;
        this.onComplete = onComplete;

        this.canvas = null;
        this.ctx = null;
        this.particleCanvas = null;
        this.particleCtx = null;
        this.planeCanvas = null;
        this.planeCtx = null;

        this.particles = [];
        this.plane = null;
        this.animationFrameId = null;
        
        this.settings = {
            bunch: 5,
            maxRadius: 4,
            minRadius: 3,
            particleDisp: 10,
            planeSize: 40,
            planeSizeMin: 30
        };

        this.planeImage = null;
        this.cloudImage = null;
        this._planeImageSrc = 'data:image/png;base64,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';
        this.cloudImage = this._createCloudImage();

        this._loadImages();
    }
    
    _loadImages() {
        const planeImg = new Image();
        planeImg.onload = () => {
            this.planeImage = this._colorize(planeImg, 244, 244, 244, 1);
            if (this.planeImage && this.cloudImage) this._start();
        };
        planeImg.src = this._planeImageSrc;
    }

    _createCloudImage(w = 32, h = 32) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = w;
        tempCanvas.height = h;
        const imgCtx = tempCanvas.getContext("2d");
        const gradient = imgCtx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        imgCtx.fillStyle = gradient;
        imgCtx.fillRect(0, 0, w, h);
        return tempCanvas;
    }

    _colorize(image, r, g, b, a) {
        const newCanvas = document.createElement('canvas');
        const newCtx = newCanvas.getContext('2d');
        newCanvas.width = image.width;
        newCanvas.height = image.height;
        newCtx.drawImage(image, 0, 0);
        const imgData = newCtx.getImageData(0, 0, newCanvas.width, newCanvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
        }
        newCtx.putImageData(imgData, 0, 0);
        return newCanvas;
    }

    _start() {
        if (this.animationFrameId) return;
        this.animationFrameId = requestAnimationFrame(this._animLoop.bind(this));
    }

    init() {
        this.canvas = this.$('<canvas>').addClass('tw-vapor-trail-canvas').get(0);
        this.ctx = this.canvas.getContext('2d');
        this.$fxTarget.append(this.canvas);
        
        this.particleCanvas = document.createElement('canvas');
        this.particleCtx = this.particleCanvas.getContext('2d');
        
        this.planeCanvas = document.createElement('canvas');
        this.planeCtx = this.planeCanvas.getContext('2d');

        this._resize();
        window.addEventListener('resize', this._resize.bind(this));
    }

    _resize() {
        if (!this.canvas || !this.$fxTarget) return;
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
        if (!this.canvas) return;

        this._drawParticles();
        this._drawPlanes();

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.particleCanvas, 0, 0);
        this.ctx.drawImage(this.planeCanvas, 0, 0);
        
        if (this.plane && this.plane.isOffscreen && this.particles.length === 0) {
            this.destroy();
            return;
        }

        this.animationFrameId = requestAnimationFrame(this._animLoop.bind(this));
    }
    
    _drawParticles() {
        this.particleCtx.save();
        this.particleCtx.globalCompositeOperation = 'destination-out';
        this.particleCtx.fillStyle = 'rgba(0, 0, 0, .1)';
        this.particleCtx.fillRect(0, 0, this.particleCanvas.width, this.particleCanvas.height);
        this.particleCtx.globalCompositeOperation = 'screen';

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
            this.plane.draw(this.planeCtx, this.planeImage);
            this.plane.update();
            this._createParticlesForPlane(this.plane);
        }
    }

    _createParticlesForPlane(p) {
        for (let l = this.settings.bunch; l > 0; l--) {
            const gr = p.r / 6;
            const x = p.x + (p.r / 3.5) * (-p.vx / Math.abs(p.vx));
            const y = p.y + (p.r / 3.5) * (-p.vy / Math.abs(p.vy));
            
            const x1 = p.vx > 0 ? gr : -gr;
            const y1 = p.vy > 0 ? -gr : gr;
            this._appendParticle({ x: x + x1, y: y + y1 }, { x: x + rand(this.settings.particleDisp) + x1, y: y + rand(this.settings.particleDisp) + y1 });
            
            const x2 = p.vx > 0 ? -gr : gr;
            const y2 = p.vy > 0 ? gr : -gr;
            this._appendParticle({ x: x + x2, y: y + y2 }, { x: x + rand(this.settings.particleDisp) + x2, y: y + rand(this.settings.particleDisp) + y2 });
        }
    }

    _appendParticle(from, target) {
        this.particles.push(new Particle(from.x, from.y, unsigRand(this.settings.maxRadius, this.settings.minRadius), target));
    }

    destroy() {
        if (!this.animationFrameId) return;
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
        if (this.canvas) {
            this.$(this.canvas).remove();
        }
        if (this.onComplete) {
            this.onComplete();
        }
    }
}
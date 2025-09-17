/**
 * The World - RainyDay (raindrop on glass) Effect
 * This module contains the complete, standalone logic for rendering the raindrop effect.
 */

// This entire module is an IIFE that returns the RainyDay class.
export const RainyDay = (function() {
    
    // --- Internal helper classes ---
    function Drop(rainyday, centerX, centerY, min, base) {
        this.x = Math.floor(centerX);
        this.y = Math.floor(centerY);
        this.r1 = (Math.random() * base) + min;
        this.rainyday = rainyday;
        
        var iterations = 4;
        this.r2 = 0.8 * this.r1;
        this.linepoints = rainyday.getLinepoints(iterations);
        
        this.context = rainyday.context;
        this.reflection = rainyday.reflected;
        this.intid = null;
    }

    Drop.prototype.draw = function() {
        this.context.save();
        this.context.beginPath();

        let point = this.linepoints.first;
        let rad, theta;
        rad = this.r2 + 0.5 * Math.random() * (this.r2 - this.r1);
        theta = (Math.PI * 2 * point.x);
        this.context.moveTo(this.x + rad * Math.cos(theta), this.y + rad * Math.sin(theta));
        while (point.next != null) {
            point = point.next;
            rad = this.r2 + 0.5 * Math.random() * (this.r2 - this.r1);
            theta = (Math.PI * 2 * point.x);
            this.context.lineTo(this.x + rad * Math.cos(theta), this.y + rad * Math.sin(theta));
        }
        this.context.closePath();
        this.context.clip();

        if (this.reflection) {
            this.context.drawImage(this.reflection, this.x - this.r1, this.y - this.r1, this.r1 * 2, this.r1 * 2);
        }
        
        this.context.restore();
    };

    Drop.prototype.clear = function(force) {
        this.context.clearRect(this.x - this.r1 - 1, this.y - this.r1 - 1, 2 * this.r1 + 2, 2 * this.r1 + 2);
        const shouldStop = force || (this.y - this.r1 > this.rainyday.height) || (this.x - this.r1 > this.rainyday.width) || (this.x + this.r1 < 0);
        if (shouldStop) {
            clearInterval(this.intid);
            this.intid = null;
            const index = this.rainyday.drops.indexOf(this);
            if (index > -1) {
                this.rainyday.drops.splice(index, 1);
            }
        }
        return shouldStop;
    };

    Drop.prototype.animate = function() {
        this.intid = setInterval(() => {
            const stopped = this.rainyday.gravity(this);
            if (!stopped && this.rainyday.trail) {
                this.rainyday.trail(this);
            }
        }, Math.floor(1000 / this.rainyday.VARIABLE_FPS));
    };

    // --- RainyDay main constructor ---
    function RainyDayConstructor(options) {
        this.parentElement = options.parentElement;
        this.img = options.image;
        this.opacity = options.opacity || 1;

        if (!this.parentElement || !this.img) {
            // No logger here, but parent module should handle this.
            return;
        }

        this.width = options.width;
        this.height = options.height;
        
        this.drops = [];
        this.createDropInterval = null;

        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.parentElement.appendChild(this.canvas);
        this.context_bg = this.canvas.getContext('2d');

        this.prepareBackground();
        this.prepareGlass();

        this.trail = this.TRAIL_DROPS;
        this.gravity = this.GRAVITY_NON_LINEAR;
        this.VARIABLE_GRAVITY_THRESHOLD = 3;
        this.VARIABLE_GRAVITY_ANGLE = Math.PI / 2;
        this.VARIABLE_FPS = 24;
    }

    RainyDayConstructor.prototype.getLinepoints = function(iterations) {
        var pointList = {}; pointList.first = { x: 0, y: 1 };
        var lastPoint = { x: 1, y: 1 }; var minY = 1; var maxY = 1;
        var point; var nextPoint; var dx, newX, newY;
        pointList.first.next = lastPoint;
        for (var i = 0; i < iterations; i++) {
            point = pointList.first;
            while (point.next != null) {
                nextPoint = point.next; dx = nextPoint.x - point.x;
                newX = 0.5 * (point.x + nextPoint.x); newY = 0.5 * (point.y + nextPoint.y);
                newY += dx * (Math.random() * 2 - 1);
                var newPoint = { x: newX, y: newY };
                if (newY < minY) { minY = newY; } else if (newY > maxY) { maxY = newY; }
                newPoint.next = nextPoint; point.next = newPoint; point = nextPoint;
            }
        }
        if (maxY != minY) {
            var normalizeRate = 1 / (maxY - minY); point = pointList.first;
            while (point != null) { point.y = normalizeRate * (point.y - minY); point = point.next; }
        } else {
            point = pointList.first; while (point != null) { point.y = 1; point = point.next; }
        }
        return pointList;
    };

    RainyDayConstructor.prototype.TRAIL_DROPS = function(drop) {
        if (!drop.trail_y || drop.y - drop.trail_y >= Math.random() * 10 * drop.r1) {
            drop.trail_y = drop.y;
            const trailDrop = new Drop(this, drop.x, drop.y - drop.r1 - 5, 0, Math.ceil(drop.r1 / 5));
            this.drops.push(trailDrop);
            trailDrop.draw();
            setTimeout(() => {
                trailDrop.clear(true);
                const index = this.drops.indexOf(trailDrop);
                if (index > -1) { this.drops.splice(index, 1); }
            }, 1000 + Math.random() * 1000);
        }
    };

    RainyDayConstructor.prototype.prepareBackground = function() { this.context_bg.clearRect(0, 0, this.width, this.height); };

    RainyDayConstructor.prototype.prepareGlass = function() {
        this.glass = document.createElement('canvas');
        this.glass.width = this.width; this.glass.height = this.height;
        this.glass.style.position = "absolute"; this.glass.style.top = this.canvas.offsetTop + 'px'; this.glass.style.left = this.canvas.offsetLeft + 'px';
        this.parentElement.appendChild(this.glass); this.context = this.glass.getContext('2d');
        this.glass.style.opacity = this.opacity;
    };
    
    RainyDayConstructor.prototype.prepareReflections = function() {
        this.reflected = document.createElement('canvas');
        this.reflected.width = this.width; this.reflected.height = this.height;
        const ctx = this.reflected.getContext('2d');
        
        const imgRatio = this.img.naturalWidth / this.img.naturalHeight; const canvasRatio = this.width / this.height;
        let sx = 0, sy = 0, sWidth = this.img.naturalWidth, sHeight = this.img.naturalHeight;

        if (imgRatio > canvasRatio) { sWidth = this.img.naturalHeight * canvasRatio; sx = (this.img.naturalWidth - sWidth) / 2;
        } else { sHeight = this.img.naturalWidth / canvasRatio; sy = (this.img.naturalHeight - sHeight) / 2; }

        ctx.translate(0, this.height); ctx.scale(1, -1);
        ctx.drawImage(this.img, sx, sy, sWidth, sHeight, 0, 0, this.width, this.height);
    };

    RainyDayConstructor.prototype.rain = function(presets, speed) {
        this.prepareReflections(); this.stop(true);
        if (speed > 0) {
            this.presets = presets;
            this.PRIVATE_GRAVITY_FORCE_FACTOR_Y = (this.VARIABLE_FPS * 0.005) / 25;
            this.PRIVATE_GRAVITY_FORCE_FACTOR_X = ((Math.PI / 2) - this.VARIABLE_GRAVITY_ANGLE) * (this.VARIABLE_FPS * 0.005) / 50;

            this.createDropInterval = setInterval(() => {
                const random = Math.random();
                for (let i = 0; i < presets.length; i++) {
                    if (random < presets[i][2]) {
                        const preset = presets[i];
                        this.putDrop(new Drop(this, Math.random() * this.width, Math.random() * this.height, preset[0], preset[1]));
                        break;
                    }
                }
            }, speed);
        }
    };

    RainyDayConstructor.prototype.stop = function(keepCanvas = false) {
        clearInterval(this.createDropInterval);
        this.drops.forEach(drop => drop.clear(true));
        this.drops = [];
        if (!keepCanvas) {
            if (this.canvas) this.canvas.remove();
            if (this.glass) this.glass.remove();
        }
    };

    RainyDayConstructor.prototype.putDrop = function(drop) {
        this.drops.push(drop);
        drop.draw();
        
        if (this.gravity && drop.r1 > this.VARIABLE_GRAVITY_THRESHOLD) {
            drop.animate();
        } else {
            setTimeout(() => {
                const index = this.drops.indexOf(drop);
                if (index > -1) {
                    this.drops.splice(index, 1);
                    drop.context.clearRect(drop.x - drop.r1 - 1, drop.y - drop.r1 - 1, 2 * drop.r1 + 2, 2 * drop.r1 + 2);
                }
            }, 3000 + Math.random() * 2000);
        }
    };
    
    RainyDayConstructor.prototype.GRAVITY_NON_LINEAR = function(drop) {
        if (drop.clear()) return true;
        if (!drop.seed || drop.seed < 0) {
            drop.seed = Math.floor(Math.random() * this.VARIABLE_FPS);
            drop.skipping = drop.skipping === false;
            drop.slowing = true;
        }
        drop.seed--;
        if (drop.yspeed) {
            if (drop.slowing) {
                drop.yspeed /= 1.05; drop.xspeed /= 1.05;
                if (drop.yspeed < this.PRIVATE_GRAVITY_FORCE_FACTOR_Y) drop.slowing = false;
            } else if (drop.skipping) {
                const speedFactor = 1 + (drop.r1 / 2);
                drop.yspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_Y * speedFactor;
                drop.xspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_X * speedFactor;
            } else {
                drop.yspeed += 15 * this.PRIVATE_GRAVITY_FORCE_FACTOR_Y * drop.r1;
                drop.xspeed += 15 * this.PRIVATE_GRAVITY_FORCE_FACTOR_X * drop.r1;
            }
        } else {
            const speedFactor = 1 + Math.random() + (drop.r1 / 2);
            drop.yspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_Y * speedFactor;
            drop.xspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_X * speedFactor;
        }
        drop.y += drop.yspeed; drop.x += drop.xspeed;
        drop.draw(); return false;
    };
    
    return RainyDayConstructor;
})();
/**
 * The World - 3D Clouds Effect
 * @description Renders volumetric clouds using CSS 3D transforms.
 * Adapted from "Clouds using CSS 3D Transforms" by Jaume Sanchez (https://codepen.io/spite/pen/DgQzLv)
 */

export class Clouds3dFX {
    constructor({ $, config, logger, state }) {
        this.$ = $;
        this.config = config;
        this.logger = logger;
        this.state = state;

        this.isActive = false;
        this.layers = [];
        this.bases = [];
        this.world = null;
        this.viewport = null;
        this.elapsed = 0;
        this.d = 0;
        this.density = { count: 1.0 };
        this.animationFrameId = null;
        this.lastFrameTime = 0;

        this._updateLoop = this._updateLoop.bind(this);
    }

    activate(period, weather, density, $fxTarget, options = {}) {
        const transitionDuration = options.transitionDuration || '7s';

        if (this.isActive) {
            const nextDensity = density || { count: 1.0, wind: -1 };
            const shouldRegenerate = this.density.count !== nextDensity.count;
            this.density = nextDensity;
            this.updateCloudColor(period, weather);
            if (shouldRegenerate) this._generate(transitionDuration);
            return;
        }

        this.logger.log('[3D Clouds] Activating...');
        this.isActive = true;
        this.density = density || { count: 1.0, wind: -1 };

        if (!$fxTarget || $fxTarget.length === 0) {
            this.logger.error('[3D Clouds] FX Target layer not found. Cannot activate.');
            this.isActive = false;
            return;
        }

        this.viewport = this.$('<div>').attr('id', 'clouds-viewport').get(0);
        this.world = this.$('<div>').attr('id', 'clouds-world').get(0);
        this.viewport.appendChild(this.world);
        $fxTarget.append(this.viewport);

        this._generate(transitionDuration);
        this.updateCloudColor(period, weather);
        this._updateLoop();
    }

    deactivate() {
        if (!this.isActive) {
            return;
        }
        this.logger.log('[3D Clouds] Deactivating...');
        this.isActive = false;

        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;

        if (this.viewport) {
            this.$(this.viewport).remove();
        }

        this.layers = [];
        this.bases = [];
        this.world = null;
        this.viewport = null;
        this.elapsed = 0;
        this.lastFrameTime = 0;
    }

    updateCloudColor(period, weather) {
        if (!this.isActive || !this.world) return;

        let filter = 'brightness(1)'; // Default: White clouds for day
        const isBadWeather = weather.includes('雷') || weather.includes('雨') || weather.includes('雪') || weather.includes('阴');

        if (isBadWeather) {
            // Bad weather logic: Weather type is primary, time of day is secondary.
            if (period.includes('夜')) {
                // Very dark clouds for night storms
                filter = 'brightness(0.2) contrast(1.1) grayscale(0.7)';
            } else if (period.includes('黄昏') || period.includes('日出') || period.includes('日落') || period.includes('清晨')) {
                // Dark, but not black clouds for twilight storms
                filter = 'brightness(0.4) contrast(1.0) saturate(0.6) grayscale(0.5)';
            } else {
                // Standard stormy day clouds
                filter = 'brightness(0.65) contrast(0.9) saturate(0.7) grayscale(0.3)';
            }
        } else {
            // Clear weather logic: Time of day is primary.
            if (period.includes('夜')) {
                filter = 'brightness(0.25) contrast(1.2) grayscale(0.7)'; // Dark night clouds
            } else if (period.includes('黄昏')) {
                filter = 'brightness(0.5) contrast(1.0) saturate(0.9) grayscale(0.4)'; // Mid-gray dusk clouds
            } else if (period.includes('日出') || period.includes('日落') || period.includes('清晨')) {
                filter = 'sepia(0.6) hue-rotate(-30deg) saturate(1.6) brightness(0.9)'; // Colorful sunrise/sunset
            } else {
                // Default to bright day clouds
                filter = 'brightness(1)';
            }
        }

        this.$(this.world).find('.cloudLayer').css('filter', filter);
    }


    triggerLightning() {
        if (!this.isActive || !this.world) return;
        // The screen flash is now handled by WeatherSystem to be perfectly
        // in sync with the lightning SVG strike. This function is now a no-op
        // to prevent the cloud compression visual bug.
    }

    _generate(transitionDuration = '7s') {
        this.layers = [];
        this.bases = [];
        this.$(this.world).empty();
        const baseCount = this.density.count >= 3 ? 8 : 10;
        const cloudCount = Math.min(36, Math.max(6, Math.floor(baseCount * this.density.count)));
        this.logger.log(`[3D Clouds] Generating ${cloudCount} cloud clusters based on density ${this.density.count}`);

        for (let j = 0; j < cloudCount; j++) {
            this._createCloud(transitionDuration);
        }
    }

    _createCloud(transitionDuration) {
        const div = document.createElement('div');
        div.className = 'cloudBase';
        const x = 900 - (Math.random() * 1800);
        const y = 420 - (Math.random() * 840);
        const z = 320 - (Math.random() * 640);
        const drift = 0.8 + Math.random() * 1.6;
        const bobPhase = Math.random() * Math.PI * 2;
        const bobAmount = 1 + Math.random() * 2.5;
        const t = `translateX(${x}px) translateY(${y}px) translateZ(${z}px)`;
        div.style.transform = t;
        div.dataset.baseX = x;
        div.dataset.baseY = y;
        div.dataset.baseZ = z;
        div.dataset.drift = drift;
        div.dataset.bobPhase = bobPhase;
        div.dataset.bobAmount = bobAmount;
        this.world.appendChild(div);
        this.bases.push(div);

        const layerCount = this.density.count >= 3 ? 2 + Math.round(Math.random()) : 3 + Math.round(Math.random() * 2);
        for (let j = 0; j < layerCount; j++) {
            const cloud = document.createElement('div');
            cloud.style.opacity = `${0.6 + Math.random() * 0.4}`;
            cloud.className = 'cloudLayer';
            cloud.style.transition = `filter ${transitionDuration} ease-in-out`;

            const x = 256 - (Math.random() * 512);
            const y = 256 - (Math.random() * 512);
            const z = 100 - (Math.random() * 200);
            const a = Math.random() * 360;
            const s = 0.5 + Math.random();

            cloud.dataset.x = x * 0.2;
            cloud.dataset.y = y * 0.2;
            cloud.dataset.z = z;
            cloud.dataset.a = a;
            cloud.dataset.s = s;

            const transform = `translateX(${cloud.dataset.x}px) translateY(${cloud.dataset.y}px) translateZ(${cloud.dataset.z}px) rotateZ(${a}deg) scale(${s})`;
            cloud.style.transform = transform;

            div.appendChild(cloud);
            this.layers.push(cloud);
        }
    }

    _updateLoop() {
        if (!this.isActive) return;

        const now = performance.now();
        const deltaSeconds = this.lastFrameTime ? Math.min((now - this.lastFrameTime) / 1000, 0.05) : 0.016;
        this.lastFrameTime = now;
        this.elapsed += deltaSeconds;

        this.world.style.transform = `translateZ(${this.d}px)`;

        const windLevel = Math.max(0, Number(this.density.wind) || 0);
        const windMultiplier = 0.55 + windLevel * 0.45;
        const horizontalSpeed = 5 * windMultiplier;
        const verticalFrequency = 0.05 + windLevel * 0.015;
        const verticalAmplitudeScale = 0.7 + windLevel * 0.15;

        for (const base of this.bases) {
            const baseX = Number(base.dataset.baseX) || 0;
            const baseY = Number(base.dataset.baseY) || 0;
            const baseZ = Number(base.dataset.baseZ) || 0;
            const drift = Number(base.dataset.drift) || 0;
            const bobPhase = Number(base.dataset.bobPhase) || 0;
            const bobAmount = Number(base.dataset.bobAmount) || 0;

            let x = baseX + this.elapsed * drift * horizontalSpeed;
            while (x > 980) x -= 1960;

            const y = baseY + Math.sin((this.elapsed * verticalFrequency) + bobPhase) * bobAmount * verticalAmplitudeScale;
            base.style.transform = `translateX(${x}px) translateY(${y}px) translateZ(${baseZ}px)`;
        }

        for (const cloud of this.layers) {
            const x = Number(cloud.dataset.x) || 0;
            const y = Number(cloud.dataset.y) || 0;
            const z = Number(cloud.dataset.z) || 0;
            const a = Number(cloud.dataset.a) || 0;
            const s = Number(cloud.dataset.s) || 1;

            cloud.style.transform = [
                `translateX(${x}px)`,
                `translateY(${y}px)`,
                `translateZ(${z}px)`,
                'rotateX(0deg)',
                'rotateY(0deg)',
                `rotateZ(${a}deg)`,
                `scale(${s})`
            ].join(' ');
        }

        this.animationFrameId = requestAnimationFrame(this._updateLoop);
    }
}

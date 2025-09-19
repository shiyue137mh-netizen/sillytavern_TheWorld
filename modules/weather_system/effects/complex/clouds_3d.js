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
        this.world = null;
        this.viewport = null;
        this.worldXAngle = 0;
        this.worldYAngle = 0;
        this.d = 0; 
        this.density = { count: 1.0 };
        this.animationFrameId = null;

        this._updateLoop = this._updateLoop.bind(this);
    }

    activate(period, weather, density, $fxTarget, options = {}) {
        const transitionDuration = options.transitionDuration || '7s';

        if (this.isActive) {
            this.updateCloudColor(period, weather);
            if (this.density.count !== (density || {count:1.0}).count) {
                 this.density = density || { count: 1.0 };
                 this._generate(transitionDuration);
            }
            return;
        }

        this.logger.log('[3D Clouds] Activating...');
        this.isActive = true;
        this.density = density || { count: 1.0 };

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
        this.world = null;
        this.viewport = null;
    }

    updateCloudColor(period, weather) {
        if (!this.isActive || !this.world) return;
    
        let filter = 'brightness(1)'; // Default: White clouds for day
    
        // Priority 1: Severe Weather -> Darkest clouds
        if (weather.includes('雷') || weather.includes('暴雨')) {
            filter = 'brightness(0.25) contrast(1.2) grayscale(0.7)';
        }
        // Priority 2: Normal Precipitation -> Gray clouds
        else if (weather.includes('雨') || weather.includes('雪') || weather.includes('阴')) {
            filter = 'brightness(0.75) contrast(0.9) saturate(0.8) grayscale(0.2)';
        }
        // Priority 3: Time of Day (if weather is clear-ish)
        else if (period.includes('夜')) {
            filter = 'brightness(0.25) contrast(1.2) grayscale(0.7)'; // Dark night clouds
        }
        else if (period.includes('黄昏')) { // The new transitional period requested
            filter = 'brightness(0.5) contrast(1.0) saturate(0.9) grayscale(0.4)'; // Mid-gray dusk clouds
        }
        else if (period.includes('日出') || period.includes('日落') || period.includes('清晨')) {
            filter = 'sepia(0.6) hue-rotate(-30deg) saturate(1.6) brightness(0.9)'; // Colorful sunrise/sunset
        }
        
        // The default 'brightness(1)' is used if no other condition is met (daytime).
        
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
        this.$(this.world).empty();
        // PERFORMANCE OPTIMIZATION: Reduced the base number of cloud clusters
        const baseCount = 12;
        const cloudCount = Math.min(60, Math.floor(baseCount * this.density.count));
        this.logger.log(`[3D Clouds] Generating ${cloudCount} cloud clusters based on density ${this.density.count}`);

        for (let j = 0; j < cloudCount; j++) {
            this._createCloud(transitionDuration);
        }
    }

    _createCloud(transitionDuration) {
        const div = document.createElement('div');
        div.className = 'cloudBase';
        const x = 800 - (Math.random() * 1600);
        const y = 800 - (Math.random() * 1600);
        const z = 400 - (Math.random() * 800);
        const t = `translateX(${x}px) translateY(${y}px) translateZ(${z}px)`;
        div.style.transform = t;
        this.world.appendChild(div);

        // PERFORMANCE OPTIMIZATION: Reduced the number of layers per cluster
        for (let j = 0; j < 4 + Math.round(Math.random() * 4); j++) {
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
            cloud.dataset.speed = 0.02 * Math.random();

            const transform = `translateX(${cloud.dataset.x}px) translateY(${cloud.dataset.y}px) translateZ(${cloud.dataset.z}px) rotateZ(${a}deg) scale(${s})`;
            cloud.style.transform = transform;

            div.appendChild(cloud);
            this.layers.push(cloud);
        }
    }

    _updateLoop() {
        if (!this.isActive) return;

        this.worldYAngle += 0.005; 
        this.worldXAngle += 0.002;

        const t = `translateZ(${this.d}px) rotateX(${this.worldXAngle}deg) rotateY(${this.worldYAngle}deg)`;
        this.world.style.transform = t;

        for (let j = 0; j < this.layers.length; j++) {
            const layer = this.layers[j];
            layer.dataset.a = parseFloat(layer.dataset.a) + parseFloat(layer.dataset.speed);
            const transform = `
                translateX(${layer.dataset.x}px) 
                translateY(${layer.dataset.y}px) 
                translateZ(${layer.dataset.z}px) 
                rotateY(${-this.worldYAngle}deg) 
                rotateX(${-this.worldXAngle}deg) 
                rotateZ(${layer.dataset.a}deg) 
                scale(${layer.dataset.s})
            `;
            layer.style.transform = transform;
        }

        this.animationFrameId = requestAnimationFrame(this._updateLoop);
    }
}

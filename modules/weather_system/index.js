/**
 * The World - Weather System
 * @description Manages all weather and atmospheric effects.
 */
import { SakuraFX } from './effects/sakura.js';
import { RainyDay } from './effects/rainydrops.js';
import { Clouds3dFX } from './effects/complex/clouds_3d.js';

export class WeatherSystem {
    constructor({ $, state, config, logger, injectionEngine, timeGradient }) {
        this.$ = $;
        this.state = state;
        this.config = config;
        this.logger = logger;

        const effectDependencies = { $, state, config, logger, injectionEngine, timeGradient };
        
        this.sakuraInstance = null;
        this.rainyDayInstance = null;
        this.clouds3dInstance = new Clouds3dFX(effectDependencies);
        this.lightningLoopTimeout = null;
        this.globalLightningLoopTimeout = null;
        this.weatherEffects = {
            current: { type: null, variant: null, density: 0 },
            intervalId: null,
            particleClass: ''
        };
    }

    updateEffects(weatherString, periodString, seasonString, $panel, $toggleBtn) {
        const safeWeatherString = weatherString || '';
        const safePeriodString = periodString || '';
        const safeSeasonString = seasonString || '';

        this.logger.log('[天气系统] 正在更新天气效果...', { weather: safeWeatherString, period: safePeriodString, season: safeSeasonString });

        // Define Foreground (FG) and Background (BG) effect targets
        const $localFxContainer = $panel.find('.tw-fx-container-local');
        const $globalFgFxLayer = this.$(`#${this.config.FX_LAYER_ID}`);
        const $globalBgFxLayer = this.$(`#${this.config.FX_LAYER_BG_ID}`);
        
        const $fgFxTarget = this.state.isFxGlobal ? $globalFgFxLayer : $localFxContainer;
        const $bgFxTarget = this.state.isFxGlobal ? $globalBgFxLayer : $localFxContainer;


        const density = this.getWeatherDensity(safeWeatherString);
        const isRaining = safeWeatherString.includes('雨') && !safeWeatherString.includes('雪');
        const isSnowing = safeWeatherString.includes('雪');
        const isWindy = density.wind > 0;
        const isFoggy = safeWeatherString.includes('雾');
        const hasStars = safePeriodString.includes('夜') && safeWeatherString.includes('星') && !safeWeatherString.match(/([雨雪云雾])/);
        const hasFireflies = safePeriodString.includes('夜') && safeWeatherString.includes('萤火');
        const hasMeteors = safePeriodString.includes('夜') && safeWeatherString.includes('流星');
        const shouldShowSakura = safeWeatherString.includes('樱');
        const isCloudy = (safeWeatherString.includes('云') && !safeWeatherString.includes('无云')) || safeWeatherString.includes('阴') || isRaining || isSnowing || safeWeatherString.includes('雷');


        // 3D Clouds Effect (Rendered to BACKGROUND layer)
        if (this.state.weatherFxEnabled && isCloudy) {
            this.clouds3dInstance.activate(safePeriodString, safeWeatherString, density, $bgFxTarget);
        } else {
            this.clouds3dInstance.deactivate();
        }

        let newEffect = { type: null, variant: null, density: 0, targetCount: 0, particleClass: null, creator: null, interval: 0 };
        
        // All other particle effects are rendered to the FOREGROUND layer
        if (this.state.weatherFxEnabled) {
            this.logger.log('[天气系统] 天气粒子特效已启用。');
            if (isRaining) {
                newEffect = { type: 'rain', variant: isWindy ? 'windy' : 'normal', density: density.count, particleClass: 'particle-wrapper', targetCount: 50 * density.count, interval: 150 / density.speed,
                    creator: () => { const p = this.$('<div class="raindrop"></div>').css('opacity', Math.random()*.6+.2); if(isWindy) p.addClass(density.wind>=1.5?'slanted-strong':'slanted-light'); const w = this._createParticleWrapper(density, 'rain').append(p); $fgFxTarget.append(w); } };
            } else if (isSnowing) {
                newEffect = { type: 'snow', variant: isWindy ? 'windy' : 'normal', density: density.count, particleClass: 'particle-wrapper', targetCount: 40 * density.count, interval: 200 / density.speed,
                    creator: () => { const size = `${2 + Math.random() * 3}px`; const p = this.$('<div class="snowflake"></div>').css({ width: size, height: size, opacity: 0.5 + Math.random() * 0.5 }); const w = this._createParticleWrapper(density, 'snow').append(p); if (isWindy) w.find('.snowflake').css('animation-name', 'fall-sway'); $fgFxTarget.append(w); } };
            } else if (isWindy && !isCloudy) {
                 newEffect = { type: 'wind', variant: 'normal', density: density.count, particleClass: 'leaf', targetCount: 15 * density.count, interval: 300 / density.speed,
                    creator: () => { let p = (safeSeasonString.includes('春')) ? ['🍃', '🌸'] : (safeSeasonString.includes('秋')) ? ['🍂', '🍁'] : ['🍃']; const h = p[Math.floor(Math.random() * p.length)]; const l = this.$('<div></div>').addClass('leaf').html(h).css({ fontSize: `${12+Math.random()*8}px`, animationDuration: `${(10+Math.random()*8)/density.speed}s`, animationDelay: `-${Math.random()*10}s`, left: `${Math.random()*100}%`, animationName: this.state.isFxGlobal?'fall-sway-rotate-global':'fall-sway-rotate-local' }); $fgFxTarget.append(l); } };
            }
        } else {
            this.logger.log('[天气系统] 天气粒子特效已禁用。');
        }
        
        this._manageContinuousEffect(newEffect, $fgFxTarget);

        if (shouldShowSakura && !this.sakuraInstance) {
            this.logger.log('[天气系统] 正在激活樱花特效...');
            const canvas = this.$('<canvas>').addClass('sakura-canvas').get(0);
            $fgFxTarget.append(canvas);
            this.sakuraInstance = Object.create(SakuraFX);
            this.sakuraInstance.init(canvas);
        } else if (!shouldShowSakura && this.sakuraInstance) {
            this.logger.log('[天气系统] 正在停止樱花特效...');
            this.sakuraInstance.stop();
            this.sakuraInstance = null;
        }

        if (isRaining) {
            this.activateRainyDayEffect($panel);
        } else {
            if (this.rainyDayInstance) {
                this.rainyDayInstance.stop();
                this.rainyDayInstance = null;
            }
        }

        this._manageStaticEffect('fog-layer', isFoggy, 5, () => this.$('<div>').addClass('fog-layer').css({ animationDuration: `${20+Math.random()*15}s`, animationDelay: `${Math.random()*5}s`, opacity: Math.random()*.2+.1 }), $fgFxTarget);
        this._manageStaticEffect('star', hasStars, 80, () => { const yPos = Math.random()*50, opacity = 1-yPos/50, size=`${1+Math.random()*2}px`; return this.$('<div>').addClass('star').css({ width:size, height:size, left:`${Math.random()*100}%`, top:`${yPos}%`, animationDuration:`${3+Math.random()*4}s`, animationDelay:`${Math.random()*7}s`, opacity:opacity }); }, $fgFxTarget);
        this._manageStaticEffect('firefly', hasFireflies, 20 * density.count, () => { const size = `${2+Math.random()*2}px`; return this.$('<div>').addClass('firefly').css({ width:size, height:size, left:`${Math.random()*100}%`, top:`${Math.random()*100}%`, animationDuration:`${4+Math.random()*4}s`, animationDelay:`${Math.random()*8}s` }); }, $fgFxTarget);
        this._manageMeteorEffect(hasMeteors, $fgFxTarget);
        
        clearTimeout(this.lightningLoopTimeout);
        this.lightningLoopTimeout = null;
        clearTimeout(this.globalLightningLoopTimeout);
        this.globalLightningLoopTimeout = null;

        $fgFxTarget.find('.effect-thunder').remove(); 
        if (this.state.weatherFxEnabled && safeWeatherString.includes('雷')) {
            this.logger.log('[天气系统] 正在激活雷电效果。');
            
            this.clouds3dInstance.triggerLightning();
            this.startThunderstormEffect($toggleBtn); 

            if(this.state.isFxGlobal) {
                $fgFxTarget.append(this.$('<div>').addClass('effect-thunder')); 
                this.startGlobalThunderstormEffect($fgFxTarget);
            }
        }
    }

    startThunderstormEffect($container) {
        if (!$container || !$container.length) return;
        const createStrike = () => {
            const delay = 2000 + Math.random() * 6000;
            this.lightningLoopTimeout = setTimeout(() => {
                if ($container.hasClass('weather-thunderstorm')) { 
                    this.createLightningStrike($container[0]);
                    createStrike();
                }
            }, delay);
        };
        createStrike();
    }

    startGlobalThunderstormEffect($container) {
        if (!$container || !$container.length) return;
        const createStrike = () => {
            const delay = 5000; 
            this.globalLightningLoopTimeout = setTimeout(() => {
                if ($container.find('.effect-thunder').length > 0) {
                    this.createLightningStrike($container[0]);
                    createStrike();
                }
            }, delay);
        };
        createStrike();
    }

    createLightningStrike(container) {
        container.classList.add('lightning-flash');

        const cardWidth = container.offsetWidth;
        const cardHeight = container.offsetHeight;

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute('class', 'lightning-strike-svg');
        
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute('class', 'lightning-strike-path');

        let pathX = cardWidth * 0.2 + Math.random() * (cardWidth * 0.6);
        const yOffset = cardHeight * 0.15;
        const steps = 10;
        let points = `M${pathX},0`;

        for (let i = 0; i < steps; i++) {
            const x = pathX + (Math.random() * yOffset - (yOffset / 2));
            const y = (cardHeight / steps) * (i + 1);
            points += ` L${x},${y}`;
        }

        path.setAttribute('d', points);
        path.style.strokeWidth = `${1 + Math.random()}px`;

        svg.appendChild(path);
        container.appendChild(svg);

        setTimeout(() => {
            if (svg.parentNode) {
                svg.remove();
            }
            container.classList.remove('lightning-flash');
        }, 500); 
    }


    activateRainyDayEffect($panel) {
        if (!this.state.isRaindropFxOn) {
            if (this.rainyDayInstance) {
                this.rainyDayInstance.stop();
                this.rainyDayInstance = null;
            }
            return;
        }
        
        if (this.rainyDayInstance) return;

        const width = Math.floor($panel.width());
        const height = Math.floor($panel.height());
        
        if (width <= 0 || height <= 0) return;

        const $rainContainer = $panel.find('.tw-rain-layer').empty();
        const refractionUrl = this.config.RAIN_REFRACTION_URL;

        if (!refractionUrl) return;

        const bgImg = new Image();
        bgImg.crossOrigin = 'Anonymous';
        bgImg.onload = () => {
            this.rainyDayInstance = new RainyDay({ 
                image: bgImg,
                parentElement: $rainContainer[0], 
                width: width,
                height: height
            });
            this.rainyDayInstance.rain([ [1, 1, 0.8], [2, 2, 0.95], [3, 2, 0.96],[4, 1, 0.97], [5, 2, 0.98], [6, 3,1] ], 150);
        };
        bgImg.src = refractionUrl;
    }
    
    _manageContinuousEffect(newEffect, $fxTarget) {
        const oldEffect = this.weatherEffects;
        const isDifferentEffect = oldEffect.current.type !== newEffect.type || oldEffect.current.variant !== newEffect.variant;

        if (oldEffect.intervalId) {
            clearInterval(oldEffect.intervalId);
            oldEffect.intervalId = null;
        }

        if (isDifferentEffect) {
            if (oldEffect.particleClass) {
                const oldParticles = $fxTarget.children(`.${oldEffect.particleClass}`);
                if (oldParticles.length > 0) {
                    oldParticles.addClass('fading-out');
                    setTimeout(() => oldParticles.remove(), 3000);
                }
            }
            if (newEffect.type) {
                setTimeout(() => this._startGenerator(newEffect, $fxTarget), 200);
            }
        } else if (newEffect.type !== null) {
            const currentParticles = $fxTarget.children(`.${oldEffect.particleClass}`);
            const diff = newEffect.targetCount - currentParticles.length;

            if (diff > 0) {
                this._startGenerator(newEffect, $fxTarget);
            } else if (diff < 0) {
                currentParticles.slice(0, Math.abs(diff)).addClass('fading-out').delay(3000).remove(0);
            }
        }

        this.weatherEffects.current = newEffect.type ? { ...newEffect } : { type: null };
        this.weatherEffects.particleClass = newEffect.particleClass || '';
    }
    
    _startGenerator(effectConfig, $fxTarget) {
        const { creator, targetCount, particleClass, interval } = effectConfig;
        if (!creator) return;
        const batchSize = Math.max(1, Math.floor(targetCount / 10));
        const intervalId = setInterval(() => {
            const currentCount = $fxTarget.children(`.${particleClass}:not(.fading-out)`).length;
            
            if (currentCount >= targetCount) {
                clearInterval(intervalId);
                if (this.weatherEffects.intervalId === intervalId) { this.weatherEffects.intervalId = null; }
                return;
            }
            for (let i = 0; i < batchSize && ($fxTarget.children(`.${particleClass}:not(.fading-out)`).length < targetCount); i++) { 
                creator(); 
            }
        }, interval);
        this.weatherEffects.intervalId = intervalId;
    }
    
    _createParticleWrapper(density, type) {
        const isRaining = type === 'rain';
        const isWindy = density.wind > 0;
        const wrapper = this.$('<div></div>').addClass('particle-wrapper').css({
            left: isWindy ? `${Math.random() * 150 - 50}%` : `${Math.random() * 110 - 5}%`,
            animationDelay: `-${Math.random() * (isRaining ? 6 : 12)}s`,
            animationDuration: `${((isRaining ? 0.4 : 10) + Math.random() * (isRaining ? 0.4 : 10)) / density.speed}s`
        });
        if (isWindy) { wrapper.addClass(density.wind >= 1.5 ? 'angled-strong' : 'angled-light'); }
        return wrapper;
    }
    
    getWeatherDensity(weatherString) {
        if (!weatherString) return { count: 1.0, speed: 1.0, wind: -1 };
        const density = { count: 1.0, speed: 1.0, wind: -1 };
        
        if (weatherString.includes('暴') || weatherString.includes('阴')) { density.count = 5.0; density.speed = 2.0; } 
        else if (weatherString.includes('大') || weatherString.includes('强') || weatherString.includes('多云')) { density.count = 3.0; density.speed = 1.5; } 
        else if (weatherString.includes('中')) { density.count = 2.0; density.speed = 1.0; } 
        else if (weatherString.includes('小') || weatherString.includes('微') || weatherString.includes('少云')) { density.count = 0.5; density.speed = 0.8; }
        else if (weatherString.includes('无云'))  { density.count = 0; density.speed = 0;}
        
        if (weatherString.includes('风')) {
            if (weatherString.includes('狂') || weatherString.includes('暴')) { density.wind = 2.0; } 
            else if (weatherString.includes('大') || weatherString.includes('强')) { density.wind = 1.5; } 
            else { density.wind = 0.8; }
        }
        return density;
    }

    _manageStaticEffect(className, shouldShow, count, creator, $fxTarget) {
        const existing = $fxTarget.children(`.${className}`);
        if (shouldShow) {
            if (existing.length > 0) return;
            for (let i = 0; i < count; i++) { $fxTarget.append(creator()); }
        } else if (existing.length > 0) {
            existing.addClass('fading-out');
            setTimeout(() => existing.remove(), 3000);
        }
    }

    _manageMeteorEffect(shouldShow, $fxTarget) {
        const className = 'shooting_star';
        const existing = $fxTarget.children(`.${className}`);
        if (shouldShow) {
            if (existing.length > 0) return;
            for (let i = 0; i < 4; i++) {
                const meteor = this.$('<div>').addClass(className).css({
                    top: `${Math.random() * 60}%`,
                    animationDelay: `${Math.random() * 15}s`,
                    animationDuration: `${3 + Math.random() * 2.5}s`
                });
                $fxTarget.append(meteor);
            }
        } else if (existing.length > 0) {
            existing.addClass('fading-out');
            setTimeout(() => existing.remove(), 3000);
        }
    }

    clearAllWeatherEffects(forceClear = true) {
        if (this.weatherEffects.intervalId) clearInterval(this.weatherEffects.intervalId);
        if (this.lightningLoopTimeout) clearTimeout(this.lightningLoopTimeout);
        if (this.globalLightningLoopTimeout) clearTimeout(this.globalLightningLoopTimeout);
        this.weatherEffects.intervalId = null;
        this.lightningLoopTimeout = null;
        this.globalLightningLoopTimeout = null;
        this.weatherEffects.current = { type: null };
        if (this.rainyDayInstance) this.rainyDayInstance.stop();
        if (this.sakuraInstance) this.sakuraInstance.stop();
        if (this.clouds3dInstance) this.clouds3dInstance.deactivate();
        this.rainyDayInstance = null;
        this.sakuraInstance = null;
        const layers = [this.$(`#${this.config.FX_LAYER_ID}`), this.$(`#${this.config.PANEL_ID}`).find('.tw-fx-container-local')];
        layers.forEach($layer => {
            if ($layer.length) $layer.children().not('.tw-fx-glow, .sakura-canvas').remove();
        });
    }
}
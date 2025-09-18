/**
 * The World - Weather System
 * @description Manages all weather and atmospheric effects.
 */
import { SakuraFX } from './effects/sakura.js';
import { RainyDay } from './effects/rainydrops.js';
import { Clouds3dFX } from './effects/complex/clouds_3d.js';
import { VaporTrailFX } from './effects/vapor_trail.js';

export class WeatherSystem {
    constructor({ $, state, config, logger, injectionEngine, timeGradient }) {
        this.$ = $;
        this.state = state;
        this.config = config;
        this.logger = logger;

        const effectDependencies = { $, state, config, logger, injectionEngine, timeGradient };
        this.dependencies = effectDependencies;
        
        this.sakuraInstance = null;
        this.rainyDayInstance = null;
        this.clouds3dInstance = new Clouds3dFX(effectDependencies);
        this.vaporTrailInstance = null;
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
        const hasMeteors = safePeriodString.includes('夜') && safeWeatherString.includes('流星');
        const shouldShowSakura = safeWeatherString.includes('樱');
        const isCloudy = (safeWeatherString.includes('云') && !safeWeatherString.includes('无云')) || safeWeatherString.includes('阴') || isRaining || isSnowing || safeWeatherString.includes('雷');

        const isNight = safePeriodString.includes('夜');
        const noBadWeather = !safeWeatherString.match(/([雨雪雷])/);
        const isGoodWeather = !safeWeatherString.match(/([雨雪雷])/);
        const isClearSky = safeWeatherString.includes('晴') && !safeWeatherString.match(/([雨雪雷云雾])/);
        const hasMilkyWay = isNight && noBadWeather && safeWeatherString.includes('银河');
        const hasRegularStars = isNight && noBadWeather && safeWeatherString.includes('星') && !hasMilkyWay;
        const hasFireflies = isNight && safeWeatherString.includes('萤火');
        
        if (this.state.weatherFxEnabled && this.state.isCloudFxEnabled && isCloudy) {
            this.clouds3dInstance.activate(safePeriodString, safeWeatherString, density, $bgFxTarget);
        } else {
            this.clouds3dInstance.deactivate();
        }

        this._manageStaticEffect('star', hasRegularStars, 150, () => this._createComplexStar(), $bgFxTarget);

        if (hasMilkyWay) {
            this._renderMilkyWay($bgFxTarget);
        } else {
            const $existingMilkyWay = $bgFxTarget.find('.milky-way-container');
            if ($existingMilkyWay.length) {
                $existingMilkyWay.addClass('fading-out');
                setTimeout(() => $existingMilkyWay.remove(), 3000);
            }
        }
        
        let newEffect = { type: null, variant: null, density: 0, targetCount: 0, particleClass: null, creator: null, interval: 0 };
        if (this.state.weatherFxEnabled) {
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
        }
        this._manageContinuousEffect(newEffect, $fgFxTarget);
        this._manageStaticEffect('firefly', hasFireflies, 20 * density.count, () => { const size = `${2+Math.random()*2}px`; return this.$('<div>').addClass('firefly').css({ width:size, height:size, left:`${Math.random()*100}%`, top:`${Math.random()*100}%`, animationDuration:`${4+Math.random()*4}s`, animationDelay:`${Math.random()*8}s` }); }, $fgFxTarget);


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

        if (isRaining) { this.activateRainyDayEffect($panel); } 
        else if (this.rainyDayInstance) { this.rainyDayInstance.stop(); this.rainyDayInstance = null; }

        this._manageStaticEffect('fog-layer', isFoggy, 5, () => this.$('<div>').addClass('fog-layer').css({ animationDuration: `${20+Math.random()*15}s`, animationDelay: `${Math.random()*5}s`, opacity: Math.random()*.2+.1 }), $fgFxTarget);
        this._manageMeteorEffect(hasMeteors, $fgFxTarget);
        
        clearTimeout(this.lightningLoopTimeout); this.lightningLoopTimeout = null;
        clearTimeout(this.globalLightningLoopTimeout); this.globalLightningLoopTimeout = null;

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
        
        if (this.state.weatherFxEnabled) {
            if (isGoodWeather && !$fgFxTarget.children('.tw-bird-container').length) {
                if (Math.random() < 0.10) { 
                    this.logger.log('[天气系统] 正在触发飞鸟特效...');
                    this._createBirdAnimation($fgFxTarget);
                }
            }
            if (isClearSky && !this.vaporTrailInstance) {
                if (Math.random() < 0.20) { 
                    this.logger.log('[天气系统] 正在触发飞机尾迹云特效...');
                    this.vaporTrailInstance = new VaporTrailFX({
                        ...this.dependencies,
                        $fxTarget: $fgFxTarget,
                        onComplete: () => { this.vaporTrailInstance = null; }
                    });
                    this.vaporTrailInstance.init();
                }
            }
        }
    }

    _createComplexStar() {
        const nightsky = ["#280F36", "#632B6C", "#BE6590", "#FFC1A0", "#FE9C7F"];
        const rand = Math.random();
        const dur = 2 + Math.random() * 6;
        let $star;

        if (rand < 0.6) { // 60% chance for a simple white star
            const size = `${0.5 + Math.random() * 1.5}px`;
            $star = this.$('<div>').addClass('star').css({
                width: size, height: size
            });
            if (Math.random() < 0.5) $star.addClass('blink');
        } else if (rand < 0.8) { // 20% chance for a slightly bigger white star with shadow
            const size = `${2 + Math.random() * 1}px`;
            $star = this.$('<div>').addClass('star star-4').css({
                 width: size, height: size,
                 boxShadow: `0px 0px 6px 1px rgba(255,255,255,${0.3 + Math.random() * 0.3})`
            }).addClass('blink');
        } else { // 20% chance for a colored star
            const size = `${1 + Math.random() * 1}px`;
            const color = nightsky[Math.floor(Math.random() * nightsky.length)];
            const shadow = nightsky[Math.floor(Math.random() * nightsky.length)];
            $star = this.$('<div>').addClass('star star-1 blink').css({
                width: size, height: size,
                backgroundColor: color,
                boxShadow: `0px 0px 6px 1px ${shadow}`
            });
        }

        $star.css({
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            animationDuration: `${dur}s`,
            animationDelay: `${Math.random() * dur}s`,
            opacity: 0.4 + Math.random() * 0.6
        });
        return $star;
    }
    
    _renderMilkyWay($fxTarget) {
        if ($fxTarget.find('.milky-way-container').length > 0) return;

        this.logger.log('[天气系统] 渲染银河彩蛋...');
        const $container = this.$('<div>').addClass('milky-way-container');
        const $stars = this.$('<div>').addClass('stars');
        const $starsCross = this.$('<div>').addClass('stars-cross');
        const $starsCrossAux = this.$('<div>').addClass('stars-cross-aux');
        $container.append($stars, $starsCross, $starsCrossAux);

        const nightsky = ["#280F36", "#632B6C", "#BE6590", "#FFC1A0", "#FE9C7F"];
        const getRandomInt = (min, max) => Math.random() * (max - min) + min;

        const templates = {
            star0: (top, left, dur) => `<div class='star star-0' style='top:${top}%;left:${left}%;animation-duration:${dur}s;'></div>`,
            star1: (top, left, dur) => `<div class='star star-1 blink' style='top:${top}%;left:${left}%;animation-duration:${dur}s;'></div>`,
            star2: (top, left, dur) => `<div class='star star-2 blink' style='top:${top}%;left:${left}%;animation-duration:${dur}s;'></div>`,
            star4: (top, left, dur) => `<div class='star star-4 blink' style='top:${top}%;left:${left}%;animation-duration:${dur}s;'></div>`,
            star5: (top, left, dur, color) => `<div class='star star-5' style='top:${top}%;left:${left}%;animation-duration:${dur}s;background-color:${color}'></div>`,
            blur: (top, left, color) => `<div class='nebula-milky-way' style='top:${top}%;left:${left}%;background-color:${color}'></div>`,
            star1pt: (top, left, dur, color, shadow) => `<div class='star star-1 blink' style='top:${top}%;left:${left}%;animation-duration:${dur}s;background-color:${color};box-shadow:0px 0px 6px 1px ${shadow}'></div>`,
            star2pt: (top, left, dur, color, shadow) => `<div class='star star-2' style='top:${top}%;left:${left}%;animation-duration:${dur}s;background-color:${color};box-shadow:0px 0px 10px 1px ${shadow};opacity:0.7'></div>`
        };

        for (let i = 0; i < 500; i++) {
            $stars.append(templates.star1(getRandomInt(0, 40), getRandomInt(0, 100), getRandomInt(2, 5)));
            $stars.append(templates.star2(getRandomInt(20, 70), getRandomInt(0, 100), getRandomInt(4, 8)));
        }
        for (let i = 0; i < 150; i++) {
            $stars.append(templates.star0(getRandomInt(0, 50), getRandomInt(0, 100), getRandomInt(1, 2.5)));
            $stars.append(templates.star1(getRandomInt(0, 50), getRandomInt(0, 100), getRandomInt(2.5, 4)));
            $stars.append(templates.star2(getRandomInt(0, 50), getRandomInt(0, 100), getRandomInt(4, 5)));
        }
        for (let i = 0; i < 100; i++) {
            $stars.append(templates.star0(getRandomInt(40, 75), getRandomInt(0, 100), getRandomInt(1, 3)));
            $stars.append(templates.star1(getRandomInt(40, 75), getRandomInt(0, 100), getRandomInt(2, 4)));
        }
        for (let i = 0; i < 250; i++) {
            $stars.append(templates.star0(getRandomInt(0, 100), getRandomInt(0, 100), getRandomInt(1, 2)));
            $stars.append(templates.star1(getRandomInt(0, 100), getRandomInt(0, 100), getRandomInt(2, 5)));
            $stars.append(templates.star2(getRandomInt(0, 100), getRandomInt(0, 100), getRandomInt(1, 4)));
            $stars.append(templates.star4(getRandomInt(0, 70), getRandomInt(0, 100), getRandomInt(5, 7)));
        }
        for (let i = 0; i < 150; i++) {
            $stars.append(templates.star4(getRandomInt(0, 100), getRandomInt(0, 100), getRandomInt(5, 7)));
            const color1 = nightsky[Math.floor(getRandomInt(0, nightsky.length))];
            const shadow1 = nightsky[Math.floor(getRandomInt(0, nightsky.length))];
            $starsCross.append(templates.blur(getRandomInt(0, 100), getRandomInt(0, 100), color1));
            $starsCross.append(templates.star1pt(getRandomInt(0, 100), getRandomInt(0, 100), getRandomInt(6, 12), color1, shadow1));
        }
        for (let i = 0; i < 50; i++) {
            const color2 = nightsky[Math.floor(getRandomInt(0, nightsky.length))];
            const shadow2 = nightsky[Math.floor(getRandomInt(0, nightsky.length))];
            if(i % 2 === 0){
                $stars.append(templates.star5(getRandomInt(0, 50), getRandomInt(0, 100), getRandomInt(5, 7), color2));
            }
            $starsCrossAux.append(templates.blur(getRandomInt(0, 100), getRandomInt(0, 100), color2));
            $starsCrossAux.append(templates.star2pt(getRandomInt(0, 100), getRandomInt(0, 100), getRandomInt(4, 10), color2, shadow2));
        }

        $fxTarget.append($container);
    }

    _createBirdAnimation($fxTarget) {
        const animationClass = `tw-fly-path--${1 + Math.floor(Math.random() * 4)}`;
        const duration = 15 + Math.random() * 10;
        
        const $birdContainer = this.$('<div>')
            .addClass('tw-bird-container')
            .addClass(animationClass)
            .css({
                'top': `${10 + Math.random() * 40}%`,
                'animation-duration': `${duration}s`
            });
            
        const $bird = this.$('<div>')
            .addClass('tw-bird')
            .addClass(`tw-bird--${1 + Math.floor(Math.random() * 4)}`);
            
        $birdContainer.append($bird);
        $fxTarget.append($birdContainer);
        
        setTimeout(() => {
            $birdContainer.remove();
        }, duration * 1000);
    }
    
    _clearAllParticles($fxTarget) {
        const selectors = ['.particle-wrapper', '.leaf', '.star', '.firefly', '.shooting_star', '.fog-layer', '.milky-way-container'];
        const particles = $fxTarget.children(selectors.join(', '));
        if (particles.length > 0) {
            this.logger.log(`[天气系统] Clearing particles: ${selectors.join(', ')}`);
            particles.remove();
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
        const layers = [this.$(`#${this.config.FX_LAYER_ID}`), this.$(`#${this.config.PANEL_ID}`).find('.tw-fx-container-local'), this.$(`#${this.config.FX_LAYER_BG_ID}`)];
        layers.forEach($layer => {
            if ($layer.length) $layer.children().not('.tw-fx-glow, .sakura-canvas').remove();
        });
    }
}
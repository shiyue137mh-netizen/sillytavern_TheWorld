/**
 * The World - Weather System
 * @description Manages all weather and atmospheric effects.
 */
import { Clouds3dFX } from './effects/complex/clouds_3d.js';
import { FireworksFX } from './effects/fireworks.js';
import { RainyDay } from './effects/rainydrops.js';
import { SakuraFX } from './effects/sakura.js';

export class WeatherSystem {
    constructor({ $, state, config, logger, injectionEngine, timeGradient }) {
        this.$ = $;
        this.state = state;
        this.config = config;
        this.logger = logger;

        this.dependencies = { $, state, config, logger, injectionEngine, timeGradient };

        this.sakuraInstance = null;
        this.lastWeatherString = ''; // Add state to track last weather
        this.rainyDayInstance = null;
        this.clouds3dInstance = new Clouds3dFX({ $, config, logger, state });
        this.fireworksInstance = null;
        this.lightningLoopTimeout = null;
        this.globalLightningLoopTimeout = null;
        this.weatherEffects = {
            current: { type: null, variant: null, density: 0 },
            intervalId: null,
            particleClass: '',
            windPulseIntervalId: null,
            windPulseResetTimeout: null,
            windPulseTarget: null,
        };
        this.milkyWayTimeout = null;
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
        const isRaining = safeWeatherString.includes('雨')
            && !safeWeatherString.includes('雪')
            && !safeWeatherString.includes('无雨')
            && !safeWeatherString.includes('停雨')
            && !safeWeatherString.includes('雨停')
            && !safeWeatherString.includes('不下雨');
        const isSnowing = safeWeatherString.includes('雪');
        const isWindy = density.wind > 0;
        const isFoggy = safeWeatherString.includes('雾');
        const hasMeteors = safePeriodString.includes('夜') && safeWeatherString.includes('流星');
        const shouldShowSakura = safeWeatherString.includes('樱');
        const wasSakura = this.lastWeatherString.includes('樱');
        const shouldShowFireworks = safeWeatherString.includes('烟花');
        const isCloudy = (safeWeatherString.includes('云') && !safeWeatherString.includes('无云')) || safeWeatherString.includes('阴') || isRaining || isSnowing || safeWeatherString.includes('雷');

        const isNight = safePeriodString.includes('夜');
        const noBadWeather = !safeWeatherString.match(/([雨雪雷])/);
        const isGoodWeather = !safeWeatherString.match(/([雨雪雷])/);
        const isClearSky = safeWeatherString.includes('晴') && !safeWeatherString.match(/([雨雪雷云雾])/);
        const hasMilkyWay = isNight && noBadWeather && safeWeatherString.includes('银河');
        const wasMilkyWay = this.lastWeatherString.includes('银河');
        const hasRegularStars = isNight && noBadWeather && safeWeatherString.includes('星') && !hasMilkyWay;
        const hasFireflies = isNight && safeWeatherString.includes('萤火');

        if (this.state.weatherFxEnabled && this.state.isHighPerformanceFxEnabled && isCloudy) {
            this.clouds3dInstance.activate(safePeriodString, safeWeatherString, density, $bgFxTarget);
        } else {
            this.clouds3dInstance.deactivate();
        }

        this._manageStaticEffect('star', hasRegularStars, 96, () => this._createComplexStar(), $bgFxTarget);

        // --- Milky Way Burst Logic (Sakura Style) ---
        const $existingMilkyWay = $bgFxTarget.find('.milky-way-container');

        if (this.state.isHighPerformanceFxEnabled && hasMilkyWay) {
            // Only trigger if it's a NEW activation
            if (!wasMilkyWay) {
                this.logger.log('[天气系统] 首次激活银河特效 (爆发模式)...');
                clearTimeout(this.milkyWayTimeout); // Clear any lingering timeout
                this._renderMilkyWay($bgFxTarget);

                this.milkyWayTimeout = setTimeout(() => {
                    const $milkyWay = $bgFxTarget.find('.milky-way-container');
                    if ($milkyWay.length) {
                        $milkyWay.addClass('fading-out');
                        setTimeout(() => {
                            $milkyWay.remove();
                            // Fallback to regular stars after the show
                            if (!this._isAnyStaticEffectActive($bgFxTarget, ['star'])) {
                                this._manageStaticEffect('star', true, 96, () => this._createComplexStar(), $bgFxTarget);
                            }
                        }, 3000);
                    }
                }, 15000); // 15 seconds burst
            }
            // If it was already milky way, do nothing and let the timeout run its course.
        } else {
            // If the state is no longer milky way, ensure it's cleaned up.
            if ($existingMilkyWay.length) {
                clearTimeout(this.milkyWayTimeout);
                this.milkyWayTimeout = null;
                $existingMilkyWay.addClass('fading-out');
                setTimeout(() => $existingMilkyWay.remove(), 3000);
            }
        }

        const shouldWindPulse = this.state.weatherFxEnabled
            && isWindy
            && (isRaining || isSnowing || (!isCloudy && !shouldShowSakura));
        if (shouldWindPulse) {
            this._startWindPulse($fgFxTarget, density.wind);
        } else {
            this._stopWindPulse($fgFxTarget);
        }

        let newEffect = { type: null, variant: null, density: 0, targetCount: 0, particleClass: null, creator: null, interval: 0 };
        if (this.state.weatherFxEnabled) {
            if (isRaining) {
                newEffect = { type: 'rain', variant: isWindy ? 'windy' : 'normal', density: density.count, particleClass: 'particle-wrapper', targetCount: Math.round(18 + density.count * 16), interval: 260 / density.speed,
                    creator: () => {
                        const p = this.$('<div class="raindrop"></div>').css('opacity', Math.random() * .6 + .2);
                        if (isWindy) p.addClass(density.wind >= 1.5 ? 'slanted-strong' : 'slanted-light');
                        const w = this._bindParticleLifecycle(this._createParticleWrapper(density, 'rain'), 'rain').append(p);
                        w.css({
                            '--tw-curve-a': (0.18 + Math.random() * 0.52).toFixed(3),
                            '--tw-curve-b': (0.12 + Math.random() * 0.46).toFixed(3),
                            '--tw-curve-c': (0.08 + Math.random() * 0.34).toFixed(3)
                        });
                        $fgFxTarget.append(w);
                    } };
            } else if (isSnowing) {
                newEffect = { type: 'snow', variant: isWindy ? 'windy' : 'normal', density: density.count, particleClass: 'particle-wrapper', targetCount: Math.round(14 + density.count * 12), interval: 320 / density.speed,
                    creator: () => {
                        const size = `${2 + Math.random() * 3}px`;
                        const p = this.$('<div class="snowflake"></div>').css({ width: size, height: size, opacity: 0.5 + Math.random() * 0.5 });
                        const w = this._bindParticleLifecycle(this._createParticleWrapper(density, 'snow'), 'snow').append(p);
                        w.css({
                            '--tw-curve-a': (0.22 + Math.random() * 0.62).toFixed(3),
                            '--tw-curve-b': (0.18 + Math.random() * 0.52).toFixed(3),
                            '--tw-curve-c': (0.10 + Math.random() * 0.40).toFixed(3)
                        });
                        if (isWindy) w.find('.snowflake').css('animation-name', 'fall-sway');
                        $fgFxTarget.append(w);
                    } };
            } else if (isWindy && !isCloudy && !shouldShowSakura) { // MODIFIED: Do not show wind effect if sakura is active
                 newEffect = {
                    type: 'wind', variant: 'normal', density: density.count, particleClass: 'leaf', targetCount: 15 * density.count, interval: 300 / density.speed,
                    creator: () => {
                        const particles = (safeSeasonString.includes('春')) ? ['🍃', '🌸'] : (safeSeasonString.includes('秋')) ? ['🍂', '🍁'] : ['🍃'];
                        const symbol = particles[Math.floor(Math.random() * particles.length)];
                        const baseAnimation = this.state.isFxGlobal
                            ? 'fall-sway-rotate-global'
                            : 'fall-sway-rotate-local';
                        const driftScale = 0.7 + Math.random() * 0.9;

                        const leaf = this.$('<div></div>').addClass('leaf').html(symbol).css({
                            fontSize: `${12 + Math.random() * 8}px`,
                            animationDuration: `${(9 + Math.random() * 9) / density.speed}s`,
                            animationDelay: `-${Math.random() * 10}s`,
                            left: `${Math.random() * 100}%`,
                            animationName: baseAnimation,
                            '--tw-wind-drift-scale': driftScale.toFixed(3),
                            '--tw-curve-a': (0.32 + Math.random() * 0.45).toFixed(3),
                            '--tw-curve-b': (0.22 + Math.random() * 0.42).toFixed(3),
                            '--tw-curve-c': (0.15 + Math.random() * 0.32).toFixed(3)
                        });
                        $fgFxTarget.append(leaf);
                    }
                 };
            }
        }
        this._manageContinuousEffect(newEffect, $fgFxTarget);
        this._manageStaticEffect('firefly', hasFireflies, Math.max(8, Math.round(12 * density.count)), () => { const size = `${2+Math.random()*2}px`; return this.$('<div>').addClass('firefly').css({ width:size, height:size, left:`${Math.random()*100}%`, top:`${Math.random()*100}%`, animationDuration:`${4+Math.random()*4}s`, animationDelay:`${Math.random()*8}s` }); }, $fgFxTarget);


        // --- New Sakura Logic ---
        if (this.state.isHighPerformanceFxEnabled && shouldShowSakura) {
            if (!wasSakura) {
                // First time activation: dense burst
                this.logger.log('[天气系统] 首次激活樱花特效 (密集模式)...');
                const $canvas = this.$('<canvas>').addClass('sakura-canvas');
                $fgFxTarget.append($canvas);
                SakuraFX.init($canvas.get(0), {
                    density: 'dense',
                    windStrength: Math.max(0, density.wind),
                });
                this.sakuraInstance = SakuraFX;
            } else if (this.sakuraInstance?.setWindStrength) {
                this.sakuraInstance.setWindStrength(Math.max(0, density.wind));
            }
            // If it was already sakura, do nothing, let the instance manage its state.
        } else if (wasSakura && this.sakuraInstance) {
            // Weather changed from sakura to something else
            this.logger.log('[天气系统] 正在停止樱花特效...');
            this.sakuraInstance.stop();
            this.sakuraInstance = null;
        }
        // --- End New Sakura Logic ---

        if (this.state.isHighPerformanceFxEnabled && shouldShowFireworks && !this.fireworksInstance) {
            this.logger.log('[天气系统] 正在激活烟花特效...');
            this.fireworksInstance = new FireworksFX({ ...this.dependencies, $fxTarget: $fgFxTarget });
            this.fireworksInstance.init();
        } else if ((!shouldShowFireworks || !this.state.isHighPerformanceFxEnabled) && this.fireworksInstance) {
            this.logger.log('[天气系统] 正在停止烟花特效...');
            this.fireworksInstance.stop();
            this.fireworksInstance = null;
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


        // Update last weather string at the end
        this.lastWeatherString = safeWeatherString;
    }

    triggerEffect(effectName) {
        this.logger.log(`[Debug] 强制触发特效: ${effectName}`);
        const $fxTarget = this.state.isFxGlobal
            ? this.$(`#${this.config.FX_LAYER_ID}`)
            : this.$(`#${this.config.PANEL_ID}`).find('.tw-fx-container-local');

        if (!$fxTarget.length) {
            this.logger.error(`[Debug] 无法触发特效，找不到FX目标层。`);
            return;
        }

        switch(effectName) {
            case 'bird':
            case 'vapor_trail':
                this.logger.warn(`[Debug] 特效 ${effectName} 已移除。`);
                break;
            default:
                this.logger.warn(`[Debug] 未知的特效名称: ${effectName}`);
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

        // PERFORMANCE OPTIMIZATION: reduce both total nodes and concurrent blinking nodes.
        const blinkChance = 0.08;
        const templates = {
            star: (sizeClass, top, left, dur, doBlink) => `<div class='star ${sizeClass} ${doBlink ? 'blink' : ''}' style='top:${top}%;left:${left}%;animation-duration:${dur}s;'></div>`,
            starColor: (sizeClass, top, left, dur, color, shadow, doBlink) => `<div class='star ${sizeClass} ${doBlink ? 'blink' : ''}' style='top:${top}%;left:${left}%;animation-duration:${dur}s;background-color:${color};box-shadow:0px 0px 6px 1px ${shadow};'></div>`,
            blur: (top, left, color) => `<div class='nebula-milky-way' style='top:${top}%;left:${left}%;background-color:${color}'></div>`
        };

        // Generate a reduced number of static stars while preserving layered depth.
        for (let i = 0; i < 420; i++) {
            const size = `star-${Math.floor(Math.random() * 3)}`;
            $stars.append(templates.star(size, getRandomInt(0, 100), getRandomInt(0, 100), getRandomInt(2, 8), Math.random() < blinkChance));
        }

        // Generate a smaller number of larger/brighter stars.
        for (let i = 0; i < 90; i++) {
            const size = `star-${3 + Math.floor(Math.random() * 2)}`;
            $stars.append(templates.star(size, getRandomInt(0, 100), getRandomInt(0, 100), getRandomInt(4, 10), Math.random() < blinkChance));
        }

        // Generate colored stars and nebula for the main cross.
        for (let i = 0; i < 54; i++) {
            const color1 = nightsky[Math.floor(getRandomInt(0, nightsky.length))];
            const shadow1 = nightsky[Math.floor(getRandomInt(0, nightsky.length))];
            $starsCross.append(templates.blur(getRandomInt(0, 100), getRandomInt(0, 100), color1));
            $starsCross.append(templates.starColor('star-1', getRandomInt(0, 100), getRandomInt(0, 100), getRandomInt(6, 12), color1, shadow1, Math.random() < blinkChance));
        }

        // Generate colored stars and nebula for the auxiliary cross.
        for (let i = 0; i < 20; i++) {
            const color2 = nightsky[Math.floor(getRandomInt(0, nightsky.length))];
            const shadow2 = nightsky[Math.floor(getRandomInt(0, nightsky.length))];
            $starsCrossAux.append(templates.blur(getRandomInt(0, 100), getRandomInt(0, 100), color2));
            $starsCrossAux.append(templates.starColor('star-2', getRandomInt(0, 100), getRandomInt(0, 100), getRandomInt(4, 10), color2, shadow2, false));
        }

        $fxTarget.append($container);
    }

    // _createBirdAnimation method removed as per user request

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
            const delay = 25000 + Math.random() * 5000;
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
            const delay = 25000 + Math.random() * 5000;
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
            this.rainyDayInstance.rain([ [1, 1, 0.82], [2, 2, 0.95], [3, 2, 0.975], [4, 1, 0.992], [5, 1, 0.997], [6, 1, 1] ], 220);
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
                setTimeout(() => this._startGenerator(newEffect, $fxTarget), 120);
            }
        } else if (newEffect.type !== null) {
            this._startGenerator(newEffect, $fxTarget);
        }

        this.weatherEffects.current = newEffect.type ? { ...newEffect } : { type: null };
        this.weatherEffects.particleClass = newEffect.particleClass || '';
    }

    _startGenerator(effectConfig, $fxTarget) {
        const { creator, targetCount, particleClass, interval } = effectConfig;
        if (!creator) return;
        const burstFloor = Math.max(1, Math.floor(targetCount * 0.55));
        const burstCeiling = Math.max(burstFloor + 1, targetCount);
        const batchSize = Math.max(1, Math.min(8, Math.ceil(targetCount / 6)));
        const intervalId = setInterval(() => {
            const currentCount = $fxTarget.children(`.${particleClass}:not(.fading-out)`).length;

            if (currentCount >= burstCeiling) {
                return;
            }

            const deficit = Math.max(0, burstFloor - currentCount);
            const burstSize = deficit > 0 ? Math.min(batchSize + deficit, batchSize * 2) : batchSize;

            for (let i = 0; i < burstSize; i++) {
                creator();
            }
        }, Math.max(120, interval));
        this.weatherEffects.intervalId = intervalId;
    }

    _bindParticleLifecycle($particleWrapper, type) {
        if (!$particleWrapper || !$particleWrapper.length) return $particleWrapper;

        let fallbackMs = 5000;
        const animationDuration = parseFloat($particleWrapper.css('animation-duration')) || 0;
        if (animationDuration > 0) {
            fallbackMs = animationDuration * 1000 + 250;
        } else if (type === 'snow') {
            fallbackMs = 12000;
        }

        const element = $particleWrapper.get(0);
        const cleanup = () => {
            if (element && element.parentNode) {
                element.remove();
            }
        };

        $particleWrapper.one('animationend', (event) => {
            if (event.target === element) cleanup();
        });

        setTimeout(cleanup, fallbackMs);
        return $particleWrapper;
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

    _startWindPulse($fxTarget, windStrength = 0.8) {
        if (!$fxTarget || !$fxTarget.length) return;

        const targetElement = $fxTarget.get(0);
        const oldTarget = this.weatherEffects.windPulseTarget;
        if (oldTarget && oldTarget !== targetElement) {
            this._stopWindPulse(this.$(oldTarget));
        }

        this.weatherEffects.windPulseTarget = targetElement;

        if (this.weatherEffects.windPulseIntervalId) {
            return;
        }

        $fxTarget.css({
            '--tw-gust-x': '0vw',
            '--tw-gust-angle': '0deg'
        });

        const pulse = () => {
            const direction = Math.random() < 0.5 ? -1 : 1;
            const gustFactor = Math.max(0.35, windStrength) * (0.55 + Math.random() * 0.9);
            const gustX = direction * (8 + Math.random() * 22) * gustFactor;
            const gustAngle = direction * (3 + Math.random() * 9) * gustFactor;

            $fxTarget.css({
                '--tw-gust-x': `${gustX.toFixed(2)}vw`,
                '--tw-gust-angle': `${gustAngle.toFixed(2)}deg`
            });

            if (this.weatherEffects.windPulseResetTimeout) {
                clearTimeout(this.weatherEffects.windPulseResetTimeout);
            }

            this.weatherEffects.windPulseResetTimeout = setTimeout(() => {
                $fxTarget.css({
                    '--tw-gust-x': '0vw',
                    '--tw-gust-angle': '0deg'
                });
                this.weatherEffects.windPulseResetTimeout = null;
            }, 900 + Math.random() * 900);
        };

        pulse();
        this.weatherEffects.windPulseIntervalId = setInterval(pulse, 2200);
    }

    _stopWindPulse($fxTarget = null) {
        if (this.weatherEffects.windPulseIntervalId) {
            clearInterval(this.weatherEffects.windPulseIntervalId);
            this.weatherEffects.windPulseIntervalId = null;
        }
        if (this.weatherEffects.windPulseResetTimeout) {
            clearTimeout(this.weatherEffects.windPulseResetTimeout);
            this.weatherEffects.windPulseResetTimeout = null;
        }

        const $target = ($fxTarget && $fxTarget.length)
            ? $fxTarget
            : (this.weatherEffects.windPulseTarget ? this.$(this.weatherEffects.windPulseTarget) : null);

        if ($target && $target.length) {
            $target.css({
                '--tw-gust-x': '0vw',
                '--tw-gust-angle': '0deg'
            });
        }

        this.weatherEffects.windPulseTarget = null;
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

    _isAnyStaticEffectActive($fxTarget, classNames) {
        for (const className of classNames) {
            if ($fxTarget.children(`.${className}`).length > 0) {
                return true;
            }
        }
        return false;
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
        this._stopWindPulse();
        if (this.lightningLoopTimeout) clearTimeout(this.lightningLoopTimeout);
        if (this.globalLightningLoopTimeout) clearTimeout(this.globalLightningLoopTimeout);
        this.weatherEffects.intervalId = null;
        this.lightningLoopTimeout = null;
        this.globalLightningLoopTimeout = null;
        this.weatherEffects.current = { type: null };
        if (this.rainyDayInstance) this.rainyDayInstance.stop();
        if (this.sakuraInstance) this.sakuraInstance.stop();
        if (this.clouds3dInstance) this.clouds3dInstance.deactivate();
        if (this.fireworksInstance) this.fireworksInstance.stop();
        this.rainyDayInstance = null;
        this.sakuraInstance = null;
        this.fireworksInstance = null;
        const layers = [this.$(`#${this.config.FX_LAYER_ID}`), this.$(`#${this.config.PANEL_ID}`).find('.tw-fx-container-local'), this.$(`#${this.config.FX_LAYER_BG_ID}`)];
        layers.forEach($layer => {
            if ($layer.length) $layer.children().not('.tw-fx-glow, .sakura-canvas').remove();
        });
    }
}

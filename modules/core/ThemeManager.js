/**
 * The World - Panel Theme Manager
 * @description Manages the visual theme and atmospheric effects for the panel and toggle button.
 * V4: Implements two-layer background for the toggle button for smooth transitions.
 */
import { WeatherSystem } from '../weather_system/index.js';

export class ThemeManager {
    constructor(dependencies) {
        this.$ = dependencies.$;
        this.state = dependencies.state;
        this.config = dependencies.config;
        this.logger = dependencies.logger;
        
        this.weatherSystem = new WeatherSystem(dependencies);
        this.timeGradient = dependencies.timeGradient; // Use shared instance

        // State for panel background
        this.panelBgLayer1 = null;
        this.panelBgLayer2 = null;
        this.panelActiveLayer = 1;
        this.panelCurrentBackground = null;

        // State for toggle button background
        this.btnBgLayer1 = null;
        this.btnBgLayer2 = null;
        this.btnActiveLayer = 1;
        this.btnCurrentBackground = null;
    }

    // Generic layer creation helper
    _ensureBgLayers($container, layer1Prop, layer2Prop) {
        if (!$container.length) return false;
        if (!this[layer1Prop] || !$container.find(this[layer1Prop]).length) {
            this[layer1Prop] = this.$('<div>').addClass('tw-bg-layer-1').css('opacity', '1').appendTo($container).get(0);
        }
        if (!this[layer2Prop] || !$container.find(this[layer2Prop]).length) {
            this[layer2Prop] = this.$('<div>').addClass('tw-bg-layer-2').css('opacity', '0').appendTo($container).get(0);
        }
        return true;
    }
    
    // Generic background update helper
    _updateLayeredBackground(newBackground, currentBgProp, activeLayerProp, layer1Prop, layer2Prop) {
        if (newBackground === this[currentBgProp] || !this[layer1Prop] || !this[layer2Prop]) {
            return;
        }

        this[currentBgProp] = newBackground;
        requestAnimationFrame(() => {
            if (this[activeLayerProp] === 1) {
                this[layer2Prop].style.background = newBackground;
                this[layer1Prop].style.opacity = 0;
                this[layer2Prop].style.opacity = 1;
                this[activeLayerProp] = 2;
            } else {
                this[layer1Prop].style.background = newBackground;
                this[layer2Prop].style.opacity = 0;
                this[layer1Prop].style.opacity = 1;
                this[activeLayerProp] = 1;
            }
        });
    }

    applyThemeAndEffects(data) {
        if (!data) {
            this.logger.warn('[PanelThemeManager] applyThemeAndEffects called with no data.');
            data = {};
        }

        const $panel = this.$(`#${this.config.PANEL_ID}`);
        const $toggleBtn = this.$(`#${this.config.TOGGLE_BUTTON_ID}`);
        if (!$panel.length && !$toggleBtn.length) return;

        const timeString = data['时间'] || '12:00';
        const weatherString = data['天气'] || '晴';
        const periodString = data['时段']; 
        const season = data['季节'] || (timeString.match(/(春|夏|秋|冬)/) || [])[0];

        const theme = this.timeGradient.getThemeForTime({ timeString, weatherString, periodString });
        const definitivePeriod = theme.period;
        
        // --- Panel Theming ---
        if ($panel.length) {
            const $panelLayersContainer = $panel.find('.tw-theme-layers');
            if (this._ensureBgLayers($panelLayersContainer, 'panelBgLayer1', 'panelBgLayer2')) {
                 this._updateLayeredBackground(theme.background, 'panelCurrentBackground', 'panelActiveLayer', 'panelBgLayer1', 'panelBgLayer2');
            }
            $panel.removeClass('theme-light-text theme-dark-text')
                  .addClass(theme.brightness === 'light' ? 'theme-light-text' : 'theme-dark-text');
        }
        
        // --- Toggle Button Theming ---
        if ($toggleBtn.length) {
            if (this._ensureBgLayers($toggleBtn, 'btnBgLayer1', 'btnBgLayer2')) {
                this._updateLayeredBackground(theme.background, 'btnCurrentBackground', 'btnActiveLayer', 'btnBgLayer1', 'btnBgLayer2');
            }
            this.updateToggleButtonIcon(weatherString, definitivePeriod, $toggleBtn);
        }

        // --- Weather & Glow Effects ---
        this.weatherSystem.updateEffects(weatherString, definitivePeriod, season, $panel, $toggleBtn);
        
        if ($panel.length) {
            $panel.removeClass('glow-sunrise glow-sunset');
            if (weatherString.includes('晴')) {
                if (definitivePeriod.includes('日出') || definitivePeriod.includes('清晨')) $panel.addClass('glow-sunrise');
                else if (definitivePeriod.includes('日落') || definitivePeriod.includes('黄昏')) $panel.addClass('glow-sunset');
            }
        }
    }

    updateToggleButtonIcon(weather, period, $toggleBtn) {
        if (!$toggleBtn.length) return;
        
        // This function now ONLY handles the icon/animation inside the button.
        // The background is handled by the layered system.
        
        const currentClasses = $toggleBtn.attr('class');
        const hasWeatherClass = currentClasses && currentClasses.includes('weather-');

        let weatherClass = 'default';
        let innerHtml = '🌏';
        
        if (weather.includes('雷')) {
            weatherClass = 'weather-thunderstorm';
            innerHtml = `<div class="cloud cloud-back"></div><div class="cloud cloud-mid"></div><div class="cloud cloud-front"></div><ul><li></li><li></li><li></li><li></li><li></li></ul>`;
        } else if (weather.includes('雨')) {
            if (period.includes('夜')) weatherClass = 'weather-rainy-night';
            else weatherClass = 'weather-rainy';
            innerHtml = `<div class="cloud cloud-back"></div><div class="cloud cloud-mid"></div><div class="cloud cloud-front"></div><ul><li></li><li></li><li></li><li></li><li></li></ul>`;
        } else if (weather.includes('雪')) {
            weatherClass = 'weather-snowy';
            innerHtml = `<div class="cloud cloud-back"></div><div class="cloud cloud-mid"></div><div class="cloud cloud-front"></div><span class="snowe"></span><span class="snowex"></span><span class="stick"></span><span class="stick2"></span><ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>`;
        } else if (weather.includes('云') || weather.includes('阴')) {
             if (period.includes('夜')) {
                weatherClass = 'weather-night-cloudy';
                innerHtml = `<span class="moon"></span><div class="cloud cloud-back"></div><div class="cloud cloud-mid"></div><div class="cloud cloud-front"></div>`;
            } else {
                weatherClass = 'weather-cloudy';
                innerHtml = `<div class="cloud cloud-back"></div><div class="cloud cloud-mid"></div><div class="cloud cloud-front"></div>`;
            }
        } else if (period.includes('日出') || period.includes('日落')) {
            weatherClass = 'weather-sunrise-sunset';
            innerHtml = `<div class="horizon-line horizon-1"></div><div class="horizon-line horizon-2"></div><div class="horizon-line horizon-3"></div><div class="sun-disk"></div>`;
        } else if (weather.includes('晴') || weather.includes('星空')) {
            if (period.includes('夜')) {
                weatherClass = 'weather-night-clear';
                innerHtml = `<span class="moon"></span><ul><li></li><li></li><li></li><li></li><li></li></ul>`;
            } else {
                weatherClass = 'weather-sunny';
                innerHtml = `<span class="sun"></span>`;
            }
        } else if (weather.includes('樱')) {
            weatherClass = 'weather-sakura';
            innerHtml = `<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>`;
        } else if (weather.includes('萤火')) {
            weatherClass = 'weather-fireflies';
            innerHtml = `<ul><li></li><li></li><li></li><li></li><li></li></ul>`;
        }

        // Only update classes and HTML if they have changed to prevent flicker
        if (!$toggleBtn.hasClass(weatherClass) || !hasWeatherClass) {
            // Preserve background layers when clearing
            const bgLayers = $toggleBtn.find('.tw-bg-layer-1, .tw-bg-layer-2').detach();

            $toggleBtn.empty().attr('class', 'has-ripple').attr('id', this.config.TOGGLE_BUTTON_ID);
            $toggleBtn.append(bgLayers); // Re-attach background layers

            if (weatherClass === 'default') {
                $toggleBtn.css('font-size', '20px').append(innerHtml);
            } else {
                $toggleBtn.css('font-size', '5px').addClass(weatherClass).append(innerHtml);
            }
        }
    }
}
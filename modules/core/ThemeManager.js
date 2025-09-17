/**
 * The World - Panel Theme Manager
 * @description Manages the visual theme and atmospheric effects for the panel itself.
 */
import { WeatherSystem } from '../weather_system/index.js';

export class ThemeManager {
    constructor(dependencies) {
        this.$ = dependencies.$;
        this.state = dependencies.state;
        this.config = dependencies.config;
        this.logger = dependencies.logger;
        this.weatherSystem = new WeatherSystem(dependencies);
    }

    /**
     * Applies the correct theme class to the panel and updates weather effects
     * based on the latest world state data.
     * @param {object} data - The latest world state data.
     */
    applyThemeAndEffects(data) {
        if (!data) {
            this.logger.warn('[PanelThemeManager] applyThemeAndEffects called with no data.');
            // Even with no data, we should ensure the button has a default state.
            data = {}; 
        }

        const $panel = this.$(`#${this.config.PANEL_ID}`);
        const $toggleBtn = this.$(`#${this.config.TOGGLE_BUTTON_ID}`);
        if (!$panel.length) return;

        const period = data['时段'] || '';
        const weather = data['天气'] || '';
        const season = data['季节'] || (data['时间'] ? (data['时间'].match(/(春|夏|秋|冬)/) || [])[0] : null);

        // --- Panel Theming ---
        let panelTheme = 'day';
        if (period.includes('夜')) panelTheme = 'night';
        else if (period.includes('日落')) panelTheme = 'sunset';
        else if (period.includes('黄昏')) panelTheme = 'dusk';
        else if (period.includes('日出')) panelTheme = 'sunrise';
        else if (period.includes('清晨')) panelTheme = 'dawn';
        
        const isBadWeatherOnPanel = weather.includes('雨') || weather.includes('雪') || weather.includes('阴') || weather.includes('雷');
        if (isBadWeatherOnPanel) {
            panelTheme += '-rain';
        }
        
        $panel.attr('class', 'tw-panel').addClass(`theme-${panelTheme}`);

        // --- Toggle Button Theming ---
        this.updateToggleButton(weather, period, $toggleBtn);

        // --- Weather Effects ---
        this.weatherSystem.updateEffects(weather, period, season, $panel, $toggleBtn);
        
        // --- Glow Effects ---
        $panel.removeClass('glow-sunrise glow-sunset');
        if (weather.includes('晴')) {
            if (panelTheme.includes('sunrise') || panelTheme.includes('dawn')) $panel.addClass('glow-sunrise');
            else if (panelTheme.includes('sunset') || panelTheme.includes('dusk')) $panel.addClass('glow-sunset');
        }
    }

    /**
     * Updates the toggle button's appearance based on weather.
     * @param {string} weather - The weather string.
     * @param {string} period - The time of day string.
     * @param {jQuery} $toggleBtn - The jQuery object for the toggle button.
     */
    updateToggleButton(weather, period, $toggleBtn) {
        if (!$toggleBtn.length) return;
        
        // Clear previous state
        $toggleBtn.empty().attr('class', 'has-ripple').attr('id', this.config.TOGGLE_BUTTON_ID);

        let weatherClass = 'default';
        let innerHtml = '🌏'; // Default emoji

        if (weather.includes('雷')) {
            weatherClass = 'weather-thunderstorm';
            innerHtml = `
                <div class="cloud cloud-back"></div>
                <div class="cloud cloud-mid"></div>
                <div class="cloud cloud-front"></div>
                <ul><li></li><li></li><li></li><li></li><li></li></ul>`;
        } else if (weather.includes('雨')) {
            if (period.includes('夜')) {
                weatherClass = 'weather-rainy-night';
            } else {
                weatherClass = 'weather-rainy';
            }
            innerHtml = `
                <div class="cloud cloud-back"></div>
                <div class="cloud cloud-mid"></div>
                <div class="cloud cloud-front"></div>
                <ul><li></li><li></li><li></li><li></li><li></li></ul>`;
        } else if (weather.includes('雪')) {
            weatherClass = 'weather-snowy';
            innerHtml = `
                <div class="cloud cloud-back"></div><div class="cloud cloud-mid"></div><div class="cloud cloud-front"></div>
                <span class="snowe"></span><span class="snowex"></span>
                <span class="stick"></span><span class="stick2"></span>
                <ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>`;
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


        if (weatherClass === 'default') {
            $toggleBtn.css('font-size', '20px').html(innerHtml);
        } else {
            $toggleBtn.css('font-size', '5px').addClass(weatherClass).html(innerHtml);
        }
    }
}
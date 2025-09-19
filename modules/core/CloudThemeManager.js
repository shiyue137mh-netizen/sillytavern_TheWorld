/**
 * The World - Cloud Theme Manager
 * @description Manages loading and providing cloud color themes (CSS filters).
 */
import { Logger } from '../logger.js';

export class CloudThemeManager {
    constructor() {
        this.logger = Logger;
        this.themes = {};
        this.activeTheme = null;
        this.themeIds = ['default']; // Can be expanded later
    }

    async init() {
        await this.loadAvailableThemes();
        await this.applyTheme('default');
    }

    async loadAvailableThemes() {
        this.logger.log('正在加载可用的云朵主题...');
        for (const themeId of this.themeIds) {
            try {
                const scriptUrl = new URL(import.meta.url);
                const basePath = scriptUrl.pathname.substring(0, scriptUrl.pathname.lastIndexOf('/modules'));
                const themeUrl = `${basePath}/themes/clouds/${themeId}.json`;
                const response = await fetch(themeUrl);
                if (!response.ok) throw new Error(`获取 ${themeId}.json 失败: ${response.statusText}`);
                this.themes[themeId] = await response.json();
            } catch (error) {
                this.logger.error(`加载云朵主题 '${themeId}' 失败:`, error);
                alert(`FATAL: Failed to load cloud theme '${themeId}'. Error: ${error.message}`);
            }
        }
        this.logger.success(`加载了 ${Object.keys(this.themes).length} 个云朵主题。`);
    }
    
    applyTheme(themeId) {
        if (this.themes[themeId]) {
            this.activeTheme = this.themes[themeId];
            this.logger.log(`已应用云朵主题: ${this.activeTheme.name}`);
        } else {
            this.logger.error(`尝试应用不存在的云朵主题: ${themeId}`);
        }
    }

    getFilter(period, weather) {
        if (!this.activeTheme) return 'brightness(1)'; // Default white

        const overrides = this.activeTheme.weatherOverrides;
        const periods = this.activeTheme.periodFilters;
        weather = weather || '';

        // 夜晚有最高优先级
        if (period === '夜晚') {
            if (weather.includes('雨') || weather.includes('雷') || weather.includes('暴')) {
                return overrides['暴雨'] || periods['夜晚']; // 夜晚的雨/雷使用最暗的暴雨色
            }
            return periods['夜晚']; // 晴朗的夜晚
        }

        // 白天的天气优先级
        if (weather.includes('暴雨')) return overrides['暴雨'];
        if (weather.includes('雷')) return overrides['雷'];
        if (weather.includes('雨')) return overrides['雨'];
        if (weather.includes('雪')) return overrides['雪'];
        if (weather.includes('阴')) return overrides['阴'];
        
        // 晴朗白天的时段颜色
        if (period && periods[period]) {
            return periods[period];
        }

        // 最终回退
        return periods['默认'] || 'brightness(1)';
    }
}

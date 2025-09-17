/**
 * The World - Global Dynamic Theme Engine
 * @description Manages and injects a dynamic theme into the entire SillyTavern UI,
 *              using a layered approach with smooth transitions.
 */
export class TimeGradient {
    constructor({ config, logger, injectionEngine, state }) {
        this.config = config;
        this.logger = logger;
        this.injectionEngine = injectionEngine;
        this.state = state;
        this.isActive = false;
        this.currentBg = '';
        this.bgLayer1 = null;
        this.bgLayer2 = null;
        this.activeLayer = 1; // Start with layer 1 as active
    }

    activate() {
        if (this.isActive) return;
        this.logger.log('全局动态主题引擎已激活。');
        this.isActive = true;
        this._createBgLayers();
        this.updateTheme();
    }

    deactivate() {
        if (!this.isActive) return;
        this.logger.log('全局动态主题引擎已停用。');
        this.isActive = false;
        this.injectionEngine.removeCss(this.config.GLOBAL_THEME_STYLE_ID);
        this._removeBgLayers();
    }
    
    _createBgLayers() {
        if (!this.bgLayer1) {
            this.bgLayer1 = document.createElement('div');
            this.bgLayer1.id = 'the_world_bg_layer_1';
            this.bgLayer1.style.opacity = '1';
            document.body.appendChild(this.bgLayer1);
        }
        if (!this.bgLayer2) {
            this.bgLayer2 = document.createElement('div');
            this.bgLayer2.id = 'the_world_bg_layer_2';
            this.bgLayer2.style.opacity = '0';
            document.body.appendChild(this.bgLayer2);
        }
    }
    
    _removeBgLayers() {
        this.bgLayer1?.remove();
        this.bgLayer2?.remove();
        this.bgLayer1 = null;
        this.bgLayer2 = null;
    }

    updateTheme() {
        if (!this.isActive) return;

        const worldState = this.state.latestWorldStateData || {};
        const period = worldState['时段'] || 'day';
        const weather = worldState['天气'] || '';
        
        let themeName = 'day';
        if (period.includes('夜')) themeName = 'night';
        else if (period.includes('日落')) themeName = 'sunset';
        else if (period.includes('黄昏')) themeName = 'dusk';
        else if (period.includes('日出')) themeName = 'sunrise';
        else if (period.includes('清晨')) themeName = 'dawn';

        const isBadWeather = weather.includes('雨') || weather.includes('雪') || weather.includes('阴') || weather.includes('雷');
        if (isBadWeather) {
            themeName += '-rain';
        }
        
        const themeConfig = this._getThemeConfig(themeName);
        this._applyTheme(themeConfig, themeName);
    }

    _getThemeConfig(themeName) {
        const lightTextMain = '#F0F8FF';
        const lightTextEm = '#B0C4DE';
        const rainTextMain = '#ecf0f1';
        const rainTextEm = '#bdc3c7';

        const themes = {
            day:       { bg: 'linear-gradient(160deg, #87CEEB, #F0F8FF)', text: '#2c3e50', em: '#34495e' },
            night:     { bg: 'linear-gradient(160deg, #0f141c, #1a202c)', text: lightTextMain, em: lightTextEm }, // Corrected color
            dusk:      { bg: 'linear-gradient(160deg, #f7b733, #fc4a1a)', text: '#fff', em: '#ffdd99' },
            dawn:      { bg: 'linear-gradient(160deg, #5c7a96, #8eacc2, #cde0f0)', text: lightTextMain, em: lightTextEm },
            sunrise:   { bg: 'linear-gradient(to top, #f3904f, #3b4371)', text: '#f5e5d5', em: '#e9b38c' },
            sunset:    { bg: 'linear-gradient(to bottom, #0d1a2f, #3c3e4f, #9a6a4f, #d78a4e)', text: '#f5e5d5', em: '#e9b38c' },
            'day-rain':{ bg: 'linear-gradient(160deg, #6c7a89, #95a5a6)', text: rainTextMain, em: rainTextEm },
            'dusk-rain': { bg: 'linear-gradient(160deg, #4b5563, #5a505f)', text: rainTextMain, em: rainTextEm },
            'dawn-rain': { bg: 'linear-gradient(160deg, #495a69, #6a7c8b)', text: rainTextMain, em: rainTextEm },
            'sunrise-rain': { bg: 'linear-gradient(160deg, #8b7e6a, #a99b86)', text: rainTextMain, em: rainTextEm },
            'night-rain':{ bg: 'linear-gradient(160deg, #0f141c, #2f3644)', text: rainTextMain, em: rainTextEm }, // Corrected color
            'sunset-rain': { bg: 'linear-gradient(to bottom, #242a36, #4a4a52)', text: rainTextMain, em: rainTextEm },
        };

        return themes[themeName] || themes['day'];
    }
    
    _applyTheme(themeConfig, themeName) {
        const { bg, text, em } = themeConfig;

        // First, ensure the transition styles are applied.
        let cssString = `
            #the_world_bg_layer_1, #the_world_bg_layer_2 {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                z-index: -10;
                background-size: cover;
                background-position: center;
                transition: opacity 2.5s ease-in-out;
            }
            body {
                background: transparent !important;
            }
        `;
        
        // Then, add immersive styles if needed.
        if (this.state.isImmersiveModeEnabled) {
            this.logger.log('[TheWorld] 应用沉浸模式样式');
            cssString += `
                :root {
                    --SmartThemeBodyColor: ${text} !important;
                    --SmartThemeEmColor: ${em} !important;
                    --SmartThemeChatTintColor: transparent !important;
                    --SmartThemeBlurTintColor: transparent !important;
                }
                #chat {
                    background: transparent !important;
                    backdrop-filter: blur(8px) !important;
                    -webkit-backdrop-filter: blur(8px) !important;
                }
                .mes_content {
                    background-color: rgba(20, 25, 30, 0.5) !important;
                }
            `;
        } else {
            this.logger.log('[TheWorld] 应用仅背景模式样式');
        }
        
        this.injectionEngine.injectCss(this.config.GLOBAL_THEME_STYLE_ID, cssString);

        // Now, trigger the background change which will use the transition.
        if (bg !== this.currentBg && this.bgLayer1 && this.bgLayer2) {
            requestAnimationFrame(() => {
                if (this.activeLayer === 1) {
                    this.bgLayer2.style.backgroundImage = bg;
                    this.bgLayer1.style.opacity = 0;
                    this.bgLayer2.style.opacity = 1;
                    this.activeLayer = 2;
                } else {
                    this.bgLayer1.style.backgroundImage = bg;
                    this.bgLayer2.style.opacity = 0;
                    this.bgLayer1.style.opacity = 1;
                    this.activeLayer = 1;
                }
                this.currentBg = bg;
            });
        }
    }
}
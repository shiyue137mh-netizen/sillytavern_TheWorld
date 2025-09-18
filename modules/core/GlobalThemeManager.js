/**
 * The World - Global Theme Manager
 * @description Manages the lifecycle and rendering of the global dynamic background.
 */
export class GlobalThemeManager {
    constructor({ $, win, state, config, logger, injectionEngine, timeGradient }) {
        this.$ = $;
        this.win = win;
        this.state = state;
        this.config = config;
        this.logger = logger;
        this.injectionEngine = injectionEngine;

        this.timeGradient = timeGradient; // Use shared instance
        this.isActive = false;
        this.bgLayer1 = null;
        this.bgLayer2 = null;
        this.activeLayer = 1;
        this.currentBackground = null;
    }

    activate() {
        if (this.isActive) return;
        this.isActive = true;
        this.logger.success('全局主题引擎已激活！');
        this.updateTheme();
    }

    deactivate() {
        if (!this.isActive) return;
        this.isActive = false;
        this.logger.warn('全局主题引擎已停用。正在移除背景和样式...');
        this._removeBgLayers();
        this.injectionEngine.removeCss(this.config.GLOBAL_THEME_STYLE_ID);
    }

    updateTheme() {
        if (!this.isActive) return;
        this.logger.log('正在更新全局主题...');
        
        const data = this.state.latestWorldStateData || {};
        const timeString = data['时间'] || '12:00';
        const weatherString = data['天气'] || '晴';
        const periodString = data['时段']; // Pass period string if available
        const theme = this.timeGradient.getThemeForTime({ timeString, weatherString, periodString });

        this._updateBackground(theme.background);
        this._applyThemeStyles();
    }
    
    _ensureBgLayers() {
        if (!this.bgLayer1 || !this.win.document.body.contains(this.bgLayer1)) {
            const $body = this.$('body');
            const $container = this.$('<div>').addClass('tw-global-theme-container').css({
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -10, pointerEvents: 'none'
            });
            this.bgLayer1 = this.$('<div>').addClass('tw-global-bg-layer').css('opacity', '1').get(0);
            this.bgLayer2 = this.$('<div>').addClass('tw-global-bg-layer').css('opacity', '0').get(0);
            $container.append(this.bgLayer1, this.bgLayer2);
            $body.prepend($container);
        }
    }

    _removeBgLayers() {
        this.$('.tw-global-theme-container').remove();
        this.bgLayer1 = null;
        this.bgLayer2 = null;
        this.currentBackground = null;
    }

    _updateBackground(newBackground) {
        // Only create layers when a background is first applied
        if (!this.bgLayer1) {
            this._ensureBgLayers();
        }

        if (newBackground === this.currentBackground) {
            return;
        }

        this.currentBackground = newBackground;

        requestAnimationFrame(() => {
            if (this.activeLayer === 1) {
                this.bgLayer2.style.background = newBackground;
                this.bgLayer1.style.opacity = 0;
                this.bgLayer2.style.opacity = 1;
                this.activeLayer = 2;
            } else {
                this.bgLayer1.style.background = newBackground;
                this.bgLayer2.style.opacity = 0;
                this.bgLayer1.style.opacity = 1;
                this.activeLayer = 1;
            }
        });
    }

    _applyThemeStyles() {
        let css = `
            .tw-global-bg-layer {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                transition: opacity 9s ease-in-out;
                background-size: 200% 200%;
                animation: bg-pan 45s linear infinite alternate;
            }
            @keyframes bg-pan {
                0% { background-position: 0% 0%; }
                100% { background-position: 100% 100%; }
            }
        `;
        
        if (this.state.isImmersiveModeEnabled) {
            css += `
                body { background: transparent !important; }
                #chat { background: transparent !important; }
                #chat_background { background: transparent !important; }
                .mes_content { 
                    background-color: rgba(20, 22, 28, 0.6) !important;
                    backdrop-filter: blur(4px);
                }
                :root { --SmartThemeBodyColor: #f0f0f0 !important; }
            `;
        } else {
             css += `
                body { background: revert !important; }
             `;
        }
        
        this.injectionEngine.injectCss(this.config.GLOBAL_THEME_STYLE_ID, css);
    }
}
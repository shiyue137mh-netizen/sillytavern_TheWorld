/**
 * The World - Sky Theme Controller
 * @description Manages loading, selecting, and applying custom sky color themes.
 */
export class SkyThemeController {
    constructor({ timeGradient, dataManager, state, logger, globalThemeManager, panelThemeManager }) {
        this.timeGradient = timeGradient;
        this.dataManager = dataManager;
        this.state = state;
        this.logger = logger;
        this.globalThemeManager = globalThemeManager;
        this.panelThemeManager = panelThemeManager;

        this.availableThemes = [];
        this.themeIds = ['default', 'legacy', 'eternal_night'];
    }

    async init() {
        await this.loadAvailableThemes();
        await this.applyTheme(this.state.activeSkyThemeId || 'default');
    }

    async loadAvailableThemes() {
        this.logger.log('正在加载可用的天色主题...');
        this.availableThemes = [];
        for (const themeId of this.themeIds) {
            try {
                const scriptUrl = new URL(import.meta.url);
                const basePath = scriptUrl.pathname.substring(0, scriptUrl.pathname.lastIndexOf('/modules'));
                const themeUrl = `${basePath}/themes/sky/${themeId}.json`;
                const response = await fetch(themeUrl);
                if (!response.ok) throw new Error(`获取 ${themeId}.json 失败: ${response.statusText}`);
                const themeData = await response.json();
                this.availableThemes.push({
                    id: themeData.id,
                    name: themeData.name,
                    author: themeData.author,
                });
            } catch (error) {
                this.logger.error(`加载主题 '${themeId}' 失败:`, error);
            }
        }
        this.logger.success(`加载了 ${this.availableThemes.length} 个天色主题。`);
    }

    async applyTheme(themeId) {
        this.logger.log(`正在应用天色主题: ${themeId}`);
        try {
            const scriptUrl = new URL(import.meta.url);
            const basePath = scriptUrl.pathname.substring(0, scriptUrl.pathname.lastIndexOf('/modules'));
            const themeUrl = `${basePath}/themes/sky/${themeId}.json`;
            const response = await fetch(themeUrl);
            if (!response.ok) throw new Error(`获取 ${themeId}.json 失败`);
            const themeData = await response.json();

            this.timeGradient.loadTheme(themeData);
            this.state.activeSkyThemeId = themeId;
            this.dataManager.saveState();
            
            // Trigger a refresh of all theme-dependent components
            if (this.globalThemeManager.isActive) {
                this.globalThemeManager.updateTheme();
            }
            this.panelThemeManager.applyThemeAndEffects(this.state.latestWorldStateData);

            this.logger.success(`天色主题 '${themeData.name}' 应用成功。`);

        } catch (error) {
            this.logger.error(`应用主题 '${themeId}' 失败:`, error);
        }
    }
}
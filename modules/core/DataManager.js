/**
 * The World - DataManager
 * @description Handles saving and loading state to/from localStorage.
 */
export class DataManager {
    constructor({ config, state, logger, win }) {
        this.config = config;
        this.state = state;
        this.logger = logger;
        this.win = win || window;

        this.saveDelayMs = 120;
        this.pendingSaveTimer = null;
        this.pendingSaveKinds = new Set();
    }

    _storage(action, key, data = null) {
        try {
            if (action === 'save') {
                localStorage.setItem(key, JSON.stringify(data));
            } else if (action === 'load') {
                const saved = localStorage.getItem(key);
                return saved ? JSON.parse(saved) : null;
            } else if (action === 'clear') {
                localStorage.removeItem(key);
            }
        } catch (e) {
            this.logger.error(`存储操作失败 (${action} on ${key}):`, e);
            return null;
        }
    }

    _buildSettingsPayload() {
        return {
            isPanelVisible: this.state.isPanelVisible,
            activeSkyThemeId: this.state.activeSkyThemeId,
            isGlobalThemeEngineEnabled: this.state.isGlobalThemeEngineEnabled,
            isFxGlobal: this.state.isFxGlobal,
            isImmersiveModeEnabled: this.state.isImmersiveModeEnabled,
            isDynamicIllustrationBgEnabled: this.state.isDynamicIllustrationBgEnabled,
            isRaindropFxOn: this.state.isRaindropFxOn,
            weatherFxEnabled: this.state.weatherFxEnabled,
            isHighPerformanceFxEnabled: this.state.isHighPerformanceFxEnabled,
            locationFxEnabled: this.state.locationFxEnabled,
            celestialFxEnabled: this.state.celestialFxEnabled,
            panelWidth: this.state.panelWidth,
            panelHeight: this.state.panelHeight,
            panelTop: this.state.panelTop,
            panelLeft: this.state.panelLeft,
            hasLoadedBefore: this.state.hasLoadedBefore,
            fontSize: this.state.fontSize,
            panelOpacity: this.state.panelOpacity,
            panelBlur: this.state.panelBlur,
            mapMode: this.state.mapMode,
            isAudioEnabled: this.state.isAudioEnabled,
            ambientVolume: this.state.ambientVolume,
            sfxVolume: this.state.sfxVolume,
        };
    }

    _flushSaveKinds(kinds) {
        if (kinds.has('world')) {
            this._storage('save', this.config.STORAGE_KEYS.WORLD_STATE, this.state.latestWorldStateData);
        }
        if (kinds.has('map')) {
            this._storage('save', this.config.STORAGE_KEYS.MAP_DATA, this.state.latestMapData);
        }
        if (kinds.has('settings')) {
            const settings = this._buildSettingsPayload();
            this.logger.log('正在保存的设置:', settings);
            this._storage('save', this.config.STORAGE_KEYS.SETTINGS, settings);
        }
    }

    loadState() {
        this.logger.log('正在从 localStorage 加载状态...');
        const loadedWorldState = this._storage('load', this.config.STORAGE_KEYS.WORLD_STATE);
        if (loadedWorldState) {
            this.state.latestWorldStateData = loadedWorldState;
        }
        // Only load map data if it exists, otherwise keep it null
        this.state.latestMapData = this._storage('load', this.config.STORAGE_KEYS.MAP_DATA);
        const settings = this._storage('load', this.config.STORAGE_KEYS.SETTINGS) || {};
        this.logger.log('加载到的设置:', settings);

        // A helper to safely assign settings
        const assignSetting = (key, defaultValue) => {
            this.state[key] = settings[key] !== undefined ? settings[key] : defaultValue;
        };

        assignSetting('isPanelVisible', this.state.isPanelVisible);
        assignSetting('activeSkyThemeId', this.state.activeSkyThemeId);
        assignSetting('isGlobalThemeEngineEnabled', this.state.isGlobalThemeEngineEnabled);
        assignSetting('isFxGlobal', this.state.isFxGlobal);
        assignSetting('isImmersiveModeEnabled', this.state.isImmersiveModeEnabled);
        assignSetting('isDynamicIllustrationBgEnabled', this.state.isDynamicIllustrationBgEnabled);
        assignSetting('isRaindropFxOn', this.state.isRaindropFxOn);
        assignSetting('weatherFxEnabled', this.state.weatherFxEnabled);
        assignSetting('isHighPerformanceFxEnabled', this.state.isHighPerformanceFxEnabled);
        assignSetting('locationFxEnabled', this.state.locationFxEnabled);
        assignSetting('celestialFxEnabled', this.state.celestialFxEnabled);
        assignSetting('panelWidth', this.state.panelWidth);
        assignSetting('panelHeight', this.state.panelHeight);
        assignSetting('panelTop', this.state.panelTop);
        assignSetting('panelLeft', this.state.panelLeft);
        assignSetting('hasLoadedBefore', this.state.hasLoadedBefore);
        assignSetting('fontSize', this.state.fontSize);
        assignSetting('panelOpacity', this.state.panelOpacity);
        assignSetting('panelBlur', this.state.panelBlur);
        assignSetting('mapMode', this.state.mapMode);
        assignSetting('isAudioEnabled', this.state.isAudioEnabled);
        assignSetting('ambientVolume', this.state.ambientVolume);
        assignSetting('sfxVolume', this.state.sfxVolume);
    }

    scheduleSave(kinds = ['world', 'map', 'settings']) {
        const requestedKinds = Array.isArray(kinds) ? kinds : [kinds];
        requestedKinds.forEach(kind => this.pendingSaveKinds.add(kind));

        if (this.pendingSaveTimer) {
            this.win.clearTimeout(this.pendingSaveTimer);
        }

        this.pendingSaveTimer = this.win.setTimeout(() => {
            const kindsToFlush = new Set(this.pendingSaveKinds);
            this.pendingSaveKinds.clear();
            this.pendingSaveTimer = null;
            this.logger.log('正在批量保存状态到 localStorage...', Array.from(kindsToFlush));
            this._flushSaveKinds(kindsToFlush);
        }, this.saveDelayMs);
    }

    flushPendingSaves() {
        if (this.pendingSaveTimer) {
            this.win.clearTimeout(this.pendingSaveTimer);
            this.pendingSaveTimer = null;
        }
        if (this.pendingSaveKinds.size === 0) return;

        const kindsToFlush = new Set(this.pendingSaveKinds);
        this.pendingSaveKinds.clear();
        this.logger.log('正在立即刷新挂起的本地存储写入...', Array.from(kindsToFlush));
        this._flushSaveKinds(kindsToFlush);
    }

    saveState() {
        this.logger.log('正在将状态保存到 localStorage...');
        this.flushPendingSaves();
        this._flushSaveKinds(new Set(['world', 'map', 'settings']));
    }

    saveSettings() {
        this.logger.log('正在保存设置到 localStorage...');
        this.flushPendingSaves();
        this._flushSaveKinds(new Set(['settings']));
    }

    saveSettingsSoon() {
        this.scheduleSave(['settings']);
    }

    saveWorldStateSoon() {
        this.scheduleSave(['world']);
    }

    saveMapStateSoon() {
        this.scheduleSave(['map']);
    }

    clearAllStorage() {
        this.logger.warn('正在清空所有本地存储数据！');
        if (this.pendingSaveTimer) {
            this.win.clearTimeout(this.pendingSaveTimer);
            this.pendingSaveTimer = null;
        }
        this.pendingSaveKinds.clear();
        Object.values(this.config.STORAGE_KEYS).forEach(key => this._storage('clear', key));

        // Reset state to defaults
        this.state.latestMapData = null;
        // Do NOT reset latestWorldStateData to null, let it keep its default structure
        this.state.isPanelVisible = false;
        this.state.selectedMainLocation = null;
        this.state.selectedSubLocation = null;
        this.state.hasLoadedBefore = false;

        // Re-load to apply default settings
        this.loadState();
    }
}

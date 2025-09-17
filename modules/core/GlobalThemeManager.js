/**
 * The World - Global Theme Manager
 * @description Manages the lifecycle of the global theme engine.
 */

export class ThemeManager {
    constructor({ $, win, context, state, config, logger, timeGradient }) {
        this.$ = $;
        this.win = win;
        this.stContext = context;
        this.state = state;
        this.config = config;
        this.logger = logger;
        this.timeGradient = timeGradient;

        this.isActive = false;
        // Create a bound function once to ensure the listener can be removed correctly.
        this._boundReapplyTheme = this._reapplyTheme.bind(this);
    }

    activate() {
        if (this.isActive) return;
        this.isActive = true;
        this.logger.success('全局主题引擎已激活！正在应用并监听消息渲染...');

        // Add listener to re-apply theme after every message render to fight overrides.
        this.stContext.eventSource.on(this.stContext.eventTypes.CHARACTER_MESSAGE_RENDERED, this._boundReapplyTheme);
        
        // Apply theme immediately on activation.
        this._reapplyTheme();
    }

    deactivate() {
        if (!this.isActive) return;
        this.isActive = false;
        this.logger.warn('全局主题引擎已停用。正在移除监听器和样式...');
        
        // Remove the persistent listener.
        this.stContext.eventSource.removeListener(this.stContext.eventTypes.CHARACTER_MESSAGE_RENDERED, this._boundReapplyTheme);
        
        // Unload the theme (which removes the injected CSS).
        this._unloadCurrentTheme();
    }

    /**
     * Re-applies the theme. This is called on activation and every time a new message is rendered.
     */
    _reapplyTheme() {
        if (!this.isActive) return;
        this.logger.log('重新应用全局主题样式...');
        // The timeGradient's activate method simply injects the static CSS.
        this.timeGradient.activate();
    }

    /**
     * Unloads the theme by removing its CSS.
     */
    _unloadCurrentTheme() {
        this.logger.log('正在卸载当前全局主题...');
        this.timeGradient.deactivate();
    }
}

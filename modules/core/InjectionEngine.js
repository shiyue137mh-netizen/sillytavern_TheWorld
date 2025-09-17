/**
 * The World - Injection Engine
 * @description Handles dynamic injection and removal of CSS into the main document.
 */
export class InjectionEngine {
    constructor({ $, win, logger }) {
        this.$ = $;
        this.win = win;
        this.logger = logger;
    }

    /**
     * Injects a <style> tag with CSS content into the main document's <head>.
     * If a style tag with the same ID already exists, it will be replaced.
     * @param {string} id The unique ID for the style tag.
     * @param {string} cssText The CSS rules to inject.
     */
    injectCss(id, cssText) {
        this.removeCss(id); // Ensure no duplicates
        const styleElement = this.win.document.createElement('style');
        styleElement.id = id;
        styleElement.type = 'text/css';
        styleElement.appendChild(this.win.document.createTextNode(cssText));
        this.win.document.head.appendChild(styleElement);
        this.logger.log(`已向主文档注入CSS: #${id}`);
    }

    /**
     * Removes a <style> tag from the main document's <head> by its ID.
     * @param {string} id The ID of the style tag to remove.
     */
    removeCss(id) {
        const existingStyle = this.win.document.getElementById(id);
        if (existingStyle) {
            existingStyle.remove();
            this.logger.log(`已从主文档移除CSS: #${id}`);
        }
    }
}

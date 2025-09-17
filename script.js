/**
 * The World - Main Entry Point
 * @version 1.0.0
 */
'use strict';

import { TheWorldApp } from './modules/TheWorldApp.js';
import { Logger } from './modules/logger.js';

/**
 * Checks if all required SillyTavern APIs are available.
 * This is crucial to prevent race conditions on startup.
 */
function areApisReady() {
    return !!(
        window.parent &&
        window.parent.SillyTavern &&
        window.parent.TavernHelper &&
        window.parent.jQuery &&
        window.parent.toastr &&
        window.parent.SillyTavern.getContext &&
        window.parent.SillyTavern.getContext().eventSource
    );
}

// Use an interval to poll for the API readiness, ensuring the extension
// only initializes after SillyTavern is fully prepared.
const apiReadyInterval = setInterval(() => {
    Logger.log("正在检查API是否就绪...");
    if (areApisReady()) {
        clearInterval(apiReadyInterval);
        Logger.success("API已就绪，正在实例化 TheWorldApp...");
        // Initialize the main application
        new TheWorldApp();
    }
}, 250);
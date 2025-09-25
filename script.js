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
    const st = window.parent?.SillyTavern;
    if (!st) return false;

    // REMOVED SlashCommandParser check to prevent startup hangs.
    // Command/Macro initialization is now deferred and event-driven within TheWorldApp.
    return !!(
        st &&
        window.parent.TavernHelper &&
        window.parent.jQuery &&
        window.parent.toastr &&
        st.getContext &&
        st.getContext().eventSource
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
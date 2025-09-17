/**
 * The World - Styled Logger
 * @description A simple, styled logger for better console debugging.
 */
const STYLES = {
    base: 'color: #87CEEB; font-weight: bold;', // Sky Blue
    info: 'color: #FFFFFF;', // White, assuming a dark console theme
    error: 'color: #FF4444; font-weight: bold;',
    warn: 'color: #FFCC44;',
    success: 'color: #44FF44;'
};

export const Logger = {
    log: (message, ...args) => {
        console.log(`%c[世界]%c ${message}`, STYLES.base, STYLES.info, ...args);
    },
    warn: (message, ...args) => {
        console.warn(`%c[世界 警告]%c ${message}`, STYLES.base, STYLES.warn, ...args);
    },
    error: (message, ...args) => {
        console.error(`%c[世界 错误]%c ${message}`, STYLES.base, STYLES.error, ...args);
    },
    success: (message, ...args) => {
        console.log(`%c[世界 成功]%c ${message}`, STYLES.base, STYLES.success, ...args);
    }
};
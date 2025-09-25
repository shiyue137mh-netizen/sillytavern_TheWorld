/**
 * The World - Holiday Data
 * @description A centralized data source for holidays to be used by the UI and macros.
 */
export const HOLIDAY_DATA = {
    '1-1': { name: '元旦', icon: '🎉' },
    '2-14': { name: '情人节', icon: '❤️' },
    '3-8': { name: '妇女节', icon: '👩' },
    '3-17': { name: '圣帕特里克节', icon: '☘️' },
    '4-1': { name: '愚人节', icon: '🤡' },
    '5-1': { name: '劳动节', icon: '🛠️' },
    '6-1': { name: '儿童节', icon: '🎈' },
    '10-31': { name: '万圣节', icon: '🎃' },
    '11-1': { name: '万圣节', icon: '🎃' },
    '12-24': { name: '平安夜', icon: '🌃' },
    '12-25': { name: '圣诞节', icon: '🎄' },
    // Chinese Lunar Calendar dates are complex, so we'll approximate with common Gregorian dates for now.
    // This can be expanded with a proper lunar calendar conversion library in the future.
    // A simplified mapping:
    '1-22': { name: '春节 (近似)', icon: '🏮' }, // Example for 2023
    '2-5': { name: '元宵节 (近似)', icon: '🏮' },
    '4-5': { name: '清明节', icon: '🕊️' },
    '6-22': { name: '端午节 (近似)', icon: '🐉' },
    '8-15': { name: '中秋节 (近似)', icon: '🌕' },
    '9-9': { name: '重阳节 (近似)', icon: '⛰️' }
};

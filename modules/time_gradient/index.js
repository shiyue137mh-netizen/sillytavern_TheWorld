

/**
 * The World - Dynamic Time Gradient Color Engine
 * @description A utility to calculate sky gradients based on time of day.
 * V4: Refactored interpolation logic to be more robust and handle time wrapping correctly.
 */
export class TimeGradient {
    constructor() {
        this.skyGradients = [];
        this.periodOverrides = {};
    }

    loadTheme(themeData) {
        if (themeData && Array.isArray(themeData.gradients) && themeData.gradients.length > 0) {
            // Sort by hour to ensure correct interpolation
            this.skyGradients = themeData.gradients.sort((a, b) => a.hour - b.hour);
            this.periodOverrides = themeData.periodOverrides || {};
        } else {
            console.error("[TimeGradient] Invalid or empty theme loaded.");
            this.skyGradients = [{ hour: 0, colors: ['#555', '#222'], brightness: 'dark' }, { hour: 24, colors: ['#555', '#222'], brightness: 'dark' }];
            this.periodOverrides = {};
        }
    }

    _hexToRgb(hex) {
        let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    }

    _rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).padStart(6, '0');
    }

    _interpolateColor(color1, color2, factor) {
        const rgb1 = this._hexToRgb(color1);
        const rgb2 = this._hexToRgb(color2);
        if (!rgb1 || !rgb2) return color1;
        const r = Math.round(rgb1.r + factor * (rgb2.r - rgb1.r));
        const g = Math.round(rgb1.g + factor * (rgb2.g - rgb1.g));
        const b = Math.round(rgb1.b + factor * (rgb2.b - rgb1.b));
        return this._rgbToHex(r, g, b);
    }

    _parseTimeToDecimal(timeString) {
        const hhmmMatch = timeString.match(/(\d{1,2}):(\d{2})/);
        if (hhmmMatch) {
            const hours = parseInt(hhmmMatch[1], 10);
            const minutes = parseInt(hhmmMatch[2], 10);
            return hours + minutes / 60;
        }

        const periodMap = {
            '子时': 23.5, '丑时': 1.5, '寅时': 3.5, '卯时': 5.5, '辰时': 7.5, '巳时': 9.5, '午时': 11.5,
            '未时': 13.5, '申时': 15.5, '酉时': 17.5, '戌时': 19.5, '亥时': 21.5, '午夜': 0, '深夜': 2,
            '黎明': 5, '清晨': 6, '日出': 6.5, '早上': 8, '上午': 10, '中午': 12, '正午': 12, '下午': 15,
            '黄昏': 18, '日落': 18.5, '傍晚': 19, '晚上': 21, '夜晚': 22, '白天': 12,
        };
        for (const period in periodMap) { if (timeString.includes(period)) { return periodMap[period]; } }
        return 12; // Default to noon
    }
    
    _derivePeriodFromTime(decimalHour) {
        if (decimalHour >= 20 || decimalHour < 4) return '夜晚';
        if (decimalHour >= 4 && decimalHour < 5) return '日出';
        if (decimalHour >= 5 && decimalHour < 8) return '清晨';
        if (decimalHour >= 8 && decimalHour < 12) return '上午';
        if (decimalHour >= 12 && decimalHour < 14) return '中午';
        if (decimalHour >= 14 && decimalHour < 17) return '下午';
        if (decimalHour >= 17 && decimalHour < 18) return '日落';
        if (decimalHour >= 18 && decimalHour < 20) return '黄昏';
        return '白天';
    }
    
    determineDefinitivePeriod({ timeString, periodString }) {
        if (periodString && periodString.trim() !== '') {
            return periodString.trim();
        }
        if (timeString) {
            const decimalHour = this._parseTimeToDecimal(timeString);
            return this._derivePeriodFromTime(decimalHour);
        }
        return '白天'; // Fallback
    }

    getThemeForTime({ timeString, weatherString, periodString }) {
        if (this.skyGradients.length === 0) {
            return { background: 'linear-gradient(#555, #222)', brightness: 'dark', period: '未知' };
        }
        
        const definitivePeriod = this.determineDefinitivePeriod({ timeString, periodString });
        const isBadWeather = weatherString && (weatherString.includes('雨') || weatherString.includes('雪') || weatherString.includes('阴') || weatherString.includes('雷'));

        if (this.periodOverrides[definitivePeriod]) {
            const override = this.periodOverrides[definitivePeriod];
            return { background: `linear-gradient(160deg, ${override.colors[0]}, ${override.colors[1]})`, brightness: override.brightness, period: definitivePeriod };
        }
        
        if (isBadWeather && this.periodOverrides['默认恶劣天气']) {
            const override = this.periodOverrides['默认恶劣天气'];
            return { background: `linear-gradient(160deg, ${override.colors[0]}, ${override.colors[1]})`, brightness: override.brightness, period: definitivePeriod };
        }

        let colorDecimalHour = this._parseTimeToDecimal(timeString || '12:00');
        if (colorDecimalHour >= 24) colorDecimalHour %= 24;

        let start, end;

        // Find the last stop that is less than or equal to the current time.
        // This loop works by finding the correct "floor" interval.
        let found = false;
        for (let i = this.skyGradients.length - 1; i >= 0; i--) {
            if (this.skyGradients[i].hour <= colorDecimalHour) {
                start = this.skyGradients[i];
                // The end is the next one, or wrap around to the first one if we're at the last stop.
                end = this.skyGradients[i + 1] || this.skyGradients[0];
                found = true;
                break;
            }
        }

        // If no start was found, it means the time is before the very first stop (e.g., time is 01:00, first stop is 04:00).
        // In this case, we're between the last stop of the previous day and the first stop of this day.
        if (!found) {
            start = this.skyGradients[this.skyGradients.length - 1]; // Last stop of the day
            end = this.skyGradients[0]; // First stop of the day
        }

        let startHour = start.hour;
        let endHour = end.hour;
        let currentTime = colorDecimalHour;

        // Handle the wrap-around case for interpolation (e.g., from 19:00 to 04:00)
        if (endHour < startHour) { 
            endHour += 24;
            // If current time is also on the "next day" side of the wrap, adjust it as well.
            if (currentTime < startHour) {
                currentTime += 24;
            }
        }
        
        // Ensure no division by zero if hours are identical.
        const factor = (endHour - startHour > 0) ? (currentTime - startHour) / (endHour - startHour) : 0;
        
        const grad_start = this._interpolateColor(start.colors[0], end.colors[0], factor);
        const grad_end = this._interpolateColor(start.colors[1], end.colors[1], factor);
        const baseGradient = `linear-gradient(160deg, ${grad_start}, ${grad_end})`;
        const finalBrightness = (start.brightness === 'light' && factor < 0.7) || (end.brightness === 'light' && factor > 0.3) ? 'light' : 'dark';

        return { background: baseGradient, brightness: finalBrightness, period: definitivePeriod };
    }
}
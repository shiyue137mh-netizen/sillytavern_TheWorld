/**
 * The World - Time Animator
 * @description Creates the illusion of passing time by animating seconds.
 */
export class TimeAnimator {
    constructor({ $, win }) {
        this.$ = $;
        this.win = win;
        this.intervalId = null;
        this.hours = 0;
        this.minutes = 0;
        this.seconds = 0;
    }

    start(timeString) {
        this.stop();
        const match = timeString.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (match) {
            this.hours = parseInt(match[1], 10);
            this.minutes = parseInt(match[2], 10);
            this.seconds = parseInt(match[3], 10) || 0;
            this.intervalId = setInterval(() => this._tick(), 1000);
            this._updateDisplay();
        }
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    _tick() {
        this.seconds++;
        if (this.seconds >= 60) {
            this.seconds = 0;
            this.minutes++;
            if (this.minutes >= 60) {
                this.minutes = 0;
                this.hours++;
                if (this.hours >= 24) {
                    this.hours = 0;
                }
            }
        }
        this._updateDisplay();
        
        // NEW: Emit a custom event with the current time
        this.$(this.win.document).trigger('tw-time-tick', { 
            hours: this.hours, 
            minutes: this.minutes, 
            seconds: this.seconds 
        });
    }

    _updateDisplay() {
        const $target = this.$('#tw-time-display-main');
        if ($target.length) {
            const h = String(this.hours).padStart(2, '0');
            const m = String(this.minutes).padStart(2, '0');
            const s = String(this.seconds).padStart(2, '0');
            
            const timeHtml = `${h}<span>:${m}</span><span class="tw-time-animator-seconds">:${s}</span>`;
            
            $target.html(timeHtml);
        }
    }
}
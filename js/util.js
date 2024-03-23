export class Semaphore {
    constructor(initialPermits = 1) {
        this.permits = initialPermits;
        this.queue = [];
    }

    async acquire() {
        return new Promise((resolve) => {
            if (this.permits > 0) {
                this.permits--;
                resolve();
            } else {
                this.queue.push(resolve);
            }
        });
    }

    release() {
        if (this.queue.length > 0) {
            const resolve = this.queue.shift();
            resolve();
        } else {
            this.permits++;
        }
    }
}

export class MovingByteRate {
    constructor(windowSize = 1) {
        this.windowSize = windowSize * 1000; // Window size in milliseconds
        this.bytes = []; // Stores timestamps and byte counts for window
    }

    addBytes(bytes) {
        this.bytes.push({ timestamp: Date.now(), bytes });
    }

    getByteRate() {
        const now = Date.now();
        this.bytes = this.bytes.filter(entry => now - entry.timestamp <= this.windowSize); // Filter out old entries

        const totalBytes = this.bytes.reduce((sum, entry) => sum + entry.bytes, 0);
        const elapsedTime = Math.min(this.windowSize, now - this.bytes[0]?.timestamp || 0); // Consider window limit or actual time
        return totalBytes / (elapsedTime / 1000); // Average in bytes/second
    }
}


export class Utility {
    /**
     * Format bytes as human-readable text.
     * 
     * @param bytes Number of bytes.
     * @param si True to use metric (SI) units, aka powers of 1000. False to use 
     *           binary (IEC), aka powers of 1024.
     * @param dp Number of decimal places to display.
     * 
     * @return Formatted string.
     */
    static humanFileSize(bytes, si = false, dp = 1) {
        const thresh = si ? 1000 : 1024;

        if (Math.abs(bytes) < thresh) {
            return bytes + ' B';
        }

        const units = si
            ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
            : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
        let u = -1;
        const r = 10 ** dp;

        do {
            bytes /= thresh;
            ++u;
        } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


        return bytes.toFixed(dp) + ' ' + units[u];
    }

    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}


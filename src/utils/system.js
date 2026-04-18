const os = require('os');

/**
 * Returns the current CPU load average (1 minute)
 */
function getCpuLoad() {
    return os.loadavg()[0];
}

module.exports = { getCpuLoad };

/**
 * Session Facade
 */

const { checkLoginStatus } = require('../utils/ui_logic');
const { ensureLogin, verifySession } = require('./login');
const { getCpuLoad } = require('../utils/system');

module.exports = { 
    checkLoginStatus, 
    ensureLogin, 
    verifySession, 
    getCpuLoad 
};

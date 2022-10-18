/**
 * Initializes the application
 */

const fs = require("fs");
const mustache = require("mustache");

exports.initSync = appName => {
    global.APP_CONSTANTS = require(`${__dirname}/../apis/lib/loginappconstants.js`);
    global.APP_CONSTANTS.CONF = JSON.parse( mustache.render(fs.readFileSync(`${__dirname}/../conf/app.json`, "utf-8"), 
        {app: appName, hostname: CONSTANTS.HOSTNAME}) );
    global.API_CONSTANTS = require(`${__dirname}/../apis/lib/xbinconstants.js`);
    require(`${APP_CONSTANTS.API_DIR}/login.js`).init();    // init our JWT listeners
    require(`${APP_CONSTANTS.LIB_DIR}/deleteunverifiedaccounts.js`).init();    // init expired accounts cleanup service
}
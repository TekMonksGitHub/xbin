/**
 * Initializes the application.
 * (C) TekMonks. All rights reserved.
 */

const fs = require("fs");
const mustache = require("mustache");

exports.initSync = appName => {
    global.APP_CONSTANTS = require(`${__dirname}/../apis/lib/loginappconstants.js`);
    const hostname = require(`${APP_CONSTANTS.CONF_DIR}/hostname.json`);
    APP_CONSTANTS.HOSTNAME = hostname;
    global.APP_CONSTANTS.CONF = JSON.parse( mustache.render(fs.readFileSync(`${APP_CONSTANTS.CONF_DIR}/app.json`, 
        "utf-8"), {app: appName, hostname}) );
    require(`${APP_CONSTANTS.LIB_DIR}/deleteunverifiedaccounts.js`).init();    // init expired accounts cleanup service

    for (const dirEntry of fs.readdirSync(__dirname, {withFileTypes: true}))   // init wrapped apps
        if (dirEntry.isFile() && dirEntry.name.toLowerCase().endsWith("_init.js")) 
            require(`${__dirname}/${dirEntry.name}`).initSync();
}
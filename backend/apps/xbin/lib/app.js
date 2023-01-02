/**
 * Initializes the application.
 * (C) TekMonks. All rights reserved.
 */

const fs = require("fs");
const mustache = require("mustache");

exports.initSync = appName => {
    global.APP_CONSTANTS = require(`${__dirname}/../apis/lib/loginappconstants.js`);
    global.APP_CONSTANTS.CONF = JSON.parse( mustache.render(fs.readFileSync(`${__dirname}/../conf/app.json`, "utf-8"), 
        {app: appName, hostname: CONSTANTS.HOSTNAME}) );
    require(`${APP_CONSTANTS.LIB_DIR}/deleteunverifiedaccounts.js`).init();    // init expired accounts cleanup service

    for (const dirEntry of fs.readdirSync(__dirname, {withFileTypes: true}))   // init wrapped apps
        if (dirEntry.isFile() && dirEntry.name.toLowerCase().endsWith("_init.js")) 
            require(`${__dirname}/${dirEntry.name}`).initSync();
}
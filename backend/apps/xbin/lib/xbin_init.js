/**
 * App init for XBin
 * (C) TekMonks. All rights reserved.
 */

const fs = require("fs");
const mustache = require("mustache");

exports.initSync = _appName => {
    global.API_CONSTANTS = require(`${__dirname}/../apis/lib/xbinconstants.js`);
    const xbinson = mustache.render(fs.readFileSync(`${global.API_CONSTANTS.CONF_DIR}/xbin.json`, "utf8"), 
        global.API_CONSTANTS).replace(/\\/g, "\\\\");   // escape windows paths
    global.API_CONSTANTS.CONF = JSON.parse(xbinson);
    require(`${APP_CONSTANTS.LIB_DIR}/cms.js`).init();    // init cms which inits our ID change listeners
    require(`${APP_CONSTANTS.API_DIR}/login.js`).init();    // init login which inits our JWT listeners
}
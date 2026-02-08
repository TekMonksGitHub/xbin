/**
 * App init for XBin
 * (C) TekMonks. All rights reserved.
 */

const fs = require("fs");
const mustache = require("mustache");
const XBIN_CONSTANTS = require(`${__dirname}/xbinconstants.js`);

exports.initSync = _ => {
    const xbinson = mustache.render(fs.readFileSync(`${XBIN_CONSTANTS.CONF_DIR}/xbin.json`, "utf8"), 
        XBIN_CONSTANTS).replace(/\\/g, "\\\\");   // escape windows paths
    XBIN_CONSTANTS.CONF = JSON.parse(xbinson);
    global.XBIN_CONSTANTS = XBIN_CONSTANTS;
    const cms = require(`${XBIN_CONSTANTS.LIB_DIR}/cms.js`);
    if (!cms.getLoginModule()) cms.setLoginModule(require(`${XBIN_CONSTANTS.API_DIR}/login.js`));
}
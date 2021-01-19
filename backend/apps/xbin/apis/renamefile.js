/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const fs = require("fs");
const path = require("path");
const util = require("util");
const sqlite3 = require("sqlite3");
const renameAsync = util.promisify(fs.rename);
const API_CONSTANTS = require(`${__dirname}/lib/constants.js`);
const CONF = require(`${API_CONSTANTS.CONF_DIR}/xbin.json`);

let xbinDB;

function _initDB() {
	return new Promise((resolve, reject) => {
		if (!xbinDB) xbinDB = new sqlite3.Database(API_CONSTANTS.APP_DB, sqlite3.OPEN_READWRITE, err => {
			if (!err) {dbrunAsync = require("util").promisify(xbinDB.run.bind(xbinDB)); resolve();} else reject(err);
		}); else resolve();
	});
}

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got renamefile request for path: " + jsonReq.old);

	const oldPath = path.resolve(`${CONF.CMS_ROOT}/${jsonReq.old}`); const newPath = path.resolve(`${CONF.CMS_ROOT}/${jsonReq.new}`);
	if (!API_CONSTANTS.isSubdirectory(oldPath, CONF.CMS_ROOT)) {LOG.error(`Subdir validation failure: ${jsonReq.old}`); return CONSTANTS.FALSE_RESULT;}

	try {
		renameAsync(oldPath, newPath);
		await _initDB(); await dbrunAsync("UPDATE shares SET fullpath = ? WHERE fullpath = ?", [newPath, oldPath]);	// update shares
        return CONSTANTS.TRUE_RESULT;
	} catch (err) {LOG.error(`Error renaming  path: ${oldPath}, error is: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.old && jsonReq.new);

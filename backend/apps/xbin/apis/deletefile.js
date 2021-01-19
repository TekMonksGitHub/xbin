/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const fs = require("fs");
const path = require("path");
const util = require("util");
const sqlite3 = require("sqlite3");
const statAsync = util.promisify(fs.stat);
const rmdirAsync = util.promisify(fs.rmdir);
const unlinkAsync = util.promisify(fs.unlink);
const readdirAsync = util.promisify(fs.readdir);
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
	
	LOG.debug("Got deletefile request for path: " + jsonReq.path);

	const fullpath = path.resolve(`${CONF.CMS_ROOT}/${jsonReq.path}`);
	if (!API_CONSTANTS.isSubdirectory(fullpath, CONF.CMS_ROOT)) {LOG.error(`Subdir validation failure: ${jsonReq.path}`); return CONSTANTS.FALSE_RESULT;}

	try {
		await rmrf(fullpath); 
		await _initDB(); await dbrunAsync("DELETE FROM shares WHERE fullpath = ?", [fullpath]);	// can't be shared if deleted
		return CONSTANTS.TRUE_RESULT;
	} catch (err) {LOG.error(`Error deleting  path: ${fullpath}, error is: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

async function rmrf(path) {
	if ((await statAsync(path)).isFile()) {await unlinkAsync(path); return;}

	const entries = await readdirAsync(path);
	for (const entry of entries) {
		const stats = await statAsync(`${path}/${entry}`);
		if (stats.isFile()) await unlinkAsync(`${path}/${entry}`); else if (stats.isDirectory()) await rmrf(`${path}/${entry}`);
	}
	await rmdirAsync(path);
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path);

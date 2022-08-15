/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const path = require("path");
const sqlite3 = require("sqlite3");
const fspromises = require("fs").promises;
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);

let xbinDB;

function _initDB() {
	return new Promise((resolve, reject) => {
		if (!xbinDB) xbinDB = new sqlite3.Database(API_CONSTANTS.APP_DB, sqlite3.OPEN_READWRITE, err => {
			if (!err) {dbrunAsync = require("util").promisify(xbinDB.run.bind(xbinDB)); resolve();} else reject(err);
		}); else resolve();
	});
}

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got deletefile request for path: " + jsonReq.path);

	const fullpath = path.resolve(`${await cms.getCMSRoot(headers)}/${jsonReq.path}`);
	if (!await cms.isSecure(headers, fullpath)) {LOG.error(`Path security validation failure: ${jsonReq.path}`); return CONSTANTS.FALSE_RESULT;}

	try {
		await rmrf(fullpath); 
		return CONSTANTS.TRUE_RESULT;
	} catch (err) {LOG.error(`Error deleting  path: ${fullpath}, error is: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

async function rmrf(path) {
	if ((await fspromises.stat(path)).isFile()) {await unlinkFileAndRemoveFromDB(path); return;}

	const entries = await fspromises.readdir(path);
	for (const entry of entries) {
		const stats = await fspromises.stat(`${path}/${entry}`);
		if (stats.isFile()) await unlinkFileAndRemoveFromDB(`${path}/${entry}`); else if (stats.isDirectory()) await rmrf(`${path}/${entry}`);
	}
	await fspromises.rmdir(path);
}

async function unlinkFileAndRemoveFromDB(path) {
	await _initDB(); await dbrunAsync("DELETE FROM shares WHERE fullpath = ?", [path]);	
	await fspromises.unlink(path);
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path);

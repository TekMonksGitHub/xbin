/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const util = require("util");
const path = require("path");
const sqlite3 = require("sqlite3");

let xbinDB;

function _initDB() {
	return new Promise((resolve, reject) => {
		if (!xbinDB) xbinDB = new sqlite3.Database(API_CONSTANTS.APP_DB, sqlite3.OPEN_READWRITE, err => {
			if (!err) resolve(); else reject(err);
		}); else resolve();
	});
}

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got check shared file request for id: " + jsonReq.id + " with name: " + jsonReq.name);

	try {
		await _initDB(); 
		const share = await (util.promisify(xbinDB.get.bind(xbinDB))("SELECT fullpath, expiry FROM shares WHERE id = ?", [jsonReq.id]));
        const name = share?path.basename(share.fullpath):null;
        
        if (!share || (Date.now() > share.expiry) || (name != jsonReq.name)) return CONSTANTS.FALSE_RESULT;
        else return CONSTANTS.TRUE_RESULT;
	} catch (err) {
        LOG.error(`Share ID resulted in DB error ${err}`); 
        return CONSTANTS.FALSE_RESULT;
    }
}

const validateRequest = jsonReq => (jsonReq && jsonReq.id && jsonReq.name);

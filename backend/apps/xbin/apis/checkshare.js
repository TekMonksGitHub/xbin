/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const path = require("path");
const db = require(`${XBIN_CONSTANTS.LIB_DIR}/xbindb.js`).getDB();

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got check shared file request for id: " + jsonReq.id + " with name: " + jsonReq.name);

	try {
		const share = (await db.getQuery("SELECT fullpath, expiry FROM shares WHERE id = ?", [jsonReq.id]))[0];
        const name = share?path.basename(share.fullpath):null;
        
        if (!share || (Date.now() > share.expiry) || (name != jsonReq.name)) return CONSTANTS.FALSE_RESULT;
        else return CONSTANTS.TRUE_RESULT;
	} catch (err) {
        LOG.error(`Share ID resulted in DB error ${err}`); 
        return CONSTANTS.FALSE_RESULT;
    }
}

const validateRequest = jsonReq => (jsonReq && jsonReq.id && jsonReq.name);
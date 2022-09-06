/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const path = require("path");
const crypto = require("crypto");
const db = require(`${API_CONSTANTS.LIB_DIR}/db.js`);
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);
const CONF = require(`${API_CONSTANTS.CONF_DIR}/xbin.json`);

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}

	try {
		if (jsonReq.path) {	// create initial share
			LOG.debug("Got share file request for path: " + jsonReq.path);

			const fullpath = path.resolve(`${await cms.getCMSRoot(headers)}/${jsonReq.path}`);
			if (!await cms.isSecure(headers, fullpath)) {LOG.error(`Path security validation failure: ${jsonReq.path}`); return CONSTANTS.FALSE_RESULT;}
			
			const expiry = Date.now()+((jsonReq.expiry||CONF.DEFAULT_SHARED_FILE_EXPIRY)*86400000);	
			const id = crypto.createHash("sha512").update(fullpath+expiry+(Math.random()*(1000000 - 1)+1)).digest("hex");
			await db.runCmd("INSERT INTO shares(fullpath, id, expiry) VALUES (?,?,?)", [fullpath,id,expiry]);
			return {result: true, id};
		} else {	// update expiry
			if (jsonReq.expiry != 0) await db.runCmd("UPDATE shares SET expiry = ? WHERE id = ?", [Date.now()+(jsonReq.expiry*86400000),jsonReq.id]);
			else await db.runCmd("DELETE FROM shares WHERE id = ?", [jsonReq.id]);
			return {result: true, id: jsonReq.id};
		}
	} catch (err) {LOG.error(`Error sharing  path: ${fullpath}, error is: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

const validateRequest = jsonReq => (jsonReq && (jsonReq.path || (jsonReq.id && jsonReq.expiry)));

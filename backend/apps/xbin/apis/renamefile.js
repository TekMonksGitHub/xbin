/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const path = require("path");
const fspromises = require("fs").promises;
const db = require(`${API_CONSTANTS.LIB_DIR}/db.js`);
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got renamefile request for path: " + jsonReq.old);

	const oldPath = path.resolve(`${await cms.getCMSRoot(headers)}/${jsonReq.old}`); const newPath = path.resolve(`${await cms.getCMSRoot(headers)}/${jsonReq.new}`);
	if (!await cms.isSecure(headers, oldPath)) {LOG.error(`Path security validation failure: ${jsonReq.old}`); return CONSTANTS.FALSE_RESULT;}

	try {
		await fspromises.rename(oldPath, newPath);
		await db.runCmd("UPDATE shares SET fullpath = ? WHERE fullpath = ?", [newPath, oldPath]);	// update shares
        return CONSTANTS.TRUE_RESULT;
	} catch (err) {LOG.error(`Error renaming  path: ${oldPath}, error is: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.old && jsonReq.new);

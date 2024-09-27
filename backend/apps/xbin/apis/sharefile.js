/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const crypto = require("crypto");
const cms = require(`${XBIN_CONSTANTS.LIB_DIR}/cms.js`);
const db = require(`${XBIN_CONSTANTS.LIB_DIR}/xbindb.js`).getDB();
const uploadfile = require(`${XBIN_CONSTANTS.API_DIR}/uploadfile.js`);

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}

	try {
		if (jsonReq.path) {	// create initial share
			LOG.debug("Got share file request for path: " + jsonReq.path);

			const fullpath = await cms.getFullPath(headers, jsonReq.path, jsonReq.extraInfo);
			if (!await cms.isSecure(headers, fullpath, jsonReq.extraInfo)) {LOG.error(`Path security validation failure: ${jsonReq.path}`); return CONSTANTS.FALSE_RESULT;}
			if (!await uploadfile.isFileConsistentOnDisk(fullpath)) {LOG.error(`Path is not consistent on the disk ${jsonReq.path}`); return CONSTANTS.FALSE_RESULT;}

			const expiry = Date.now()+((jsonReq.expiry||XBIN_CONSTANTS.CONF.DEFAULT_SHARED_FILE_EXPIRY)*86400000);	
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

async function deleteSharesForID(id) {
	const deleteDrops = [{cmd:"DELETE FROM shares WHERE id = ?", params: [id]}, 
		{cmd:"DELETE FROM quotas WHERE id = ?", params: [id]}];

	return await db.runTransaction(deleteDrops);
}

const validateRequest = jsonReq => (jsonReq && (jsonReq.path || (jsonReq.id && jsonReq.expiry)));

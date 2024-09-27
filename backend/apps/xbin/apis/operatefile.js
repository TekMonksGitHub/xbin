/**
 * Reads or writes data to an existing file. Assumption is
 * that it is a UTF-8 encoded file only.
 * 
 * (C) 2020 TekMonks. All rights reserved.
 */
const utils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const cms = require(`${XBIN_CONSTANTS.LIB_DIR}/cms.js`);
const blackboard = require(`${CONSTANTS.LIBDIR}/blackboard.js`);
const uploadfile = require(`${XBIN_CONSTANTS.API_DIR}/uploadfile.js`);
const downloadfile = require(`${XBIN_CONSTANTS.API_DIR}/downloadfile.js`);

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	jsonReq.op = jsonReq.op || "read";
	
	LOG.debug("Got operatefile request for path: " + jsonReq.path);

	try {
		const result = {...CONSTANTS.TRUE_RESULT}, fullpath = await cms.getFullPath(headers, jsonReq.path, jsonReq.extraInfo);
		if (jsonReq.op == "read") result.data = await downloadfile.readUTF8File(headers, jsonReq.path, jsonReq.extraInfo);	// it is a read operation
		else if (jsonReq.op == "write") {
			await uploadfile.writeUTF8File(headers, jsonReq.path, Buffer.isBuffer(jsonReq.data) ? 
				jsonReq.data : Buffer.from(jsonReq.data, "utf8"), jsonReq.extraInfo);	// it is a write operation
			blackboard.publish(XBIN_CONSTANTS.XBINEVENT, {type: XBIN_CONSTANTS.EVENTS.FILE_MODIFIED, path: fullpath, 
				ip: utils.getLocalIPs()[0], id: cms.getID(headers), org: cms.getOrg(headers), isxbin: true, extraInfo: jsonReq.extraInfo});
		} else if (jsonReq.op == "updatecomment") await uploadfile.updateFileStats(	// update file comment
			headers, jsonReq.path, undefined, true, undefined, jsonReq.comment, jsonReq.extraInfo);
		return result;
	} catch (err) { LOG.error(`Error operating file: ${jsonReq.path}, error is: ${err}.`); return CONSTANTS.FALSE_RESULT; }
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path && (!jsonReq.op || jsonReq.op == "read" || 
	(jsonReq.op == "write" && jsonReq.data) || (jsonReq.op == "updatecomment" && jsonReq.comment)));
/**
 * Reads or writes data to an existing file. Assumption is
 * that it is a UTF-8 encoded file only.
 * 
 * (C) 2020 TekMonks. All rights reserved.
 */

const uploadfile = require(`${API_CONSTANTS.API_DIR}/uploadfile.js`);
const downloadfile = require(`${API_CONSTANTS.API_DIR}/downloadfile.js`);
const quotas = require(`${API_CONSTANTS.LIB_DIR}/quotas.js`);
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);
const fspromises = require("fs").promises;
const path = require("path");

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	jsonReq.op = jsonReq.op || "read";
	
	LOG.debug("Got operatefile request for path: " + jsonReq.path);

	const fullpath = path.resolve(`${await cms.getCMSRoot(headers)}/${jsonReq.path}`);
	if (!await cms.isSecure(headers, fullpath)) {LOG.error(`Subdir validation failure: ${jsonReq.path}`); return CONSTANTS.FALSE_RESULT;}

	try {
		let result = {...CONSTANTS.TRUE_RESULT};
		if (jsonReq.op == "read") result.data = await fspromises.readFile(fullpath, "UTF-8");
		else {
			const additionalBytesToWrite = Buffer.from(jsonReq.data, "utf8").length - (await fspromises.stat(fullpath)).size;
			if (!(await quotas.checkQuota(headers, additionalBytesToWrite)).result) throw ("Quota is full write failed.");
			else await fspromises.writeFile(fullpath, jsonReq.data, "UTF-8");
		}

        return result;
	} catch (err) {
		LOG.error(`Error creating  path: ${fullpath}, error is: ${err}`); return CONSTANTS.FALSE_RESULT;
	}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path && (!jsonReq.op || jsonReq.op == "read" || 
	(jsonReq.op == "write" && jsonReq.data) || (jsonReq.op == "updatecomment" && jsonReq.comment)));
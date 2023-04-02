/** 
 * (C) 2020 TekMonks. All rights reserved.
 */
const path = require("path");
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);
const fspromises = require("fs").promises;
const uploadfile = require(`${API_CONSTANTS.API_DIR}/uploadfile.js`);

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got createfile request for path: " + jsonReq.path);

	try {
		const fullpath = path.resolve(`${await cms.getCMSRoot(headers)}/${jsonReq.path}`);
		if (!await cms.isSecure(headers, fullpath)) {LOG.error(`Path security validation failure: ${jsonReq.path}`); return CONSTANTS.FALSE_RESULT;}

		if (jsonReq.isDirectory && jsonReq.isDirectory != "false") await uploadfile.createFolder(headers, jsonReq.path);
		else await fspromises.appendFile(fullpath, '');

        return CONSTANTS.TRUE_RESULT;
	} catch (err) {LOG.error(`Error creating  path: ${fullpath}, error is: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path);

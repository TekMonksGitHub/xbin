/** 
 * (C) 2020 TekMonks. All rights reserved.
 */
const path = require("path");
const fspromises = require("fs").promises;
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got createfile request for path: " + jsonReq.path);

	const fullpath = path.resolve(`${await cms.getCMSRoot(headers)}/${jsonReq.path}`);
	if (!await cms.isSecure(headers, fullpath)) {LOG.error(`Path security validation failure: ${jsonReq.path}`); return CONSTANTS.FALSE_RESULT;}

	try {

		if (jsonReq.isDirectory && jsonReq.isDirectory != "false") await fspromises.mkdir(fullpath);
		else await fspromises.appendFile(fullpath, '');

        return CONSTANTS.TRUE_RESULT;
	} catch (err) {LOG.error(`Error creating  path: ${fullpath}, error is: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path);

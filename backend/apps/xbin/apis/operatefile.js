/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const fs = require("fs");
const path = require("path");
const util = require("util");
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);
const CONF = require(`${API_CONSTANTS.CONF_DIR}/xbin.json`);

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	jsonReq.op = jsonReq.op || "read";
	
	LOG.debug("Got operatefile request for path: " + jsonReq.path);

	const fullpath = path.resolve(`${CONF.CMS_ROOT}/${jsonReq.path}`);
	if (!API_CONSTANTS.isSubdirectory(fullpath, CONF.CMS_ROOT)) {LOG.error(`Subdir validation failure: ${jsonReq.path}`); return CONSTANTS.FALSE_RESULT;}

	try {
		let result = {...CONSTANTS.TRUE_RESULT};
		if (jsonReq.op == "read") result.data = await readFileAsync(fullpath, "UTF-8");
		else writeFileAsync(fullpath, jsonReq.data, "UTF-8");

        return result;
	} catch (err) {LOG.error(`Error creating  path: ${fullpath}, error is: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path && (!jsonReq.op || jsonReq.op == "read" || (jsonReq.op == "write" && jsonReq.data)));

/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const path = require("path");
const utils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);
const CONF = require(`${API_CONSTANTS.CONF_DIR}/xbin.json`);

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) { LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT; }
	
	LOG.debug(`Got copyfile request from: ${jsonReq.from}, to: ${jsonReq.to}`);

	const fromPath = path.resolve(`${cms.getCMSRoot(headers)}/${jsonReq.from}`); 
	const toPath = path.resolve(`${cms.getCMSRoot(headers)}/${jsonReq.to}`);
	if (!API_CONSTANTS.isSubdirectory(fromPath, CONF.CMS_ROOT)) {LOG.error(`Subdir validation failure: ${jsonReq.from}`); return CONSTANTS.FALSE_RESULT;}
	if (!API_CONSTANTS.isSubdirectory(toPath, CONF.CMS_ROOT)) {LOG.error(`Subdir validation failure: ${jsonReq.to}`); return CONSTANTS.FALSE_RESULT;}

	try { await utils.copyFileOrFolder(fromPath, toPath); return CONSTANTS.TRUE_RESULT; } 
	catch (err) { LOG.error(`Error copying from: ${fromPath}, to: ${toPath}, error is: ${err}`); return CONSTANTS.FALSE_RESULT; }
}

const validateRequest = jsonReq => (jsonReq && jsonReq.from && jsonReq.to);

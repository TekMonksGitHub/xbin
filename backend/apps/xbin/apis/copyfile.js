/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const path = require("path");
const fspromises = require("fs").promises;
const utils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);
const quotas = require(`${API_CONSTANTS.LIB_DIR}/quotas.js`);

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) { LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT; }
	
	LOG.debug(`Got copyfile request from: ${jsonReq.from}, to: ${jsonReq.to}`);

	const fromPath = path.resolve(`${await cms.getCMSRoot(headers)}/${jsonReq.from}`); 
	const toPath = path.resolve(`${await cms.getCMSRoot(headers)}/${jsonReq.to}`);
	if (!await cms.isSecure(headers, fromPath)) {LOG.error(`Path security validation failure: ${jsonReq.from}`); return CONSTANTS.FALSE_RESULT;}
	if (!await cms.isSecure(headers, toPath)) {LOG.error(`Path security validation failure: ${jsonReq.to}`); return CONSTANTS.FALSE_RESULT;}

	try { 
		const stat = fspromises.stat(fromPath); if (!await quotas.checkQuota(headers, stat.size)) {LOG.error("Quota is full write failed."); return;}
		await utils.copyFileOrFolder(fromPath, toPath); return CONSTANTS.TRUE_RESULT; 
	} catch (err) { LOG.error(`Error copying from: ${fromPath}, to: ${toPath}, error is: ${err}`); return CONSTANTS.FALSE_RESULT; }
}

const validateRequest = jsonReq => (jsonReq && jsonReq.from && jsonReq.to);
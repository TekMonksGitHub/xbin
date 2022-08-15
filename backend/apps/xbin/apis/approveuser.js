/**
 * Logs a user in. 
 * (C) 2015 TekMonks. All rights reserved.
 */
const userid = require(`${APP_CONSTANTS.LIB_DIR}/userid.js`);

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug(`Got approve user request for ID ${jsonReq.id}`);

	const result = await userid.approve(jsonReq.id);

	if (result.result) LOG.info(`User ${jsonReq.id} approved.`); else LOG.error(`Unable to approve user with ID: ${jsonReq.id}.`);

	return result;
}

const validateRequest = jsonReq => (jsonReq && jsonReq.id);

/**
 * Changes the user's password. 
 * (C) 2020 TekMonks. All rights reserved.
 */
const userid = require(`${APP_CONSTANTS.LIB_DIR}/userid.js`);

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got change password request for ID: " + jsonReq.id);

	const result = await userid.changepwph(jsonReq.id, jsonReq.pwph);

	if (result.result) LOG.info(`PWPH changed for: ${jsonReq.id}`); else LOG.error(`Failed to change pwph for: ${jsonReq.id}`);

	return {result: result.result};
}

const validateRequest = jsonReq => (jsonReq && jsonReq.id && jsonReq.pwph);

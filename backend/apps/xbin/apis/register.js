/* 
 * (C) 2015 TekMonks. All rights reserved.
 */

const userid = require(`${API_CONSTANTS.LIB_DIR}/userid.js`);

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got register request for user: " + jsonReq.name);

	let result = await userid.register(jsonReq.id, jsonReq.name);

	if (result) LOG.info(`New user registered: ${jsonReq.name}`); 
	else LOG.error(`User registration error for: ${jsonReq.name}`);

	return {result};
}

const validateRequest = jsonReq => (jsonReq && jsonReq.id && jsonReq.name);
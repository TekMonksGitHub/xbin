/**
 * Returns the users for the given org. 
 * (C) 2015 TekMonks. All rights reserved.
 */
const userid = require(`${APP_CONSTANTS.LIB_DIR}/userid.js`);

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
    
	LOG.info("Got get users request for org: " + jsonReq.org);

	const result = await userid.getUsersForOrg(jsonReq.org);

	if (result.result) LOG.info(`Sending user list for org: ${jsonReq.org}`); else LOG.error(`Unable to users for org: ${jsonReq.org}, DB error`);

	return result;
}

const validateRequest = jsonReq => (jsonReq && jsonReq.org);

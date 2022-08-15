/**
 * Returns TOTP sec for a user given their ID. 
 * (C) 2020 TekMonks. All rights reserved.
 */
const userid = require(`${APP_CONSTANTS.LIB_DIR}/userid.js`);

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got TOTP secret request for ID: " + jsonReq.id);

	return await userid.getTOTPSec(jsonReq.id); 
}

const validateRequest = jsonReq => (jsonReq && jsonReq.id);
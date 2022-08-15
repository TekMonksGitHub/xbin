/**
 * Validates TOTP for an ID given totpsec. 
 * (C) 2020 TekMonks. All rights reserved.
 */
const totp = require(`${APP_CONSTANTS.LIB_DIR}/totp.js`);

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got OTP validation request for ID" + jsonReq.id);

	return {result: totp.verifyTOTP(jsonReq.totpsec, jsonReq.otp)};
}

const validateRequest = jsonReq => (jsonReq && jsonReq.id && jsonReq.totpsec && jsonReq.otp);
/**
 * Registers a new user. 
 * (C) 2015 TekMonks. All rights reserved.
 */
const totp = require(`${APP_CONSTANTS.LIB_DIR}/totp.js`);
const userid = require(`${APP_CONSTANTS.LIB_DIR}/userid.js`);

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got register request for ID: " + jsonReq.id);

	if (!totp.verifyTOTP(jsonReq.totpSecret, jsonReq.totpCode)) {
		LOG.error(`Unable to register: ${jsonReq.name}, ID: ${jsonReq.id}, wrong totp code`);
		return CONSTANTS.FALSE_RESULT;
	}

	const existingUsersForOrg = await userid.getUsersForOrg(jsonReq.org), 
		approved = existingUsersForOrg && existingUsersForOrg.length?0:1,
		role = existingUsersForOrg && existingUsersForOrg.length?"user":"admin";

	const result = await userid.register(jsonReq.id, jsonReq.name, jsonReq.org, jsonReq.pwph, jsonReq.totpSecret, role, approved);

	if (result.result) LOG.info(`User registered and logged in: ${jsonReq.name}, ID: ${jsonReq.id}`); else LOG.error(`Unable to register: ${jsonReq.name}, ID: ${jsonReq.id} DB error`);

	return {result: result.result, role};
}

const validateRequest = jsonReq => (jsonReq && jsonReq.pwph && jsonReq.id && jsonReq.name && jsonReq.org && jsonReq.totpSecret && jsonReq.totpCode);

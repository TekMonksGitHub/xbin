/**
 * Updates a user profile. 
 * (C) 2015 TekMonks. All rights reserved.
 */
const totp = require(`${APP_CONSTANTS.LIB_DIR}/totp.js`);
const userid = require(`${APP_CONSTANTS.LIB_DIR}/userid.js`);

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	LOG.debug("Got update request for ID: " + jsonReq.old_id);

	if (jsonReq.totpSecret && !totp.verifyTOTP(jsonReq.totpSecret, jsonReq.totpCode)) {
		LOG.error(`Unable to update: ${jsonReq.name}, ID: ${jsonReq.old_id}, wrong totp code for the new secret.`);
		return CONSTANTS.FALSE_RESULT;
	}

	if (jsonReq.old_id.toLowerCase() != jsonReq.id.toLowerCase()) {	// prevent account takeovers
		const checkExists = await userid.existsID(jsonReq.id); if (checkExists && checkExists.result) {
			LOG.error(`${jsonReq.name}, ID: ${jsonReq.old_id} tried to update their email to another registered user, blocked.`);
			return CONSTANTS.FALSE_RESULT;
		} else LOG.info(`${jsonReq.name}, ID: ${jsonReq.old_id} is changing their ID to ${jsonReq.id}.`);
	}

	const idEntry = await userid.existsID(jsonReq.old_id); if (jsonReq.approved==undefined) jsonReq.approved = idEntry.approved;
	const result = await userid.update(jsonReq.old_id, jsonReq.id, 
		jsonReq.name||idEntry.name, jsonReq.org||idEntry.org, jsonReq.pwph||idEntry.pwph, jsonReq.totpSecret||idEntry.totpsec, 
		jsonReq.role||idEntry.role, (jsonReq.approved==true||jsonReq.approved==1)?1:0);

	if (result.result) LOG.info(`User updated and logged in: ${jsonReq.name}, old ID: ${jsonReq.old_id}, new ID: ${jsonReq.id}`); 
	else LOG.error(`Unable to update: ${jsonReq.name}, ID: ${jsonReq.old_id}, DB error`);

	return {result: result.result, name: result.name, id: result.id, org: result.org, role: result.role, approved: result.approved, tokenflag: result.approved};
}

const validateRequest = jsonReq => (jsonReq && jsonReq.old_id);

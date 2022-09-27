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

	const existingUsersForDomain = await userid.getUsersForDomain(_getRootDomain(jsonReq)), 
		notFirstUserForThisOrg = existingUsersForDomain && existingUsersForDomain.result && existingUsersForDomain.users.length,
		approved = notFirstUserForThisOrg?0:1, role = notFirstUserForThisOrg?"user":"admin";

	await exports.updateOrgAndDomain(jsonReq);	// set domain and override org if needed

	const result = await userid.register(jsonReq.id, jsonReq.name, jsonReq.org, jsonReq.pwph, jsonReq.totpSecret, role, 
		approved, jsonReq.domain);

	if (result.result) LOG.info(`User registered and logged in: ${jsonReq.name}, ID: ${jsonReq.id}`); else LOG.error(`Unable to register: ${jsonReq.name}, ID: ${jsonReq.id} DB error`);

	return {result: result.result, role, tokenflag: approved?true:false};
}

exports.updateOrgAndDomain = async jsonReq => {
	const rootDomain = _getRootDomain(jsonReq);
	const existingUsersForDomain = await userid.getUsersForDomain(rootDomain);
	if (existingUsersForDomain && existingUsersForDomain.result && existingUsersForDomain.users.length) 
		jsonReq.org = (await userid.getOrgForDomain(rootDomain))||jsonReq.org;	// if this domain already exists, override the org to the existing organization
	jsonReq.domain = rootDomain;
}

function _getRootDomain(jsonReq) {
	const domain = jsonReq.id.indexOf("@") != -1 ? jsonReq.id.substring(jsonReq.id.indexOf("@")+1) : "undefined"
	return domain;
}

const validateRequest = jsonReq => (jsonReq && jsonReq.pwph && jsonReq.id && jsonReq.name && jsonReq.org && jsonReq.totpSecret && jsonReq.totpCode);
/**
 * Logs a user in. 
 * (C) 2015 TekMonks. All rights reserved.
 */
const totp = require(`${APP_CONSTANTS.LIB_DIR}/totp.js`);
const userid = require(`${APP_CONSTANTS.LIB_DIR}/userid.js`);
const jwttokenmanager = APIREGISTRY.getExtension("JWTTokenManager");
init();

function init() {
	jwttokenmanager.addListener((event, object) => {
		if (event == "token_generated") try {
			const token = ("Bearer "+object.token).toLowerCase(); 
			const logins = CLUSTER_MEMORY.get("__org_monkshu_loginapp_logins") || {};
			logins[token] = {id: object.response.id, org: object.response.org, name: object.response.name, role: object.response.role}; 
			CLUSTER_MEMORY.set("__org_monkshu_loginapp_logins", logins);
		} catch (err) {LOG.error(`Could not init home for the user with ID ${object.response.id}, name ${object.response.name}, error was: ${err}`);}

		if (event == "token_expired") {
			const logins = CLUSTER_MEMORY.get("__org_monkshu_loginapp_logins") || {};
			const token = ("Bearer "+object.token).toLowerCase();
			delete logins[token]; CLUSTER_MEMORY.set("__org_monkshu_loginapp_logins", logins);
		}
	});
}
exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug(`Got login request for ID ${jsonReq.id}`);

	const result = await userid.checkPWPH(jsonReq.id, jsonReq.pwph); 

	if (result.result && result.approved) {	// perform second factor
		result.result = /*totp.verifyTOTP(result.totpsec, jsonReq.otp); */ true; // <-- remove this post testing.
		if (!result.result) LOG.error(`Bad OTP given for: ${result.id}.`);
	} else if (result.result && (!result.approved)) {LOG.info(`User not approved, ${result.id}.`); result.result = false;}
	else LOG.error(`Bad PWPH, given for ID: ${jsonReq.id}.`);

	if (result.result) LOG.info(`User logged in: ${result.id}.`); else LOG.error(`Bad login for ID: ${jsonReq.id}.`);

	if (result.result) return {result: result.result, name: result.name, id: result.id, org: result.org, role: result.role};
	else return CONSTANTS.FALSE_RESULT;
}

exports.getID = headers => {
	if (!headers["authorization"]) return null; const logins = CLUSTER_MEMORY.get("__org_monkshu_loginapp_logins") || {};
	return logins[headers["authorization"].toLowerCase()]?logins[headers["authorization"].toLowerCase()].id:null;
}

exports.getOrg = headers => {
	if (!headers["authorization"]) return null; const logins = CLUSTER_MEMORY.get("__org_monkshu_loginapp_logins") || {};
	return logins[headers["authorization"].toLowerCase()]?logins[headers["authorization"].toLowerCase()].org:null;
}

exports.getRole = headers => {
	if (!headers["authorization"]) return null; const logins = CLUSTER_MEMORY.get("__org_monkshu_loginapp_logins") || {};
	return logins[headers["authorization"].toLowerCase()]?logins[headers["authorization"].toLowerCase()].role:null;
}

const validateRequest = jsonReq => (jsonReq && jsonReq.pwph && jsonReq.otp && jsonReq.id);

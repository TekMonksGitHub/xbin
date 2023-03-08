/**
 * Logs a user in. 
 * (C) 2015 TekMonks. All rights reserved.
 */
const utils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const totp = require(`${APP_CONSTANTS.LIB_DIR}/totp.js`);
const CONF = require(`${API_CONSTANTS.CONF_DIR}/app.json`);
const userid = require(`${APP_CONSTANTS.LIB_DIR}/userid.js`);
const jwttokenmanager = APIREGISTRY.getExtension("JWTTokenManager");
const queueExecutor = require(`${CONSTANTS.LIBDIR}/queueExecutor.js`);

const DEFAULT_QUEUE_DELAY = 500, REASONS = {BAD_PASSWORD: "badpw", BAD_ID: "badid", BAD_OTP: "badotp", 
	BAD_APPROVAL: "notapproved", OK: "allok", UNKNOWN: "unknown"};

exports.init = _ => {
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

exports.doService = async (jsonReq, servObject) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug(`Got login request for ID ${jsonReq.id}`);

	const result = await userid.checkPWPH(jsonReq.id, jsonReq.pwph); 

	result.tokenflag = false; 	// default assume login failed no JWT token will be generated
	if (result.result && result.approved) {	// perform second factor
		result.result = totp.verifyTOTP(result.totpsec, jsonReq.otp); 
		if (!result.result) {LOG.error(`Bad OTP given for: ${result.id}.`); result.reason = REASONS.BAD_OTP;}
		else {result.tokenflag = true; result.reason = REASONS.OK;}	// ID is OK, password is OK, OTP is OK, and user is approved
	} else if (result.result && (!result.approved)) {LOG.info(`User not approved, ${result.id}.`); result.reason = REASONS.BAD_APPROVAL;}
	else {
		result.reason = result.reason == userid.NO_ID ? REASONS.BAD_ID : result.reason == userid.BAD_PASSWORD ? REASONS.BAD_PASSWORD : REASONS.UNKNOWN;
		LOG.error(`${result.reason == REASONS.BAD_ID?"Bad id":result.reason == REASONS.BAD_PASSWORD?"Bad password":"Unknown reason for login failure"} for login request for ID: ${jsonReq.id}.`);
	}

	if (result.tokenflag) {
		LOG.info(`User logged in: ${result.id}${CONF.verify_email_on_registeration?`, email verification status is ${result.verified}.`:"."}`); 
		const remoteIP = utils.getClientIP(servObject.req);	// api end closes the socket so when the queue task runs remote IP is lost.
		queueExecutor.add(async _=>{	// update login stats don't care much if it fails
			try { await userid.updateLoginStats(jsonReq.id, Date.now(), remoteIP), undefined, true, CONF.login_update_delay||DEFAULT_QUEUE_DELAY } 
			catch(err) {LOG.error(`Error updating login stats for ID ${jsonReq.id}. Error is ${err}.`);}
		});	
	} else LOG.error(`Bad login or not approved for ID: ${jsonReq.id}.`);

	return {...result, verified: result.verified==1?true:false};
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

exports.isAdmin = headers => (exports.getRole(headers))?.toLowerCase() == "admin";

exports.REASONS = REASONS;

const validateRequest = jsonReq => (jsonReq && jsonReq.pwph && jsonReq.otp && jsonReq.id);

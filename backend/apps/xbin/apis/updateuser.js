/**
 * Updates a user profile. User can update their name, email etc
 * but can not update their organization to prevent organizational
 * lateral attacks. An org change must be done via a new account.
 * (C) 2015 TekMonks. All rights reserved.
 */
const totp = require(`${APP_CONSTANTS.LIB_DIR}/totp.js`);
const login = require(`${API_CONSTANTS.API_DIR}/login.js`);
const userid = require(`${APP_CONSTANTS.LIB_DIR}/userid.js`);
const register = require(`${API_CONSTANTS.API_DIR}/register.js`);

const idChangeListeners = [];

exports.addIDChangeListener = listener => idChangeListeners.push(listener);

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	LOG.debug("Got update request for ID: " + jsonReq.old_id);

	if (jsonReq.new_id && (!(await register.allowDomain(jsonReq, "new_id")))) {	// new domain is not allowed
		LOG.error(`Unable to update: ${jsonReq.name}, ID: ${jsonReq.old_id}, to new ID: ${jsonReq.new_id}. The new domain is not allowed.`);
		return {...CONSTANTS.FALSE_RESULT, reason: register.REASONS.DOMAIN_ERROR};
	}

	if (jsonReq.totpSecret && !totp.verifyTOTP(jsonReq.totpSecret, jsonReq.totpCode)) {	// totp check
		LOG.error(`Unable to update: ${jsonReq.name}, ID: ${jsonReq.old_id}, wrong totp code for the new secret.`);
		return {...CONSTANTS.FALSE_RESULT, reason: register.REASONS.OTP_ERROR};
	}

	const idEntry = await userid.existsID(jsonReq.old_id); 
	if ( (jsonReq.approved==undefined) || (!login.isAdmin(headers)) ) jsonReq.approved = idEntry.approved;	// only admin can approve
	
	if (jsonReq.org != idEntry.org) {
		LOG.error(`${jsonReq.name}, ID: ${jsonReq.old_id} tried to update their org, blocked.`);
		return {...CONSTANTS.FALSE_RESULT, reason: register.REASONS.SECURITY_ERROR};
	}

	const successfulListeners = [], rollback = async _ => {	
		for (idChangeListener of successfulListeners) await idChangeListener(jsonReq.new_id, jsonReq.old_id, jsonReq.org);}
	let userDomain = register.getRootDomain(jsonReq, "old_id");
	if (jsonReq.old_id.toLowerCase() != jsonReq.new_id.toLowerCase()) {	// domain check, account takeover check and tell ID change listeners the user is changing their ID
		const checkExists = await userid.existsID(jsonReq.new_id); if (checkExists && checkExists.result) {	// account takeover check
			LOG.error(`${jsonReq.name}, ID: ${jsonReq.old_id} tried to update their ID/email to another registered user, blocked.`);
			return {...CONSTANTS.FALSE_RESULT, reason: register.REASONS.ID_EXISTS};
		} else LOG.info(`${jsonReq.name}, ID: ${jsonReq.old_id} is changing their ID to ${jsonReq.new_id}.`);

		if (!register.checkOrgAndDomainMatch(jsonReq, "new_id", true)) {	// domain check
			LOG.error(`Unable to update: ${jsonReq.name}, ID: ${jsonReq.old_id}, org and domain security error.`);
			return {...CONSTANTS.FALSE_RESULT, reason: register.REASONS.DOMAIN_ERROR};
		}

		// listeners informed
		for (idChangeListener of idChangeListeners) if (!await idChangeListener(jsonReq.old_id, jsonReq.new_id, jsonReq.org)) {
			await rollback(); 
			LOG.error(`Unable to update: ${jsonReq.name}, ID: ${jsonReq.old_id}, an ID change listener vetoed.`); 
			return {...CONSTANTS.FALSE_RESULT, reason: register.REASONS.INTERNAL_ERROR}; 
		} else successfulListeners.push(idChangeListener);

		userDomain = register.getRootDomain(jsonReq, "new_id");	// domain may have potentially changed too
	}

	const result = await userid.update(jsonReq.old_id, jsonReq.new_id, jsonReq.name||idEntry.name, 
		jsonReq.org||idEntry.org, idEntry.pwph, jsonReq.pwph, jsonReq.totpSecret||idEntry.totpsec, 
		jsonReq.role||idEntry.role, (jsonReq.approved==true||jsonReq.approved==1)?1:0, userDomain);

	if (result.result) {	// update done successfully
		LOG.info(`User updated and logged in: ${jsonReq.name}, old ID: ${jsonReq.old_id}, new ID: ${jsonReq.new_id}`); 
		return {...CONSTANTS.TRUE_RESULT, ...result, tokenflag: result.approved==1?true:false, reason: undefined};
	}
	else {	// DB or internal error
		LOG.error(`Unable to update: ${jsonReq.name}, ID: ${jsonReq.old_id}, DB error`);
		if (jsonReq.old_id.toLowerCase() != jsonReq.new_id.toLowerCase()) rollback();	// rollback ID change if applicable
		return {...CONSTANTS.FALSE_RESULT, reason: register.REASONS.INTERNAL_ERROR};
	}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.id && jsonReq.old_id);

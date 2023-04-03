/**
 * Adds or updates an org.
 * (C) 2022 TekMonks. All rights reserved.
 */

const userid = require(`${APP_CONSTANTS.LIB_DIR}/userid.js`);
const register = require(`${APP_CONSTANTS.API_DIR}/register.js`);

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	LOG.debug("Got add or update request for org: " + jsonReq.org);

	if (!userid.shouldAllowDomain(jsonReq.domain)) {	// see if we should allow the domain
		LOG.error(`Security error unable to update org: ${jsonReq.org}, request submitted by ID: ${jsonReq.id}. Domain ${jsonReq.domain} not alllowed.`);
		return {...CONSTANTS.FALSE_RESULT, reason: register.REASONS.DOMAIN_ERROR};
	}

	const result = await userid.addOrUpdateOrg(jsonReq.org, jsonReq.primary_contact_name, jsonReq.primary_contact_email, 
		jsonReq.address, jsonReq.domain, jsonReq.alternate_names, jsonReq.alternate_domains);
	result.org = result.name; delete result.name; 

	if (result.result) {	// update done successfully
		LOG.info(`Org added or updated ${result.org}, `); 
		return {...CONSTANTS.TRUE_RESULT, ...result};
	}
	else {	// DB or internal error
		LOG.error(`Unable to add or update org ${jsonReq.org} DB error.`);
		return {...CONSTANTS.FALSE_RESULT, reason: register.REASONS.INTERNAL_ERROR};
	}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.id && jsonReq.org && jsonReq.primary_contact_name && 
	jsonReq.primary_contact_email && jsonReq.address && jsonReq.domain && jsonReq.alternate_names && 
	jsonReq.alternate_domains);

/**
 * Returns an org's data.
 * (C) 2022 TekMonks. All rights reserved.
 */
const userid = require(`${APP_CONSTANTS.LIB_DIR}/userid.js`);

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}

	LOG.info(`Got getOrg request for org ${jsonReq.org} from ID ${jsonReq.id}`);

	const result = await userid.getOrg(jsonReq.org), alternate_domains = [], 
		registeredDomainsForOrg = (result?.result)?(await userid.getDomainsForOrg(result.name))||[] : [];
	if (result?.result) for (const domain of registeredDomainsForOrg) 
		if (domain.toLowerCase() != result.domain.toLowerCase()) alternate_domains.push(domain);
	result.alternate_names = JSON.parse(result.alternate_names_json); delete result.alternate_names_json;

	if (result.result) LOG.info(`Sending data for org ${jsonReq.org} as ${JSON.stringify(result)}.`); 
	else LOG.error(`Unable to find org with name ${jsonReq.org}, DB error.`);

	return {...result, ...CONSTANTS.TRUE_RESULT, alternate_domains};
}

const validateRequest = jsonReq => (jsonReq && jsonReq.id && jsonReq.org);
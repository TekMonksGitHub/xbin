/* 
 * (C) 2015 TekMonks. All rights reserved.
 */
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);
const userid = require(`${API_CONSTANTS.LIB_DIR}/userid.js`);
const jwttokenmanager = require(`${CONSTANTS.LIBDIR}/apiregistry_extensions/jwttokenmanager.js`);
init();

function init() {
	jwttokenmanager.addListener(async (event, object) => {
		if (event == "token_generated") try {
			const token = ("Bearer "+object.token).toLowerCase(); 
			const logins = CLUSTER_MEMORY.get("__org_xbin_logins") || {};
			logins[token] = {id: object.response.id, org: object.response.org, name: object.response.name}; 
			CLUSTER_MEMORY.set("__org_xbin_logins", logins);
			await cms.initID({"authorization": token});
		} catch (err) {LOG.error(`Could not init home for the user with ID ${object.response.id}, name ${object.response.name}, error was: ${err}`);}

		if (event == "token_expired") {
			const logins = CLUSTER_MEMORY.get("__org_xbin_logins") || {};
			const token = ("Bearer "+object.token).toLowerCase();
			delete logins[token]; CLUSTER_MEMORY.set("__org_xbin_logins", logins);
		}
	});
}

exports.doService = async (jsonReq, _servObject, _headers, _url, _apiconf) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got login request for ID: " + jsonReq.id);

	let result = await userid.login(jsonReq.id);

	if (result.result) LOG.info(`User logged in: ${result.name}`); else LOG.error(`Bad login for id: ${jsonReq.id}`);

	return {result: result.result, id: jsonReq.id, org: result.result?result.org:null, name: result.name};
}

exports.getID = headers => {
	if (!headers["authorization"]) return null; const logins = CLUSTER_MEMORY.get("__org_xbin_logins") || {};
	return logins[headers["authorization"].toLowerCase()]?logins[headers["authorization"].toLowerCase()].id:null;
}

exports.getOrg = headers => {
	if (!headers["authorization"]) return null; const logins = CLUSTER_MEMORY.get("__org_xbin_logins") || {};
	return logins[headers["authorization"].toLowerCase()]?logins[headers["authorization"].toLowerCase()].org:null;
}

const validateRequest = jsonReq => (jsonReq && jsonReq.id);

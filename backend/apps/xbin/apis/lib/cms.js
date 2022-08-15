/** 
 * (C) 2020 TekMonks. All rights reserved.
 */
const fspromises = require("fs").promises;
const login = require(`${API_CONSTANTS.API_DIR}/login.js`);
const CONF = require(`${API_CONSTANTS.CONF_DIR}/xbin.json`);

exports.getCMSRoot = async function(headers) {
	let loginID = login.getID(headers); if (!loginID) throw "No login for CMS root"; else loginID = loginID.toLowerCase();
	let org = login.getOrg(headers); org = org?org.toLowerCase():"unknown";
	if (loginID) {
		const cmsRootToReturn = `${CONF.CMS_ROOT}/${convertToPathFriendlyString(org)}/${convertToPathFriendlyString(loginID)}`;
		try { await fspromises.access(cmsRootToReturn, fs.F_OK) } catch (err) { await fspromises.mkdir(cmsRootToReturn, {recursive: true}); }
		return cmsRootToReturn;
	} else throw "Bad user or no user logged in";
}

const convertToPathFriendlyString = s => Buffer.from(s).toString("base64url");

exports.isSecure = async (headers, path) => API_CONSTANTS.isSubdirectory(path, await this.getCMSRoot(headers));
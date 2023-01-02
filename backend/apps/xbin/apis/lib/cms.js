/** 
 * (C) 2020 TekMonks. All rights reserved.
 */
const fs = require("fs");
const fspromises = fs.promises;
const login = require(`${API_CONSTANTS.API_DIR}/login.js`);

exports.getCMSRoot = async function(headers) {
	let loginID = login.getID(headers); if (!loginID) throw "No login for CMS root"; else loginID = loginID.toLowerCase();
	let org = login.getOrg(headers); org = org?org.toLowerCase():"unknown";
	if (loginID) {
		const cmsRootToReturn = `${API_CONSTANTS.CONF.CMS_ROOT}/${_convertToPathFriendlyString(org)}/${_convertToPathFriendlyString(loginID)}`;
		try { await fspromises.access(cmsRootToReturn, fs.F_OK) } catch (err) { await fspromises.mkdir(cmsRootToReturn, {recursive: true}); }
		return cmsRootToReturn;
	} else throw "Bad user or no user logged in";
}

exports.isSecure = async (headers, path) => API_CONSTANTS.isSubdirectory(path, await this.getCMSRoot(headers));

const _convertToPathFriendlyString = s => Buffer.from(s).toString("base64url");

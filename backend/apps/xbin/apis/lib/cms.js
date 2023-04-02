/** 
 * (C) 2020 TekMonks. All rights reserved.
 */
const fs = require("fs");
const fspromises = fs.promises;
const utils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const login = require(`${API_CONSTANTS.API_DIR}/login.js`);
const register = require(`${API_CONSTANTS.API_DIR}/register.js`);
const updateuser = require(`${API_CONSTANTS.API_DIR}/updateuser.js`);

exports.init = _ => {
	updateuser.addIDChangeListener(async (oldID, newID, org) => {	// ID changes listener
		const oldPath = _getPathForIDAndOrg(oldID, org), newPath = _getPathForIDAndOrg(newID, org);
		try {
			if (!await utils.rmrf(newPath)) throw `Can't access or delete path ${newPath}`;	// remove existing newPath folder, if it exists, as this ID is taking it over
			await fspromises.rename(oldPath, newPath); 
			LOG.info(`Renamed home folder for ID ${oldID} who is changing their ID to new ID ${newID} from ${oldPath} to ${newPath}.`); return true;
		} catch (err) {
			LOG.error(`Error renaming home folder for ID ${oldID} who is changing their ID to new ID ${newID}. Error is ${err}.`);
			return false;
		}
	})

	register.addNewUserListener(async (id, org) => {	// ID registration listener
		const home = _getPathForIDAndOrg(id, org);
		try {await utils.rmrf(home); return true;} catch(err) {
			LOG.error(`Can't init the home folder for id ${id} for org ${org} as can't access or delete path ${home}. The error is ${err}.`); 
			return false;
		}
	});
}

exports.getCMSRoot = async function(headers) {
	const loginID = login.getID(headers); if (!loginID) throw "No login for CMS root"; 
	const org = login.getOrg(headers)||"unknown";
	const cmsRootToReturn = _getPathForIDAndOrg(loginID, org);
	try { await fspromises.access(cmsRootToReturn, fs.F_OK); } catch (err) { await fspromises.mkdir(cmsRootToReturn, {recursive: true}); }
	LOG.info(`Returning CMS home as ${cmsRootToReturn} for id ${loginID} of org ${org}.`);
	return cmsRootToReturn;
}

exports.isSecure = async (headers, path) => API_CONSTANTS.isSubdirectory(path, await this.getCMSRoot(headers));

const _getPathForIDAndOrg = (id, org) => `${API_CONSTANTS.CONF.CMS_ROOT}`;

const _convertToPathFriendlyString = s => Buffer.from(s).toString("base64url");

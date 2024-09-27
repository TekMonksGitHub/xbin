/** 
 * Handles CMS root file system.
 * (C) 2020 TekMonks. All rights reserved.
 */
const fs = require("fs");
const path = require("path");
const fspromises = fs.promises;
const login = require(`${XBIN_CONSTANTS.API_DIR}/login.js`);

const DEFAULT_MAX_PATH_LENGTH = 50, CMSPATH_MODIFIERS = [], SAFE_CMS_PATHS = [];

/**
 * @param {object} headersOrLoginIDAndOrg HTTP request headers or {xbin_id, xbin_org} object
 * @param {extraInfo} Extra info object for CMS root, if passed in
 * @returns The CMS root for this user.
 */
exports.getCMSRoot = async function(headersOrLoginIDAndOrg, extraInfo) {
	const headersOrLoginIDAndOrgIsHeaders = !(headersOrLoginIDAndOrg.xbin_org &&  headersOrLoginIDAndOrg.xbin_id);
	const loginID = headersOrLoginIDAndOrgIsHeaders ? login.getID(headersOrLoginIDAndOrg) : headersOrLoginIDAndOrg.xbin_id; 
	if (!loginID) throw "No login for CMS root"; 
	const org = headersOrLoginIDAndOrgIsHeaders ? (login.getOrg(headersOrLoginIDAndOrg)||"unknown") : headersOrLoginIDAndOrg.xbin_org;
	let cmsRootToReturn = _getPathForIDAndOrg(loginID, org);
	LOG.debug(`CMS raw root located at ${cmsRootToReturn} for ID ${loginID}.`);
	if (CMSPATH_MODIFIERS.length) for (cmsPathModifier of CMSPATH_MODIFIERS) 
		cmsRootToReturn = await cmsPathModifier(cmsRootToReturn, loginID, org, extraInfo);
	cmsRootToReturn = path.resolve(cmsRootToReturn);
	LOG.debug(`Located final CMS home as ${cmsRootToReturn} for id ${loginID} of org ${org}.`);

	if (!SAFE_CMS_PATHS[cmsRootToReturn]) try {	// ensure directory exists if we have not already done so
		await fspromises.access(cmsRootToReturn, fs.F_OK); SAFE_CMS_PATHS[cmsRootToReturn] = true; } catch (err) { 
			await fspromises.mkdir(cmsRootToReturn, {recursive: true}); SAFE_CMS_PATHS[cmsRootToReturn] = true; }
	
	return cmsRootToReturn;
}

/**
 * @param {object} headersOrLoginIDAndOrg HTTP request headers or {xbin_id, xbin_org} object
 * @param {string} fullpath The full path 
 * @param {extraInfo} Extra info object for CMS root, if passed in
 * @returns The CMS root relative path for this user, given a full path
 */
exports.getCMSRootRelativePath = async function(headersOrLoginIDAndOrg, fullpath, extraInfo) {
	const cmsroot = await exports.getCMSRoot(headersOrLoginIDAndOrg, extraInfo);
	const relativePath = path.relative(cmsroot, fullpath).replaceAll("\\", "/");
	return relativePath;
}

/**
 * @param {object} headersOrLoginIDAndOrg HTTP request headers or {xbin_id, xbin_org} object
 * @param {string} cmsPath The CMS path
 * @param {extraInfo} Extra info object for CMS root, if passed in
 * @returns The full path for this user, given a cms path
 */
exports.getFullPath = async function(headersOrLoginIDAndOrg, cmsPath, extraInfo) {
	const cmsroot = await exports.getCMSRoot(headersOrLoginIDAndOrg, extraInfo);
	const fullpath = path.resolve(`${cmsroot}/${cmsPath}`);
	return fullpath;
}

/**
 * Returns ID of the user given headers or ID & ORG object
 * @param {object} headersOrLoginIDAndOrg HTTP request headers or {xbin_id, xbin_org} object
 * @returns User ID
 */
exports.getID = headersOrLoginIDAndOrg => headersOrLoginIDAndOrg.xbin_id || login.getID(headersOrLoginIDAndOrg);

/**
 * Returns ORG of the user given headers or ID & ORG object
 * @param {object} headersOrLoginIDAndOrg HTTP request headers or {xbin_id, xbin_org} object
 * @returns User ORG
 */
exports.getOrg = headersOrLoginIDAndOrg => headersOrLoginIDAndOrg.xbin_org || login.getOrg(headersOrLoginIDAndOrg);

/**
 * Ensures the path is secure for the given user to operate on.
 * @param {object} headersOrLoginIDAndOrg HTTP request headers or {xbin_id, xbin_org} object
 * @param {string} path The path to operate on
 * @returns {boolean} true on success, false on failure
 */
exports.isSecure = async (headersOrHeadersAndOrg, path, extraInfo) => {	// add domain check here to ensure ID and org domains are ok
	return XBIN_CONSTANTS.isSubdirectory(path, await this.getCMSRoot(headersOrHeadersAndOrg, extraInfo));
}

/**
 * Adds CMS path modifier 
 * @param {function} modifier The path modifier
 */
exports.addCMSPathModifier = modifier => CMSPATH_MODIFIERS.push(modifier);

/**
 * Removes CMS path modifier 
 * @param {function} modifier The path modifier
 */
exports.removeCMSPathModifier = modifier => CMSPATH_MODIFIERS.indexOf(modifier) ? CMSPATH_MODIFIERS.splice(CMSPATH_MODIFIERS.indexOf(modifier),1) : null;

/**
 * Returns overridden config for the corresponding repository for the given path.
 * @param {string} fullpath The fullpath to the file 
 * @returns The overridden config for the corresponding repository for the given path.
 */
exports.getRepositoryConfig = fullpath => {
	for (const [cmsRoot, config] of Object.entries(XBIN_CONSTANTS.CONF.CMS_OVERRIDES||{}))
		if (XBIN_CONSTANTS.isSubdirectory(fullpath, path.resolve(cmsRoot))) {
			const subConfig = {...XBIN_CONSTANTS.CONF, ...config};
			return subConfig;
		}
		
	return XBIN_CONSTANTS.CONF;
}

const _getPathForIDAndOrg = (id, org) => `${XBIN_CONSTANTS.CONF.DEFAULT_CMS_ROOT}/${_convertToPathFriendlyString(org.toLowerCase())}/${_convertToPathFriendlyString(id.toLowerCase())}`;

const _convertToPathFriendlyString = (s, maxPathLength=DEFAULT_MAX_PATH_LENGTH) => {
	let tentativeFilepath = encodeURIComponent(s);
	if (tentativeFilepath.endsWith(".")) tentativeFilepath = tentativeFilepath.substring(0,finalPath.length-1)+"%2E";
		
	if (tentativeFilepath.length > maxPathLength) {
		tentativeFilepath = tentativeFilepath + "." + Date.now();
		tentativeFilepath = tentativeFilepath.substring(tentativeFilepath.length-maxPathLength);
	}
	
	return tentativeFilepath;
}

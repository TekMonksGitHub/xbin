/**
 * Returns file listings from the given path. 
 * (C) 2020 TekMonks. All rights reserved.
 */
const path = require("path");
const fspromises = require("fs").promises;
const cms = require(`${XBIN_CONSTANTS.LIB_DIR}/cms.js`);
const uploadfile = require(`${XBIN_CONSTANTS.API_DIR}/uploadfile.js`);

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got getfiles request for path: " + jsonReq.path);

	const fullpath = await cms.getFullPath(headers, jsonReq.path, jsonReq.extraInfo);
	if (!await cms.isSecure(headers, fullpath, jsonReq.extraInfo)) {LOG.error(`Path security validation failure: ${jsonReq.path}`); return CONSTANTS.FALSE_RESULT;}

	try {
		let retObj = {entries:[], result: true};
		const entries = await fspromises.readdir(fullpath);
		for (const entry of entries) {	
			const entryPath = path.resolve(`${fullpath}/${entry}`); if (exports.ignoreFile(entryPath)) continue;	// ignore our own working files
			if ((!jsonReq.genStatsIfNeeded) && !(await uploadfile.isFileConsistentOnDisk(entryPath))) {	// check consistency only if told not to gen stats
				LOG.error(`Error reading file entry ${fullpath}/${entry}. Skipping from listing. Error is inconsistent file.`); continue; }
			let stats; try {stats = await uploadfile.getFileStats(entryPath, jsonReq.genStatsIfNeeded, jsonReq.path, jsonReq.extraInfo);} catch (err) {
				LOG.error(`Error reading file entry ${fullpath}/${entry}. Skipping from listing. Error is ${err}`); continue; }
			stats.xbintype == XBIN_CONSTANTS.XBIN_FILE?stats.file=true:null; 
			stats.xbintype == XBIN_CONSTANTS.XBIN_FOLDER?stats.directory=true:null; 

			retObj.entries.push({name: entry, path: `${jsonReq.path}/${entry}`, stats});
		}
		return retObj;
	} catch (err) {LOG.error(`Error reading path: ${fullpath}, error is: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

exports.ignoreFile = fullpathOrFilename => {
	const ignorableExtensions = [...XBIN_CONSTANTS.XBIN_IGNORE_PATH_SUFFIXES, ...XBIN_CONSTANTS.CONF.IGNORE_FILE_EXTENSIONS];
	return ignorableExtensions.includes(path.extname(fullpathOrFilename));
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path);

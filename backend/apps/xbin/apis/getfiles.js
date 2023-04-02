/**
 * Returns file listings from the given path. 
 * (C) 2020 TekMonks. All rights reserved.
 */
const path = require("path");
const fspromises = require("fs").promises;
const fs = require("fs");
const { writeUTF8File } = require("./uploadfile");
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);
const uploadfile = require(`${API_CONSTANTS.API_DIR}/uploadfile.js`);

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got getfiles request for path: " + jsonReq.path);

	const fullpath = path.resolve(`${await cms.getCMSRoot(headers)}/${jsonReq.path}`);
	if (!await cms.isSecure(headers, fullpath)) {LOG.error(`Path security validation failure: ${jsonReq.path}`); return CONSTANTS.FALSE_RESULT;}

	const _ignoreFile = fullpathOrFilename => API_CONSTANTS.XBIN_IGNORE_PATH_SUFFIXES.includes(path.extname(fullpathOrFilename));

	try {
		let retObj = {entries:[], result: true};
		const entries = await fspromises.readdir(fullpath);
		for (const entry of entries) {	
			const entryPath = path.resolve(`${fullpath}/${entry}`); if (_ignoreFile(entryPath)) continue;	// ignore our own working files
			
			if (!(await uploadfile.isFileConsistentOnDisk(entryPath))) { // if there is no ignore stats, then add it
				if(fs.statSync(entryPath).isDirectory()){
					await uploadfile.updateFileStats(entryPath, entry, undefined, true, API_CONSTANTS.XBIN_FOLDER)
				}else{
					const existingFileStats = fs.statSync(entryPath);
					await uploadfile.updateFileStats(entryPath, entry, existingFileStats.size, true, API_CONSTANTS.XBIN_FILE);
				}
			}
			
			let stats; try {stats = await uploadfile.getFileStats(entryPath);} catch (err) {
				LOG.error(`Error reading file entry ${fullpath}/${entry}. Skipping from listing. Error is ${err}`); continue; }
			stats.xbintype == API_CONSTANTS.XBIN_FILE?stats.file=true:null; 
			stats.xbintype == API_CONSTANTS.XBIN_FOLDER?stats.directory=true:null; 

			retObj.entries.push({name: entry, path: `${jsonReq.path}/${entry}`, stats});
		}
		return retObj;
	} catch (err) {LOG.error(`Error reading path: ${fullpath}, error is: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path);

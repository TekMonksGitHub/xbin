/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const path = require("path");
const fspromises = require("fs").promises;
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got getfiles request for path: " + jsonReq.path);

	const fullpath = path.resolve(`${await cms.getCMSRoot(headers)}/${jsonReq.path}`);
	if (!await cms.isSecure(headers, fullpath)) {LOG.error(`Path security validation failure: ${jsonReq.path}`); return CONSTANTS.FALSE_RESULT;}

	try {
		let retObj = {entries:[], result: true};
		const entries = await fspromises.readdir(fullpath);
		for (const entry of entries) {
			if (entry.endsWith(API_CONSTANTS.XBIN_IGNORE_PATH_SUFFIX)) continue;	// ignore our own working files
			let stats; try {stats = await fspromises.stat(`${fullpath}/${entry}`);} catch (err) {
				LOG.error(`Error reading file entry ${fullpath}/${entry}. Skipping from listing.`); continue; }
			stats.isFile()?stats.file=true:null; stats.isDirectory()?stats.directory=true:null; stats.isBlockDevice()?stats.blockDevice=true:null;
			stats.isCharacterDevice()?stats.characterDevice=true:null; stats.isSymbolicLink()?stats.symbolicLink=true:null; stats.isFIFO()?stats.FIFO=true:null; 
			stats.isSocket()?stats.socket=true:null;

			retObj.entries.push({name: entry, path: `${jsonReq.path}/${entry}`, stats});
		}
		return retObj;
	} catch (err) {LOG.error(`Error reading path: ${fullpath}, error is: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path);

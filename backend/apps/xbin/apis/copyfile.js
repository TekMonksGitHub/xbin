/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const path = require("path");
const utils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);
const quotas = require(`${API_CONSTANTS.LIB_DIR}/quotas.js`);
const uploadfile = require(`${API_CONSTANTS.API_DIR}/uploadfile.js`);

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) { LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT; }
	
	LOG.debug(`Got copyfile request from: ${jsonReq.from}, to: ${jsonReq.to}`);

	const fromPath = path.resolve(`${await cms.getCMSRoot(headers)}/${jsonReq.from}`); 
	const toPath = path.resolve(`${await cms.getCMSRoot(headers)}/${jsonReq.to}`);

	const _logCopy = (message, level="info") => LOG[level](`${message} Copy from is ${fromPath} and to is ${toPath}.`)

	if (!await cms.isSecure(headers, fromPath)) {_logCopy("Path security validation failure in from.", "error"); return CONSTANTS.FALSE_RESULT;}
	if (!await cms.isSecure(headers, toPath)) {_logCopy("Path security validation failure in to.", "error"); return CONSTANTS.FALSE_RESULT;}
	if (fromPath == toPath) {	// sanity check
		_logCopy("Copy requested from and to the same file paths. Ignoring.", "warn"); return CONSTANTS.TRUE_RESULT; }
	if (_copyRequestedToItsOwnSubdirectory(fromPath, toPath)) {_logCopy("Can't copy a directory to inside itself.", "error"); return CONSTANTS.FALSE_RESULT;}

	try { 
		const stats = await uploadfile.getFileStats(fromPath); 
		if (!(await quotas.checkQuota(headers, stats.size)).result) {LOG.error("Quota is full write failed."); return;}
		
		await utils.copyFileOrFolder(fromPath, toPath, async (_from, to, relativePath) => {
			if (!uploadfile.isMetaDataFile(to)) return;
			const newRemotePath = uploadfile.normalizeRemotePath(jsonReq.to+"/"+relativePath), 
				copiedFile = uploadfile.getFileForMetaDataFile(to);
			await uploadfile.updateDiskFileMetadataRemotePaths(copiedFile, newRemotePath);
		}, true);
		uploadfile.copyDiskFileMetadata(fromPath, toPath, jsonReq.to);

		return CONSTANTS.TRUE_RESULT; 
	} catch (err) { 
		LOG.error(`Error copying from: ${fromPath}, to: ${toPath}, error is: ${err}`); 
		return CONSTANTS.FALSE_RESULT; 
	}
}

function _copyRequestedToItsOwnSubdirectory(from, to) {
	to = path.resolve(to).replace(/\\/g,"/").toLowerCase(); from = path.resolve(from).replace(/\\/g,"/").toLowerCase(); 
	if (to==from) return true;	// a directory is its own subdirectory
	const pathSplits = to.split("/"); for (const [i, _val] of pathSplits.entries()) {
		const test = pathSplits.slice(0, i).join("/");
		if (test==from) return true;
	}
	return false;
}

const validateRequest = jsonReq => (jsonReq && jsonReq.from && jsonReq.to);
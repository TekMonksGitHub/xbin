/**
 * Renames the given file. 
 * (C) 2020 TekMonks. All rights reserved.
 */
const path = require("path");
const fspromises = require("fs").promises;
const utils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const cms = require(`${XBIN_CONSTANTS.LIB_DIR}/cms.js`);
const blackboard = require(`${CONSTANTS.LIBDIR}/blackboard.js`);
const db = require(`${XBIN_CONSTANTS.LIB_DIR}/xbindb.js`).getDB();
const getfiles = require(`${XBIN_CONSTANTS.API_DIR}/getfiles.js`);
const uploadfile = require(`${XBIN_CONSTANTS.API_DIR}/uploadfile.js`);

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	const headersOrLoginIDAndOrg = jsonReq.id && jsonReq.org ? 
		{xbin_id: jsonReq.id, xbin_org: jsonReq.org, headers} : headers;
	return exports.renameFile(headersOrLoginIDAndOrg, jsonReq.old, jsonReq.new, jsonReq.extraInfo);
}

exports.renameFile = async function(headersOrIDAndOrg, cmsOldPath, cmsNewPath, extraInfo, noevent) {
	LOG.debug("Got renamefile request for path: " + cmsOldPath);

	const oldPath = await cms.getFullPath(headersOrIDAndOrg, cmsOldPath, extraInfo), 
		newPath = await cms.getFullPath(headersOrIDAndOrg, cmsNewPath, extraInfo);
	if (!await cms.isSecure(headersOrIDAndOrg, oldPath, extraInfo)) {LOG.error(`Path security validation failure: ${oldPath}`); return CONSTANTS.FALSE_RESULT;}
	if (!await cms.isSecure(headersOrIDAndOrg, newPath, extraInfo)) {LOG.error(`Path security validation failure: ${newPath}`); return CONSTANTS.FALSE_RESULT;}
	if (oldPath == newPath) {	// sanity check
		LOG.warn(`Rename requested from and to the same file paths. Ignoring. From is ${oldPath} and to is the same.`);
		return CONSTANTS.TRUE_RESULT;
	}

	const _renameFileInternal = async (oldpath, newpath, cmsRelativePathNew) => {
		await fspromises.rename(oldpath, newpath);
		await uploadfile.renameDiskFileMetadata(oldpath, newpath, cmsRelativePathNew);
		await db.runCmd("UPDATE shares SET fullpath = ? WHERE fullpath = ?", [newpath, oldpath]);	// update shares
	}

	const ip = utils.getLocalIPs()[0], id = headersOrIDAndOrg.xbin_id||cms.getID(headersOrIDAndOrg), 
		org = headersOrIDAndOrg.xbin_org||cms.getOrg(headersOrIDAndOrg)

	try {
		await _renameFileInternal(oldPath, newPath, cmsNewPath);
		const newStats = await uploadfile.getFileStats(newPath); 
		if (newStats.xbintype == XBIN_CONSTANTS.XBIN_FOLDER) {	// for folders we must update metadata remotepaths
			await utils.walkFolder(newPath, async (fullpath, _stats, relativePath) => {
				if (getfiles.ignoreFile(fullpath)) return;
				const remotePathNew = cmsNewPath+"/"+relativePath, oldfullpath = path.resolve(oldPath+"/"+relativePath);
				await uploadfile.updateDiskFileMetadataRemotePaths(fullpath, remotePathNew);
				if (!noevent) _broadcastFileRenamed(oldfullpath, fullpath, 
					cms.getCMSRootRelativePath(headersOrIDAndOrg, oldfullpath, extraInfo), 
					cms.getCMSRootRelativePath(headersOrIDAndOrg, fullpath, extraInfo), ip, id, org, extraInfo);
				await db.runCmd("UPDATE shares SET fullpath = ? WHERE fullpath = ?", [fullpath, oldfullpath]);	// update shares
			}, true);
		} else if (!noevent) _broadcastFileRenamed(oldPath, newPath, cmsOldPath, cmsNewPath, ip, id, org, extraInfo);

        return CONSTANTS.TRUE_RESULT;
	} catch (err) {LOG.error(`Error renaming  path: ${oldPath}, error is: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

const _broadcastFileRenamed = (from, to, fromCMSPath, toCMSPath, ip, id, org, extraInfo) => 
	blackboard.publish(XBIN_CONSTANTS.XBINEVENT, {type: XBIN_CONSTANTS.EVENTS.FILE_RENAMED, from, to, ip, id, org, 
		fromCMSPath, toCMSPath, isxbin: true, extraInfo});

const validateRequest = jsonReq => (jsonReq && jsonReq.old && jsonReq.new);

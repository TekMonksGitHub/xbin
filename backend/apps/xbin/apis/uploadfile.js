/**
 * Handles upload requests. 
 * (C) 2020 TekMonks. All rights reserved.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const fspromises = fs.promises;
const stream = require("stream");
const cyrptomod = require("crypto");
const utils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const crypt = require(`${CONSTANTS.LIBDIR}/crypt.js`);
const cms = require(`${XBIN_CONSTANTS.LIB_DIR}/cms.js`);
const quotas = require(`${XBIN_CONSTANTS.LIB_DIR}/quotas.js`);
const blackboard = require(`${CONSTANTS.LIBDIR}/blackboard.js`);
const getfiles = require(`${XBIN_CONSTANTS.API_DIR}/getfiles.js`);
const addablereadstream = require(`${XBIN_CONSTANTS.LIB_DIR}/addablereadstream.js`)
const ADDABLE_STREAM_TIMEOUT = XBIN_CONSTANTS.CONF.UPLOAD_STREAM_MAX_WAIT||120000;	// 2 minutes to receive new data else we timeout

const UTF8CONTENTTYPE_MATCHER = /^\s*?text.*?;\s*charset\s*=\s*utf-?8\s*$/;
const _existing_streams = [];	// holds existing streams for files under upload progress

exports.doService = async (jsonReq, _servObject, headers, _url) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got uploadfile request for path: " + jsonReq.path);
	const headersOrLoginIDAndOrg = jsonReq.id && jsonReq.org ? 
		{xbin_id: jsonReq.id, xbin_org: jsonReq.org, headers} : headers;
	const fullpath = await cms.getFullPath(headersOrLoginIDAndOrg, jsonReq.path, jsonReq.extraInfo),
		transferID = jsonReq.transfer_id || _md5Hash(`${fullpath}.${Date.now()}`);
	if (!await cms.isSecure(headersOrLoginIDAndOrg, fullpath, jsonReq.extraInfo)) {LOG.error(`Path security validation failure: ${jsonReq.path}`); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug(`Resolved full path for upload file: ${fullpath}. Transfer ID is ${transferID}`);

	try {
		const pureUTF8TextDataType = jsonReq.content_type?.toLowerCase().match(UTF8CONTENTTYPE_MATCHER) != null;	// matches "text/[whatever]; charset=utf-8"
        let bufferToWrite; if (!pureUTF8TextDataType) {	// if not pure UTF8 text then must be BASE64 encoded
			const matches = jsonReq.data.match(/^data:.*;base64,(.*)$/); 
			if (!matches) {
				LOG.error(`Bad encoding for ${fullpath}. First 100 bytes of data are ${data && data.substring?data.substring(0, 100<data.length?100:data.length):"null"}.`);
				return {...CONSTANTS.TRUE_RESULT, transfer_id, error: "Unsupported data encoding."};
			}
			bufferToWrite = Buffer.from(matches[1], "base64");
		} else bufferToWrite = Buffer.from(jsonReq.data, "utf8");
		if (!(await quotas.checkQuota(headersOrLoginIDAndOrg, jsonReq.extraInfo, bufferToWrite.length)).result) 
			{LOG.error(`Quota is full write failed for path ${fullpath}.`); return {...CONSTANTS.TRUE_RESULT, error: "Quota is full."};}
        
		await exports.writeChunk(headersOrLoginIDAndOrg, transferID, fullpath, bufferToWrite, 
			jsonReq.startOfFile, jsonReq.endOfFile, jsonReq.comment, jsonReq.extraInfo);

		return {...CONSTANTS.TRUE_RESULT, transfer_id: transferID};
	} catch (err) {
		LOG.error(`Error writing to path: ${fullpath}, error is: ${err}, stack is ${err.stack}`); 
		try {await fspromises.unlink(fullpath); await exports.deleteDiskFileMetadata(fullpath)} catch(err) {};
		return {...CONSTANTS.FALSE_RESULT, transfer_id: transferID, error: "Error writing."};
	}
}

exports.uploadFile = async function(xbin_id, xbin_org, readstreamOrContents, cmsPath, comment, extraInfo, noevent) {
	LOG.debug("Got uploadfile request for cms path: " + cmsPath + " for ID: " + xbin_id + " and org: " + xbin_org);

	const transferID = Date.now(), fullpath = await cms.getFullPath({xbin_id, xbin_org}, cmsPath, extraInfo);
	if (!await cms.isSecure({xbin_id, xbin_org}, fullpath, extraInfo)) {LOG.error(`Path security validation failure: ${fullpath}`); return CONSTANTS.FALSE_RESULT;}
	const cmsHostingFolder = await cms.getCMSRootRelativePath({xbin_id, xbin_org}, path.dirname(fullpath), extraInfo); 
	try { await exports.createFolder({xbin_id, xbin_org}, cmsHostingFolder, extraInfo); }	// create the hosting folder if needed.
	catch (err) {LOG.error(`Error uploading file ${fullpath}, parent folder creation failed. Error is ${err}`); return CONSTANTS.FALSE_RESULT;}

	if (Buffer.isBuffer(readstreamOrContents)) {
		if (await utils.promiseExceptionToBoolean(exports.writeChunk({xbin_id, xbin_org}, transferID, 
			fullpath, readstreamOrContents, true, true, comment, extraInfo, noevent))) 
		return CONSTANTS.TRUE_RESULT; else return CONSTANTS.FALSE_RESULT;
	} else if (readstreamOrContents instanceof stream.Readable) return new Promise(resolve => {
		let startOfFile = true, ignoreEvents = false;
		readstreamOrContents.on("data", async chunk => {
			if (ignoreEvents) return;	// failed already
			if (!(await utils.promiseExceptionToBoolean(exports.writeChunk({xbin_id, xbin_org}, transferID, 
				fullpath, chunk, startOfFile, false, comment, extraInfo, noevent)))) { resolve(CONSTANTS.FALSE_RESULT); ignoreEvents = true }; 
			startOfFile = false; 
		});
		readstreamOrContents.on("end", async _ => {
			if (ignoreEvents) return;	// failed already
			if (await utils.promiseExceptionToBoolean(exports.writeChunk({xbin_id, xbin_org}, transferID, fullpath, 
				Buffer.from([]), false, true, comment, extraInfo, noevent))) resolve(CONSTANTS.TRUE_RESULT); else resolve(CONSTANTS.FALSE_RESULT);
		});
	}); else return CONSTANTS.FALSE_RESULT;	// neither a buffer, nor a stream - we can't deal with it
}

exports.writeChunk = async function(headersOrLoginIDAndOrg, transferid, fullpath, chunk, startOfFile, 
		endOfFile, comment, extraInfo, noevent) {
	const temppath = path.resolve(`${fullpath}.${transferid}${XBIN_CONSTANTS.XBIN_TEMP_FILE_SUFFIX}`);
	const cmspath = await cms.getCMSRootRelativePath(headersOrLoginIDAndOrg, fullpath, extraInfo);

	if (startOfFile) {	// delete the old files if they exist
		try {await fspromises.access(fullpath); await fspromises.unlink(fullpath);} catch (err) {};
		try {await exports.deleteDiskFileMetadata(fullpath);} catch (err) {};
	} 

	if (chunk.length > 0) await _appendOrWrite(temppath, chunk, startOfFile, endOfFile, exports.isZippable(fullpath));
	else await fspromises.appendFile(temppath, chunk);
	LOG.debug(`Added new ${chunk.length} bytes to the file at eventual path ${fullpath} using temp path ${temppath}.`);
	if (endOfFile) {
		try {await fspromises.rename(temppath, fullpath)} catch (err) {
			LOG.error(`Renaming ${temppath} -> ${fullpath} failed. Retrying one more time with a 100ms wait.`);
			const waitAndRetryRenamer = _ => new Promise((resolve, reject) => setTimeout(async _=>{
				try{await fspromises.rename(temppath, fullpath); resolve();} catch (err) {reject(err)}}, 100));
			await waitAndRetryRenamer();
		}
		LOG.info(`Finished uploading file ${fullpath} successfully.`);
		if (!noevent) blackboard.publish(XBIN_CONSTANTS.XBINEVENT, {type: XBIN_CONSTANTS.EVENTS.FILE_CREATED, 
			path: fullpath, cmspath, ip: utils.getLocalIPs()[0], id: cms.getID(headersOrLoginIDAndOrg), 
			org: cms.getOrg(headersOrLoginIDAndOrg), isxbin: true, extraInfo});
	}

	await exports.updateFileStats(fullpath, cmspath, chunk.length, endOfFile, XBIN_CONSTANTS.XBIN_FILE, comment, extraInfo);

	return true;
}

exports.writeUTF8File = async function (headersOrLoginIDAndOrg, inpath, data, extraInfo, noevent) {
	const fullpath = await cms.getFullPath(headersOrLoginIDAndOrg, inpath, extraInfo);
	if (!await cms.isSecure(headersOrLoginIDAndOrg, fullpath, extraInfo)) throw `Path security validation failure: ${fullpath}`;

	const cmsHostingFolder = await cms.getCMSRootRelativePath(headersOrLoginIDAndOrg, path.dirname(fullpath), extraInfo); 
	try { await exports.createFolder(headersOrLoginIDAndOrg, cmsHostingFolder, extraInfo); }	// create the hosting folder if needed.
	catch (err) {LOG.error(`Error uploading file ${fullpath}, parent folder creation failed. Error is ${err}`); return CONSTANTS.FALSE_RESULT;}

	let additionalBytesToWrite = data.length; 
	try {additionalBytesToWrite = data.length - (await exports.getFileStats(fullpath)).size;} catch (err) {};	// file may not exist at all
	if (!(await quotas.checkQuota(headersOrLoginIDAndOrg, extraInfo, additionalBytesToWrite)).result) 
		throw `Quota is full write failed for ${fullpath}`;

	if (data.length) await _appendOrWrite(fullpath, data, true, true, exports.isZippable(fullpath));
	else await fspromises.appendFile(fullpath, data);

	exports.updateFileStats(fullpath, inpath, data.length, true, XBIN_CONSTANTS.XBIN_FILE, undefined, extraInfo);	

	if (!noevent) blackboard.publish(XBIN_CONSTANTS.XBINEVENT, {type: XBIN_CONSTANTS.EVENTS.FILE_CREATED, path: fullpath, 
		ip: utils.getLocalIPs()[0], id: cms.getID(headersOrLoginIDAndOrg), org: cms.getOrg(headersOrLoginIDAndOrg), 
		isxbin: true, extraInfo});
}

exports.updateFileStats = async function (fullpathOrRequestHeaders, remotepath, dataLengthWritten, transferFinished, 
		type, commentin, extraInfo) {

	const fullpath = typeof fullpathOrRequestHeaders !== 'string' ? 
		(await _getSecureFullPath(fullpathOrRequestHeaders, remotepath, extraInfo)) : fullpathOrRequestHeaders;
	const metaPath = fullpath+XBIN_CONSTANTS.STATS_EXTENSION, clusterMemory = CLUSTER_MEMORY.get(XBIN_CONSTANTS.MEM_KEY_UPLOADFILE, {});
	const isWriteOpToAUploadAndNotFinished = dataLengthWritten && (!transferFinished);

	if (!clusterMemory.files_stats) clusterMemory.files_stats = {};
	if (!clusterMemory.	files_stats[fullpath]) {
		if (!isWriteOpToAUploadAndNotFinished) {
			try {
				await fspromises.access(metaPath, fs.constants.W_OK & fs.constants.R_OK);
				clusterMemory.files_stats[fullpath] = JSON.parse(await fspromises.readFile(metaPath, "utf8")); 
			} catch (err) {
				let stats; try {stats = await fspromises.stat(fullpath);} catch (err) {stats = {}};
				clusterMemory.files_stats[fullpath] = { ...stats, remotepath: exports.normalizeRemotePath(remotepath), size: 0, 
					byteswritten: 0, xbintype: type||(stats.isFile()?XBIN_CONSTANTS.XBIN_FILE:(stats.isDirectory()?XBIN_CONSTANTS.XBIN_FOLDER:"UNKNOWN")), 
					comment: commentin||"", disk_size: stats.size }; 
			} 
		} else clusterMemory.files_stats[fullpath] = { remotepath: exports.normalizeRemotePath(remotepath), size: 0, byteswritten: 0, 
			xbintype: type||(stats.isFile()?XBIN_CONSTANTS.XBIN_FILE:(stats.isDirectory()?XBIN_CONSTANTS.XBIN_FOLDER:"UNKNOWN")), 
			comment: commentin||"" }; 
	}
	
	if (dataLengthWritten !== undefined) {
		clusterMemory.files_stats[fullpath].byteswritten += dataLengthWritten; 
		clusterMemory.files_stats[fullpath].size = clusterMemory.files_stats[fullpath].byteswritten;
	}
	if (commentin) clusterMemory.files_stats[fullpath].comment = commentin;

	if (transferFinished) {
		if (!clusterMemory.files_stats[fullpath].birthtimeMs) {	// refresh stats if empty
			const stats = await fspromises.stat(fullpath), oldstats = clusterMemory.files_stats[fullpath];
			clusterMemory.files_stats[fullpath] = {...stats, ...oldstats, disk_size: stats.size};	
		}
		await fspromises.writeFile(metaPath, JSON.stringify(clusterMemory.files_stats[fullpath]));
		if (dataLengthWritten) clusterMemory.files_stats[fullpath].byteswritten = 0; 	// we updated due to a write and have finished uploading
	}

	CLUSTER_MEMORY.set(XBIN_CONSTANTS.MEM_KEY_UPLOADFILE, clusterMemory);
}

exports.getFileStats = async (fullpath, genStats, remotePath, extraInfo) => {	// cache and return to avoid repeated reads
	const clusterMemory = CLUSTER_MEMORY.get(XBIN_CONSTANTS.MEM_KEY_UPLOADFILE, {});
	if (!clusterMemory.files_stats) clusterMemory.files_stats = {};
	if (!clusterMemory.files_stats[fullpath]) {
		if (genStats && (!await utils.exists(fullpath+XBIN_CONSTANTS.STATS_EXTENSION))) 
			await exports.updateFileStats(fullpath, remotePath, undefined, true, undefined, undefined, extraInfo);
		const diskStats = await fspromises.lstat(fullpath);
		clusterMemory.files_stats[fullpath] = diskStats.isFile() ?
			JSON.parse(await fspromises.readFile(fullpath+XBIN_CONSTANTS.STATS_EXTENSION, "utf8")) : 
			{...diskStats, xbintype: diskStats.isDirectory()?XBIN_CONSTANTS.XBIN_FOLDER:"UNKNOWN", comment: "",
				size: diskStats.isDirectory()?await exports.getFolderSize(fullpath):diskStats.size};
	}
	return {...clusterMemory.files_stats[fullpath]};
}

exports.getFolderSize = async fullpath => {
	let size = 0; 
	await utils.walkFolder(fullpath, async (fullEntryPath, stats) => { if (stats.isFile()) 
		try { if (!getfiles.ignoreFile(fullEntryPath)) size += (await exports.getFileStats(fullEntryPath)).size; } 
		catch (err) {LOG.warn(`Can't find correct metadata for path ${fullpath} during uploadfile.getFolderSize().`) }
	}, true);
	return size;
}

exports.createFolder = async function(headersOrLoginIDAndOrg, cmsRelativePathIn, extraInfo) {
	const cmsRelativePathUnix = utils.convertToUnixPathEndings(cmsRelativePathIn), 
		checkFullPath = await cms.getFullPath(headersOrLoginIDAndOrg, cmsRelativePathUnix, extraInfo);
	if (!await cms.isSecure(headersOrLoginIDAndOrg, checkFullPath, extraInfo)) throw (`Path security validation failure: ${cmsRelativePathUnix}`);

	let cmsPathSoFar = ""; for (const thisPathSegment of cmsRelativePathUnix.split("/")) {
		cmsPathSoFar += `/${thisPathSegment}`;
		const fullpath = await cms.getFullPath(headersOrLoginIDAndOrg, cmsPathSoFar, extraInfo);
		if (!(await utils.exists(fullpath))) {
			try {
				await fs.promises.mkdir(fullpath);
				await exports.updateFileStats(fullpath, cmsPathSoFar, undefined, true, XBIN_CONSTANTS.XBIN_FOLDER, 
					undefined, extraInfo);
			} catch (err) {if (err.code != "EEXIST") throw err;}	 // ignore as timing syncs can cause this eg if 2 files get uploaded to same path then async wait in checking may return false, but at the same time another request may have created the folder
		 }
	}
}

exports.isZippable = fullpath => {const conf = cms.getRepositoryConfig(fullpath); 
	return conf.DISK_COMPRESSED && (!((conf.DONT_GZIP_EXTENSIONS||[]).includes(path.extname(fullpath))));}

exports.isEncryptable = fullpath => cms.getRepositoryConfig(fullpath).DISK_SECURED;

exports.deleteDiskFileMetadata = async function(fullpath) {
	await fspromises.unlink(fullpath+XBIN_CONSTANTS.STATS_EXTENSION);
	const clusterMemory = CLUSTER_MEMORY.get(XBIN_CONSTANTS.MEM_KEY_UPLOADFILE, {});
	if (clusterMemory && clusterMemory.files_stats && clusterMemory.files_stats[fullpath]) {
		delete clusterMemory.files_stats[fullpath];
		CLUSTER_MEMORY.set(XBIN_CONSTANTS.MEM_KEY_UPLOADFILE, clusterMemory);
	}
}

exports.isMetaDataFile = path => path.endsWith(XBIN_CONSTANTS.STATS_EXTENSION);

exports.getFileForMetaDataFile = path => {
	if (exports.isMetaDataFile(path)) return path.substring(0, path.length-XBIN_CONSTANTS.STATS_EXTENSION.length);
	else return null;
}

exports.renameDiskFileMetadata = async function (oldpath, newpath, newRemotePath) {
	await exports.copyDiskFileMetadata(oldpath, newpath, newRemotePath);
	if (path.resolve(oldpath) != path.resolve(newpath)) {
		await fspromises.unlink(oldpath+XBIN_CONSTANTS.STATS_EXTENSION);
		const clusterMemory = CLUSTER_MEMORY.get(XBIN_CONSTANTS.MEM_KEY_UPLOADFILE, {});
		if (clusterMemory && clusterMemory.files_stats && clusterMemory.files_stats[oldpath]) delete clusterMemory.files_stats[oldpath];
	}
}

exports.updateDiskFileMetadataRemotePaths = async function (path, newRemotePath) {
	const clusterMemory = CLUSTER_MEMORY.get(XBIN_CONSTANTS.MEM_KEY_UPLOADFILE, {});
	const statsNew = clusterMemory.files_stats?.[path]||await exports.getFileStats(path); 
	statsNew.remotepath = exports.normalizeRemotePath(newRemotePath);
	await fspromises.writeFile(path+XBIN_CONSTANTS.STATS_EXTENSION, JSON.stringify(statsNew), "utf8");
	if (clusterMemory && clusterMemory.files_stats) {
		clusterMemory.files_stats[path] == {...statsNew};
		CLUSTER_MEMORY.set(XBIN_CONSTANTS.MEM_KEY_UPLOADFILE, clusterMemory);
	}
}

exports.copyDiskFileMetadata = async function (oldpath, newpath, newRemotePath) {
	const clusterMemory = CLUSTER_MEMORY.get(XBIN_CONSTANTS.MEM_KEY_UPLOADFILE, {});
	const statsNew = clusterMemory.files_stats?.[oldpath]||await exports.getFileStats(oldpath); 
	statsNew.remotepath = exports.normalizeRemotePath(newRemotePath);
	await fspromises.writeFile(newpath+XBIN_CONSTANTS.STATS_EXTENSION, JSON.stringify(statsNew), "utf8");
	if (clusterMemory && clusterMemory.files_stats) {
		clusterMemory.files_stats[newpath] == {...statsNew};
		CLUSTER_MEMORY.set(XBIN_CONSTANTS.MEM_KEY_UPLOADFILE, clusterMemory);
	}
}

exports.isFileConsistentOnDisk = async fullpath => {
	try {
		await fspromises.access(fullpath, fs.constants.R_OK);
		await fspromises.access(fullpath+XBIN_CONSTANTS.STATS_EXTENSION, fs.constants.R_OK);
		return true;
	} catch (err) {return false;}
}

exports.normalizeRemotePath = pathIn => pathIn.replace(/\\+/g, "/").replace(/\/+/g, "/");

exports.getFullPath = cms.getFullPath;

async function _getSecureFullPath(headers, inpath, extraInfo) {
	const fullpath = await cms.getFullPath(headers, inpath, extraInfo);
	if (!await cms.isSecure(headers, fullpath, extraInfo)) {LOG.error(`Path security validation failure: ${inpath}`); throw `Path security validation failure: ${inpath}`;}
	return fullpath;
}

function _appendOrWrite(inpath, buffer, startOfFile, endOfFile, isZippable) {
	const _createStreams = (path, reject, resolve) => {
		if (_existing_streams[path]) _deleteStreams(path);	// delete old streams if open

		_existing_streams[path] = { addablestream: addablereadstream.getAddableReadstream(ADDABLE_STREAM_TIMEOUT), 
			reject, resolve }; 
		LOG.debug(`Created readable stream with ID ${_existing_streams[path].addablestream.getID()} for path ${path}.`);
		let readableStream = _existing_streams[path].addablestream;
		if (isZippable) readableStream = readableStream.pipe(zlib.createGzip());	// gzip to save disk space and download bandwidth for downloads
		if (exports.isEncryptable(path)) readableStream = readableStream.pipe(crypt.getCipher(XBIN_CONSTANTS.CONF.SECURED_KEY));
		_existing_streams[path].writestream = fs.createWriteStream(path, {"flags":"w"}); 
		_existing_streams[path].writestream.__org_xbin_writestream_id = Date.now();
		_existing_streams[path].closeWriteStream = true;
		readableStream.pipe(_existing_streams[path].writestream); 
		_existing_streams[path].writestream.on("finish", _=>{	// deleteStreams if the finish itself is not emitted by _deleteStreams
			if (_existing_streams[path].writestream.__org_xbin_writestream_id != 
					_existing_streams[path].ignoreWriteStreamFinishForID) {
				LOG.warn(`Finish write not issued by deleteStreams, deleted the streams as well. Path is ${path}, addablestream ID is ${_existing_streams[path].addablestream.getID()}.`);
				_existing_streams[path].closeWriteStream = false; _deleteStreams(path);
			} else LOG.info(`Finish write issued by deleteStreams, path is ${path}, addablestream ID is ${_existing_streams[path].addablestream.getID()}.`);
		}); 
		_existing_streams[path].writestream.on("error", error => { 
			LOG.error(`Error in the write stream for path ${path}, error is ${error}, addablestream ID is ${_existing_streams[path].addablestream.getID()}.`);
			_existing_streams[path].reject(error); _deleteStreams(path) 
		});
		_existing_streams[path].addablestream.on("read_drained", _ => {
			if (_existing_streams[path]) {
				_existing_streams[path].resolve();
				LOG.debug(`Resolved writing for path ${path} with buffer size of ${buffer.length} bytes for stream with ID ${_existing_streams[path].addablestream.getID()}.`);
			} else LOG.warn(`Drained issued for an addablestream which doesn't exist anymore. The path is ${path}.`);
		});
	}

	const _deleteStreams = path => {
		if (!_existing_streams[path]) return;
		LOG.info(`Deleteting streams for path ${path}. Addable stream ID is ${(_existing_streams[path].addablestream?.getID())||"unknown"}`);
		if (_existing_streams[path].addablereadstream) _existing_streams[path].addablestream.end(); 
		if (_existing_streams[path].closeWriteStream) try {
			_existing_streams[path].ignoreWriteStreamFinishForID = _existing_streams[path].writestream.__org_xbin_writestream_id;
			_existing_streams[path].writestream.close(); 
		} catch (err) {LOG.warn(`Error closing write stream with for path ${path}, error is ${err}. Addable stream ID is ${(_existing_streams[path].addablestream?.getID())||"unknown"}`);}
		delete _existing_streams[path];
	}

	return new Promise((resolve, reject) => {
		if (startOfFile) _createStreams(inpath, resolve, reject);

		if (!_existing_streams[inpath]) {reject("Error: Missing stream for file "+inpath); return;}

		_existing_streams[inpath].resolve = resolve; _existing_streams[inpath].reject = reject;	// update these so events calls the right ones
		_existing_streams[inpath].addablestream.addData(buffer); 
		LOG.debug(`Added data for path ${inpath} with buffer size of ${buffer.length} bytes for stream with ID ${_existing_streams[inpath].addablestream.getID()}, total bytes added are ${_existing_streams[inpath].addablestream.length}.`);
		if (endOfFile) _existing_streams[inpath].addablestream.end(); 
	});
}

const _md5Hash = text => cyrptomod.createHash("md5").update(text).digest("hex");

const validateRequest = jsonReq => (jsonReq && jsonReq.path && jsonReq.data && 
	(jsonReq.startOfFile !== undefined) && (jsonReq.endOfFile  !== undefined) && (jsonReq.startOfFile || jsonReq.transfer_id));
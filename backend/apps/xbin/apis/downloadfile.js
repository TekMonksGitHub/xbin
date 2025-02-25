/**
 * Handles download file requests - this is a binary API. 
 * (C) 2020 TekMonks. All rights reserved.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const fspromises = fs.promises;
const stream = require("stream");
const archiver = require("archiver");
const crypt = require(`${CONSTANTS.LIBDIR}/crypt.js`);
const utils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const cms = require(`${XBIN_CONSTANTS.LIB_DIR}/cms.js`);
const getfiles = require(`${XBIN_CONSTANTS.API_DIR}/getfiles.js`);
const securid = require(`${XBIN_CONSTANTS.API_DIR}/getsecurid.js`);
const uploadfile = require(`${XBIN_CONSTANTS.API_DIR}/uploadfile.js`);

const DEFAULT_READ_BUFFER_SIZE = 10485760;

exports.handleRawRequest = async function(jsonReq, servObject, headers, url) {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); _sendError(servObject); return;}
	if (!securid.check(jsonReq.securid)) {LOG.error("SecurID validation failure."); _sendError(servObject, true); return;}

	const headersMod = {...headers, "authorization": `Bearer ${jsonReq.auth}`};
	jsonReq.fullpath = await cms.getFullPath(headersMod, jsonReq.path, jsonReq.extraInfo);
	if (!await cms.isSecure(headersMod, jsonReq.fullpath, jsonReq.extraInfo)) {LOG.error(`Path security validation failure: ${jsonReq.path}`); _sendError(servObject); return;}

	await this.downloadFile(jsonReq, servObject, headers, url);
}

exports.downloadFile = async (fileReq, servObject, headers, url) => {
	LOG.debug(`Got downloadfile request for path ${fileReq.fullpath}, starting download, reqid is ${fileReq.reqid}.`);

	const _handleDownloadError = err => { 
		LOG.error(`Error sending download file for path ${fileReq.fullpath} due to ${err} reqid is ${fileReq.reqid}.`); 
		_updateWriteStatus(fileReq.reqid, undefined, 0, true); 
	}
	try {
		let fullpath = fileReq.fullpath, stats = await uploadfile.getFileStats(fullpath), isFolder = false;
		if (stats.xbintype == XBIN_CONSTANTS.XBIN_FOLDER) { isFolder = true; fullpath = await _zipDirectory(fullpath); 
			stats = await fspromises.stat(fullpath); }

		let respHeaders = {}; APIREGISTRY.injectResponseHeaders(url, {}, headers, respHeaders, servObject);
		const filename = encodeURIComponent(path.basename(isFolder?`${fileReq.fullpath}.zip`:fullpath));
		respHeaders["content-disposition"] = `attachment;filename=${filename}`;
		respHeaders["content-length"] = stats.size;   
		respHeaders["content-type"] = "application/octet-stream";
		servObject.server.statusOK(respHeaders, servObject, true);

		_updateWriteStatus(decodeURIComponent(fileReq.reqid), stats.size, null);
		const readStream = exports.getReadStream(fullpath, isFolder);
        const writable = readStream.pipe(servObject.res, {end:true});
		readStream.on("data",chunk =>{
			_updateWriteStatus(fileReq.reqid, undefined, chunk.length)
		});
		writable.on("close", _=>{
			LOG.debug(`Finished sending download file for path ${fileReq.fullpath} successfully, reqid is ${fileReq.reqid}.`);
			if (isFolder) fspromises.unlink(fullpath);	// delete temporarily created ZIP files
			_updateWriteStatus(fileReq.reqid, undefined, undefined, false, true);
		});
		writable.on("error", error => _handleDownloadError(error));
	} catch (err) { _handleDownloadError(err); _sendError(servObject); }
}

exports.readUTF8File = async function (headers, inpath, extraInfo) {
	const fullpath = await cms.getFullPath(headers, inpath, extraInfo);
	const readstream = exports.getReadStream(fullpath);
    return new Promise((resolve, reject) => {
        const contents = [];
        readstream.on("data", chunk => contents.push(chunk));
        readstream.on("close", _ => {
			const utfContents = Buffer.concat(contents).toString("utf8"); 
			resolve(utfContents);
		});
        readstream.on("error", err => reject(err));
    });
}

exports.getReadStream = function(fullpath, pathIsATemporarilyZippedFolderForDownloading) {
	const zippable = pathIsATemporarilyZippedFolderForDownloading?false:uploadfile.isZippable(fullpath);
	const encrypted = uploadfile.isEncryptable(fullpath) && (!pathIsATemporarilyZippedFolderForDownloading);
	let readStream = fs.createReadStream(fullpath, {
		highWaterMark: XBIN_CONSTANTS.CONF.DOWNLOAD_READ_BUFFER_SIZE||DEFAULT_READ_BUFFER_SIZE, 
		flags:"r", autoClose:true});
	if (encrypted) readStream = readStream.pipe(crypt.getDecipher(XBIN_CONSTANTS.CONF.SECURED_KEY)); // decrypt the file before sending if it is encrypted
	if (zippable) readStream = readStream.pipe(zlib.createGunzip());	// gunzip if zipped
	return readStream;
}

function _sendError(servObject, unauthorized) {
	if (!servObject.res.writableEnded) {
		if (unauthorized) servObject.server.statusUnauthorized(servObject); 
		else servObject.server.statusInternalError(servObject); 
		servObject.server.end(servObject);
	}
}

async function _zipDirectory(pathIn) {	// unencrypt, ungzip etc before packing to send
    return new Promise(async (resolve, reject) => {
        const tempFilePath = utils.getTempFile("zip"); const out = fs.createWriteStream(tempFilePath);
        const archive = archiver("zip", { zlib: { level: 9 }}); 
        out.on("close", _=>resolve(tempFilePath)); out.on("error", err=>reject(err)); archive.pipe(out);
		
		archive.on("error", err=>reject(err)); archive.on("warning", err => {if (err.code=="ENOENT") LOG.warn(`ZIP warning for ${pathIn} at temp file ${tempFilePath}, warning is ${err}`); else reject(err);});
		archive.on("progress", event => LOG.info(`ZIP progress of ${pathIn} at temp file ${tempFilePath}, the entries written are ${event.entries.total} and entries processed are ${event.entries.processed} and the bytes written are ${event.fs.totalBytes} and processed are ${event.fs.processed}.`));
		
		try {
			await utils.walkFolder(pathIn, (fullPath, stats, relativePath) =>  {
				if (stats.isDirectory()) {archive.append(null, {name: relativePath+"/"}); return;}
				if ((!stats.isFile()) || getfiles.ignoreFile(fullPath)) return;	// nothing to do, only real files beyond this
				
				const zippable = uploadfile.isZippable(fullPath); 
				let readstreamEntry = fs.createReadStream(fullPath); 
				if (uploadfile.isEncryptable(fullpath)) readstreamEntry = readstreamEntry.pipe(crypt.getDecipher(XBIN_CONSTANTS.CONF.SECURED_KEY));
				if (zippable) readstreamEntry = readstreamEntry.pipe(zlib.createGunzip());	
				archive.append(readstreamEntry, {name: relativePath});
			}, false, _=>archive.finalize());
		} catch (err) {reject(err);}
    });
}

async function _updateWriteStatus(reqid, fileSize=0, bytesWrittenThisChunk, transferFailed, transferFinishedSuccessfully) {
	const statusStorage = CLUSTER_MEMORY.get(XBIN_CONSTANTS.MEM_KEY_WRITE_STATUS, {});
	if (!(statusStorage[reqid])) statusStorage[reqid] = {size: fileSize, bytesSent: 0, failed: false, finishedSuccessfully: false};
	
	if (bytesWrittenThisChunk) statusStorage[reqid].bytesSent += bytesWrittenThisChunk;
	if (transferFailed) statusStorage[reqid].failed = true; if (transferFinishedSuccessfully) statusStorage[reqid].finishedSuccessfully = true;
	await CLUSTER_MEMORY.set(XBIN_CONSTANTS.MEM_KEY_WRITE_STATUS, statusStorage, true);
	if (!transferFailed) LOG.debug(`Update status for reqid ${reqid} - file size is ${fileSize} bytes, bytes written so far = ${statusStorage[reqid].bytesSent} bytes, bytes this chunk are ${bytesWrittenThisChunk}.`);
	else LOG.error(`Update status for reqid ${reqid} - transfer failed after writing ${statusStorage[reqid].bytesSent} bytes.`);
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path && jsonReq.securid && jsonReq.reqid);
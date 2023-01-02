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
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);
const CONF = require(`${API_CONSTANTS.CONF_DIR}/xbin.json`);
const securid = require(`${API_CONSTANTS.API_DIR}/getsecurid.js`);
const uploadfile = require(`${API_CONSTANTS.API_DIR}/uploadfile.js`);

const DEFAULT_READ_BUFFER_SIZE = 10485760;

exports.handleRawRequest = async function(jsonObj, servObject, headers, url) {
	if (!validateRequest(jsonObj)) {LOG.error("Validation failure."); _sendError(servObject); return;}
	if (!securid.check(jsonObj.securid)) {LOG.error("SecurID validation failure."); _sendError(servObject, true); return;}

	const headersMod = {...headers, "authorization": `Bearer ${jsonObj.auth}`};
	jsonObj.fullpath = path.resolve(`${await cms.getCMSRoot(headersMod)}/${jsonObj.path}`);
	if (!await cms.isSecure(headersMod, jsonObj.fullpath)) {LOG.error(`Path security validation failure: ${jsonObj.path}`); _sendError(servObject); return;}

	await this.downloadFile(jsonObj, servObject, headers, url);
}

exports.downloadFile = async (fileReq, servObject, headers, url) => {
	LOG.debug(`Got downloadfile request for path ${fileReq.fullpath}, starting download, reqid is ${fileReq.reqid}.`);

	const _handleDownloadError = err => { LOG.error(`Error sending download file for path ${fileReq.fullpath} due to ${err} reqid is ${fileReq.reqid}.`); 
		_updateWriteStatus(fileReq.reqid, undefined, 0, true); }
	try {
		let fullpath = fileReq.fullpath, stats = await uploadfile.getFileStats(fullpath), deleteOnDownloadComplete = false;
		if (stats.xbintype == API_CONSTANTS.XBIN_FOLDER) {
			deleteOnDownloadComplete = true; fullpath = await _zipDirectory(fullpath); stats = await fspromises.stat(fullpath); }

		const zippable = uploadfile.isZippable(fullpath);
		let respHeaders = {}; APIREGISTRY.injectResponseHeaders(url, {}, headers, respHeaders, servObject);
		respHeaders["content-disposition"] = "attachment;filename=" + path.basename(fullpath);
		respHeaders["content-length"] = stats.size;   
		respHeaders["content-type"] = "application/octet-stream";
		servObject.server.statusOK(respHeaders, servObject, true);

		_updateWriteStatus(decodeURIComponent(fileReq.reqid), stats.size, null);
		let readStream = fs.createReadStream(fullpath, {highWaterMark: CONF.DOWNLOAD_READ_BUFFER_SIZE||DEFAULT_READ_BUFFER_SIZE, 
			flags:"r", autoClose:true});
		if (CONF.DISK_SECURED) readStream = readStream.pipe(crypt.getDecipher(CONF.SECURED_KEY)); // decrypt the file before sending if it is encrypted
		if (zippable) readStream = readStream.pipe(zlib.createGunzip());	
        const writable = readStream.pipe(servObject.res, {end:true});
		const old_write = writable.write; writable.write = function(chunk) {
			_updateWriteStatus(fileReq.reqid, undefined, chunk.length); return old_write.apply(writable, arguments);}
		writable.on("error", error => _handleDownloadError(error));
		writable.on("finish", _ => {
			LOG.debug(`Finished sending download file for path ${fileReq.fullpath} successfully, reqid is ${fileReq.reqid}.`);
			if (deleteOnDownloadComplete) fspromises.unlink(fullpath);	// delete temporarily created ZIP files
		});
	} catch (err) { _handleDownloadError(err); _sendError(servObject); }
}

exports.readUTF8File = async function (headers, inpath) {
	const fullpath = path.resolve(`${await cms.getCMSRoot(headers)}/${inpath}`);
	if (!await cms.isSecure(headers, fullpath)) throw `Path security validation failure: ${fullpath}`;
	const zippable = uploadfile.isZippable(fullpath);

	let dataRead = await fspromises.readFile(fullpath); 
	if (CONF.DISK_SECURED) dataRead = await _readEncryptedUTF8Data(dataRead, zippable);
	else dataRead = dataRead.toString("utf8");
	return dataRead;
}

function _readEncryptedUTF8Data(buffer, zippable) {
	return new Promise((resolve, reject) => {
		const buffersRead = []; readStream = stream.Readable.from(buffer).pipe(crypt.getDecipher(CONF.SECURED_KEY));
		if (zippable) readStream = readStream.pipe(zlib.createGunzip()); 
		readStream.on("data", chunk => buffersRead.push(chunk));
		readStream.on("finish", _ => resolve(Buffer.concat(buffersRead).toString("utf8")));
		readStream.on("error", error => reject(error));
	});
}

function _sendError(servObject, unauthorized) {
	if (!servObject.res.writableEnded) {
		if (unauthorized) servObject.server.statusUnauthorized(servObject); 
		else servObject.server.statusInternalError(servObject); 
		servObject.server.end(servObject);
	}
}

async function _zipDirectory(path) {	// unencrypt, ungzip etc before packing to send
    return new Promise(async (resolve, reject) => {
        const tempFilePath = utils.getTempFile("zip"); const out = fs.createWriteStream(tempFilePath);
        const archive = archiver("zip", { zlib: { level: 9 }});
        out.on("close", _=>resolve(tempFilePath)); archive.on("error", err=>reject(err));
		try {
			await utils.walkFolder(path, (fullPath, stats, relativePath) =>  new Promise((resolve, reject) => {
				if (!stats.isFile()) {resolve(); return;}
				try {
					const zippable = uploadfile.isZippable(fullpath), readstreamEntry = fs.createReadStream(fullPath); 
					if (CONF.DISK_SECURED) readstreamEntry = readstreamEntry.pipe(crypt.getDecipher(CONF.SECURED_KEY));
					if (zippable) readstreamEntry = readstreamEntry.pipe(zlib.createGunzip());	
					archive.append(readstreamEntry, {name: relativePath});
					resolve();
				} catch (err) {reject(err);}
			}));
			archive.finalize();
		} catch (err) {reject(err);}
    });
}

function _updateWriteStatus(reqid, fileSize=0, bytesWrittenThisChunk, transferFailed) {
	const statusStorage = CLUSTER_MEMORY.get("__org_xbin_file_writer_req_statuses") || {};
	if (!(statusStorage[reqid])) statusStorage[reqid] = {size: fileSize, bytesSent: 0, failed: false};
	
	if (bytesWrittenThisChunk) statusStorage[reqid].bytesSent += bytesWrittenThisChunk;
	if (transferFailed) statusStorage[reqid].failed = true;
	CLUSTER_MEMORY.set("__org_xbin_file_writer_req_statuses", statusStorage);
	if (!transferFailed) LOG.debug(`Update status for reqid ${reqid} - file size is ${fileSize} bytes, bytes written so far = ${statusStorage[reqid].bytesSent} bytes.`);
	else LOG.error(`Update status for reqid ${reqid} - transfer failed after writing ${statusStorage[reqid].bytesSent} bytes.`);
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path && jsonReq.securid && jsonReq.reqid);
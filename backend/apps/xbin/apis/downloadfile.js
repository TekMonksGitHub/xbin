/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const utils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);
const CONF = require(`${API_CONSTANTS.CONF_DIR}/xbin.json`);
const securid = require(`${API_CONSTANTS.API_DIR}/getsecurid.js`);

exports.handleRawRequest = async function(jsonObj, servObject, headers, url) {
	if (!validateRequest(jsonObj)) {LOG.error("Validation failure."); _sendError(servObject); return;}
	if (!securid.check(jsonObj.securid)) {LOG.error("SecurID validation failure."); _sendError(servObject, true); return;}

	const headersMod = {...headers, "authorization": `Bearer ${jsonObj.auth}`};
	jsonObj.fullpath = path.resolve(`${await cms.getCMSRoot(headersMod)}/${jsonObj.path}`);
	if (!await cms.isSecure(headersMod, jsonObj.fullpath)) {LOG.error(`Path security validation failure: ${jsonObj.path}`); _sendError(servObject); return;}

	await this.downloadFile(jsonObj, servObject, headers, url);
}

exports.downloadFile = async (fileReq, servObject, headers, url) => {
	LOG.debug("Got downloadfile request for path: " + fileReq.fullpath);

	try {
		let fullpath = fileReq.fullpath; let stats = await fs.promises.stat(fullpath);
		if (stats.isDirectory()) {fullpath = await _zipDirectory(fullpath); stats = await fs.promises.stat(fullpath);}

		let respHeaders = {}; APIREGISTRY.injectResponseHeaders(url, {}, headers, respHeaders, servObject);
		respHeaders["content-disposition"] = "attachment;filename=" + path.basename(fullpath);
		respHeaders["content-length"] = stats.size;   
		respHeaders["content-type"] = "application/octet-stream";	// try and add auto GZIP here to save bandwidth
		servObject.server.statusOK(respHeaders, servObject, true);

		_updateWriteStatus(decodeURIComponent(fileReq.reqid), stats.size, null);
        const writable = fs.createReadStream(fullpath, {highWaterMark: CONF.DOWNLOAD_READ_BUFFER_SIZE||10485760, 
			flags:"r", autoClose:true}).pipe(servObject.res, {end:true});
		const old_write = writable.write; writable.write = function(chunk) {_updateWriteStatus(fileReq.reqid, null, chunk.length); return old_write.apply(writable, arguments);}
	} catch (err) {
		LOG.error(`Error in downloadfile: ${err}`);
		_sendError(servObject);
		_updateWriteStatus(fileReq.reqid, -1, 0, true);
	}
}

function _sendError(servObject, unauthorized) {
	if (!servObject.res.writableEnded) {
		if (unauthorized) servObject.server.statusUnauthorized(servObject); 
		else servObject.server.statusInternalError(servObject); 
		servObject.server.end(servObject);
	}
}

async function _zipDirectory(path) {
    return new Promise((resolve, reject) => {
        const tempFilePath = utils.getTempFile("zip"); const out = fs.createWriteStream(tempFilePath);
        const archive = archiver("zip", { zlib: { level: 9 }});
        out.on("close", _=>resolve(tempFilePath)); archive.on("error", err=>reject(err));
        archive.directory(path, false).pipe(out, {end:true}); archive.finalize();
    });
}

function _updateWriteStatus(reqid, fileSize, bytesWrittenThisChunk, transferFailed) {
	const statusStorage = CLUSTER_MEMORY.get("__org_xbin_file_writer_req_statuses") || {};
	if (!statusStorage[reqid] && fileSize) statusStorage[reqid] = {size: fileSize, bytesSent: 0, failed: false};
	if (statusStorage[reqid] && bytesWrittenThisChunk) statusStorage[reqid].bytesSent += bytesWrittenThisChunk;
	if (transferFailed) statusStorage[reqid].failed = true;
	CLUSTER_MEMORY.set("__org_xbin_file_writer_req_statuses", statusStorage);
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path && jsonReq.securid && jsonReq.reqid);

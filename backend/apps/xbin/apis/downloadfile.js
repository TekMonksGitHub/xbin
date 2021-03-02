/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const utils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const statsAsync = require("util").promisify(fs.stat);
const CONF = require(`${API_CONSTANTS.CONF_DIR}/xbin.json`);
const securid = require(`${API_CONSTANTS.API_DIR}/getsecurid.js`);


exports.handleRawRequest = async function(url, jsonReq, headers, servObject) {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); _sendError(servObject); return;}
	if (!securid.check(jsonReq.securid)) {LOG.error("SecurID validation failure."); _sendError(servObject, true); return;}
	await this.downloadFile(url, jsonReq, headers, servObject);
}

exports.downloadFile = async (url, jsonReq, headers, servObject) => {
	LOG.debug("Got downloadfile request for path: " + jsonReq.path);

	const fullpath = path.resolve(`${CONF.CMS_ROOT}/${jsonReq.path}`);
	if (!API_CONSTANTS.isSubdirectory(fullpath, CONF.CMS_ROOT)) {LOG.error(`Subdir validation failure: ${jsonReq.path}`); _sendError(servObject); return;}

	try {
        const stats = await statsAsync(fullpath); if (stats.isDirectory()) fullpath = await _zipDirectory(fullpath);

		let respHeaders = {}; APIREGISTRY.injectResponseHeaders(url, {}, headers, respHeaders, servObject);
		respHeaders["content-disposition"] = "attachment;filename=" + path.basename(fullpath);
		respHeaders["content-length"] = stats.size;   
		respHeaders["content-type"] = "application/octet-stream";	// try and add auto GZIP here to save bandwidth
		servObject.server.statusOK(respHeaders, servObject, true);

		_updateWriteStatus(decodeURIComponent(jsonReq.reqid), stats.size, null);
        const writable = fs.createReadStream(fullpath, {"flags":"r","autoClose":true}).pipe(servObject.res, {end:true});
		const old_write = writable.write; writable.write = function(chunk) {_updateWriteStatus(jsonReq.reqid, null, chunk.length); return old_write.apply(writable, arguments);}
	} catch (err) {
		LOG.error(`Error in downloadfile: ${err}`);
		_sendError(servObject);
		_updateWriteStatus(jsonReq.reqid, -1, 0, true);
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
        const arhiver = archiver("zip", { zlib: { level: 9 }});
        archiver.on("end", _=>resolve(tempFilePath)); archiver.on("error", err=>reject(err));
        arhiver.directory(path, false).pipe(out, {end:true}); archive.finalize();
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

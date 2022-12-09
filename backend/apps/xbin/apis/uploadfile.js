/**
 * Handles upload requests. 
 * (C) 2020 TekMonks. All rights reserved.
 */
const fs = require("fs");
const path = require("path");
const fspromises = fs.promises;
const stream = require("stream");
const crypt = require(`${CONSTANTS.LIBDIR}/crypt.js`);
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);
const CONF = require(`${API_CONSTANTS.CONF_DIR}/xbin.json`);
const quotas = require(`${API_CONSTANTS.LIB_DIR}/quotas.js`);

exports.doService = async (jsonReq, _servObject, headers, _url) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got uploadfile request for path: " + jsonReq.path);

	const fullpath = path.resolve(`${await cms.getCMSRoot(headers)}/${jsonReq.path}`), temppath = path.resolve(`${fullpath}${API_CONSTANTS.XBIN_IGNORE_PATH_SUFFIX}`);
	if (!await cms.isSecure(headers, fullpath)) {LOG.error(`Path security validation failure: ${jsonReq.path}`); return CONSTANTS.FALSE_RESULT;}

	try {
        const matches = jsonReq.data.match(/^data:.*;base64,(.*)$/); 
        if (!matches) throw `Bad data encoding: ${jsonReq.data}`;
		const bufferToWrite = Buffer.from(matches[1], "base64");
		if (!(await quotas.checkQuota(headers, bufferToWrite.length)).result) throw (`Quota is full write failed for path ${fullpath}.`);
		// convert this to a piped encrypted stream if the disk is secured
        if (CONF.DISK_SECURED) await _appendOrWriteEncrypted(temppath, bufferToWrite, jsonReq.startOfFile?false:true);
		else await fspromises[jsonReq.startOfFile?"writeFile":"appendFile"](temppath, bufferToWrite);
		if (jsonReq.endOfFile) await fspromises.rename(temppath, fullpath);

		LOG.debug(`Added ${bufferToWrite.length} bytes to the file at eventual path ${fullpath} using temp path ${temppath}.`);
        
		return CONSTANTS.TRUE_RESULT;
	} catch (err) {
		LOG.error(`Error writing to path: ${fullpath}, error is: ${err}`); 
		try {await fspromises.unlink(fullpath)} catch(err) {};
		return CONSTANTS.FALSE_RESULT;
	}
}

function _appendOrWriteEncrypted(path, buffer, append) {
	return new Promise((resolve, reject) => {
		const fsWriteStream = fs.createWriteStream(path, {"flags":append?"a":"w"});
		stream.Readable.from(buffer).pipe(crypt.getCipher(CONF.SECURED_KEY)).pipe(fsWriteStream);
		fsWriteStream.on("finish", _ => resolve());
		fsWriteStream.on("error", error => reject(error));
	});
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path && jsonReq.data && (jsonReq.startOfFile !== undefined) && (jsonReq.endOfFile  !== undefined));
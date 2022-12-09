/**
 * Reads or writes data to an existing file. Assumption is
 * that it is a UTF-8 encoded file only.
 * 
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

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	jsonReq.op = jsonReq.op || "read";
	
	LOG.debug("Got operatefile request for path: " + jsonReq.path);

	const fullpath = path.resolve(`${await cms.getCMSRoot(headers)}/${jsonReq.path}`);
	if (!await cms.isSecure(headers, fullpath)) {LOG.error(`Subdir validation failure: ${jsonReq.path}`); return CONSTANTS.FALSE_RESULT;}

	try {
		let result = {...CONSTANTS.TRUE_RESULT};
		if (jsonReq.op == "read") {	// it is a read operation
			result.data = await fspromises.readFile(fullpath);
			if (CONF.DISK_SECURED) result.data = await _readEncryptedUTF8Data(result.data);
			else result.data = result.data.toString("utf8");
		} else {	// it is a write operation
			const additionalBytesToWrite = Buffer.from(jsonReq.data, "utf8").length - (await fspromises.stat(fullpath)).size;
			if (!(await quotas.checkQuota(headers, additionalBytesToWrite)).result) throw ("Quota is full write failed.");
			else if (confirm.DISK_SECURED) await _writeEncryptedUTF8Data(fullpath, jsonReq.data);
			else await fspromises.writeFile(fullpath, jsonReq.data, "utf8");
		}

        return result;
	} catch (err) {
		LOG.error(`Error operating file: ${fullpath}, error is: ${err}.`); return CONSTANTS.FALSE_RESULT;
	}
}

function _readEncryptedUTF8Data(buffer) {
	return new Promise((resolve, reject) => {
		const buffersRead = []; readStream = stream.Readable.from(buffer).pipe(crypt.getDecipher(CONF.SECURED_KEY));
		readStream.on("data", chunk => buffersRead.push(chunk));
		readStream.on("finish", _ => resolve(Buffer.concat(buffersRead).toString("utf8")));
		readStream.on("error", error => reject(error));
	});
}

function _writeEncryptedUTF8Data(path, utf8Data) {
	return new Promise((resolve, reject) => {
		const fsWriteStream = fs.createWriteStream(path, {"flags":"w"});
		stream.Readable.from(Buffer.from(utf8Data, "utf8")).pipe(crypt.getCipher(CONF.SECURED_KEY)).pipe(fsWriteStream);
		fsWriteStream.on("finish", _ => resolve());
		fsWriteStream.on("error", error => reject(error));
	});
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path && (!jsonReq.op || jsonReq.op == "read" || (jsonReq.op == "write" && jsonReq.data)));

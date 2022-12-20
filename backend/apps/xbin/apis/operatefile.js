/**
 * Reads or writes data to an existing file. Assumption is
 * that it is a UTF-8 encoded file only.
 * 
 * (C) 2020 TekMonks. All rights reserved.
 */

const uploadfile = require(`${API_CONSTANTS.API_DIR}/uploadfile.js`);
const downloadfile = require(`${API_CONSTANTS.API_DIR}/downloadfile.js`);

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	jsonReq.op = jsonReq.op || "read";
	
	LOG.debug("Got operatefile request for path: " + jsonReq.path);

	try {
		const result = {...CONSTANTS.TRUE_RESULT};
		if (jsonReq.op == "read") result.data = await downloadfile.readUTF8File(headers, jsonReq.path);	// it is a read operation
		else await uploadfile.writeUTF8File(headers, jsonReq.path, Buffer.isBuffer(jsonReq.data) ? 
			jsonReq.data : Buffer.from(jsonReq.data, "utf8"));	// it is a write operation
        return result;
	} catch (err) {
		LOG.error(`Error operating file: ${jsonReq.path}, error is: ${err}.`); return CONSTANTS.FALSE_RESULT;
	}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path && (!jsonReq.op || jsonReq.op == "read" || (jsonReq.op == "write" && jsonReq.data)));
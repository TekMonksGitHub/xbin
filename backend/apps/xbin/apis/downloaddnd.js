/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const downloadfile = require(`${API_CONSTANTS.API_DIR}/downloadfile.js`);

exports.handleRawRequest = async (url, jsonReq, headers, servObject) => {
	if (!validateRequest(jsonReq) ) {LOG.error("Validation failure."); _sendError(servObject); return;}
	
	LOG.debug("Got DND downloadfile request for path: " + jsonReq.path);
    downloadfile.handleRawRequest(url, jsonReq, headers, servObject);
}

function _sendError(servObject) {
	if (!servObject.res.writableEnded) {
		servObject.server.statusInternalError(servObject, err); 
		servObject.server.end(servObject);
	}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path && jsonReq.securid && jsonReq.reqid);

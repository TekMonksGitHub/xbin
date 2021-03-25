/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const downloadfile = require(`${API_CONSTANTS.API_DIR}/downloadfile.js`);

exports.handleRawRequest = async (jsonObj, servObject, headers, url) => {
	if (!validateRequest(jsonReq) ) {LOG.error("Validation failure."); _sendError(servObject); return;}
	
	LOG.debug("Got DND downloadfile request for path: " + jsonReq.path);
    downloadfile.handleRawRequest(jsonObj, servObject, headers, url);
}

function _sendError(servObject) {
	if (!servObject.res.writableEnded) {
		servObject.server.statusInternalError(servObject, err); 
		servObject.server.end(servObject);
	}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path && jsonReq.securid && jsonReq.reqid);

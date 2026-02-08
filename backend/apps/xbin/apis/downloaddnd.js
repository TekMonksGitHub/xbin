/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const getsecurid = require(`${XBIN_CONSTANTS.API_DIR}/getsecurid.js`);
const downloadfile = require(`${XBIN_CONSTANTS.API_DIR}/downloadfile.js`);
const jwtTokenManager = require(`${CONSTANTS.LIBDIR}/apiregistry.js`).getExtension("jwtTokenManager");

exports.handleRawRequest = async (jsonReq, servObject, headers, url, _apiconf) => {
	if (!validateRequest(jsonReq) ) {LOG.error("Validation failure."); _sendError(servObject, "Validation failure."); return;}
	if (!await jwtTokenManager.checkToken(jsonReq.auth)) {LOG.error("Validation failure, wrong AUTH."); _sendError(servObject, "Validation failure."); return;}
	
	LOG.debug("Got DND downloadfile request for path: " + jsonReq.path);
	const securid = await getsecurid.getSecurID(jsonReq);
    downloadfile.handleRawRequest({...jsonReq, securid}, servObject, headers, url);
}

function _sendError(servObject, err) {
	if (!servObject.res.writableEnded) {
		servObject.server.statusInternalError(servObject, err); 
		servObject.server.end(servObject);
	}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path && jsonReq.reqid && jsonReq.auth);

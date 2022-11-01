/** 
 * API for downloading a shared file.
 * (C) 2020 TekMonks. All rights reserved.
 */
const db = require(`${API_CONSTANTS.LIB_DIR}/xbindb.js`).getDB();
const downloadfile = require(`${API_CONSTANTS.API_DIR}/downloadfile.js`);

exports.handleRawRequest = async (jsonReq, servObject, headers, url) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); _sendError(servObject); return;}
	
	LOG.debug("Got download shared file request for id: " + jsonReq.id);

	try {
		const share = (await db.getQuery("SELECT fullpath, expiry FROM shares WHERE id = ?", [jsonReq.id]))[0];
        if (!share) throw ({code: 404, message: "Not found"}); 
        if (Date.now() > share.expiry) throw ({code: 404, message: "Not found"});   // has expired
        
        return downloadfile.downloadFile({fullpath: share.fullpath, reqid:"__never_use_none"}, servObject, headers, url);
	} catch (err) {
        LOG.error(`Share ID resulted in DB error ${err}`); 
        throw ({code: 404, message: "Not found"}); 
    }
}

function _sendError(servObject, unauthorized) {
	if (!servObject.res.writableEnded) {
		if (unauthorized) servObject.server.statusUnauthorized(servObject); 
		else servObject.server.statusInternalError(servObject); 
		servObject.server.end(servObject);
	}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.id);

/**
 * Checks a given user's disk quota to write the given amount of bytes
 * (C) 2022 TekMonks. All rights reserved.
 */
const login = require(`${API_CONSTANTS.API_DIR}/login.js`);
const quotas = require(`${API_CONSTANTS.LIB_DIR}/quotas.js`);

exports.doService = async (jsonReq, _servObject, headers, _url) => {
    if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
    
    const id = login.getRole(headers) == "admin" ? (jsonReq.id || login.getID(headers)) : login.getID(headers); 
    if (!id) {LOG.error("Bad ID given to check quota "+id); return CONSTANTS.FALSE_RESULT;}

    LOG.debug("Got check quota request for ID: " + id + ", check for bytes to write " + jsonReq.bytestowrite);
    const result = await quotas.checkQuota(headers, parseInt(jsonReq.bytestowrite), id);
    LOG.debug("Check quota request for ID: " + id + ", for bytes to write " + jsonReq.bytestowrite + ", the result is " + result);

    return {result: result.result, quota: result.quota, currentsize: result.currentsize};
}

const validateRequest = jsonReq => (jsonReq && jsonReq.bytestowrite);
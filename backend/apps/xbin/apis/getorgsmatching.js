/**
 * Returns the users for the given org. 
 * (C) 2015 TekMonks. All rights reserved.
 */
const userid = require(`${APP_CONSTANTS.LIB_DIR}/userid.js`);

exports.doService = async jsonReq => {
    if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
    
    LOG.info("Got request for matching orgs: " + jsonReq.org);

    if (jsonReq.org.indexOf("%") == -1) jsonReq.org = jsonReq.org + "%";
    const result = await userid.getOrgsMatching(jsonReq.org);

    if (result.result) LOG.info(`Sending org list for: ${jsonReq.org}, as ${result.orgs}`); 
    else LOG.error(`Unable to find matching org list for: ${jsonReq.org}, DB error`);

    if (result.result && result.orgs.length) { // flatten orgs
        const orgs = []; for (const orgObject of result.orgs) orgs.push(orgObject.org); result.orgs = orgs; }

    return result;
}

const validateRequest = jsonReq => (jsonReq && jsonReq.org);

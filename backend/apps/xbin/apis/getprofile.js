/**
 * Returns a user's profile data. 
 * (C) 2015 TekMonks. All rights reserved.
 */
const crypt = require(`${CONSTANTS.LIBDIR}/crypt.js`);
const userid = require(`${APP_CONSTANTS.LIB_DIR}/userid.js`);
const EMAIL_RE = /^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/;

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
    const id = crypt.decrypt(jsonReq.id); const time = crypt.decrypt(jsonReq.time);
	if (Date.now() - time > APP_CONSTANTS.CONF.reset_expiry_time) {LOG.error(`Reset link timed out for email: ${id}`); return CONSTANTS.FALSE_RESULT;}
    if (!id.match(EMAIL_RE)) {LOG.error(`Validation failure due to bad email: ${id}.`); return CONSTANTS.FALSE_RESULT;}

	LOG.info("Got get profile request for ID: " + id);

	const result = await userid.existsID(id);

	if (result.result) LOG.info(`Sending data for ID: ${id}.`); else LOG.error(`Unable to find: ${id}, DB error.`);

	return result;
}

const validateRequest = jsonReq => (jsonReq && jsonReq.id && jsonReq.time);
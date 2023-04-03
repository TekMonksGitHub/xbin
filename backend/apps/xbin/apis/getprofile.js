/**
 * Returns a user's profile data. Sets JWT token with user ID
 * if the profile is successfully authenticated to contain the 
 * encryped time and IDs.
 * (C) 2015 TekMonks. All rights reserved.
 */
const crypt = require(`${CONSTANTS.LIBDIR}/crypt.js`);
const userid = require(`${APP_CONSTANTS.LIB_DIR}/userid.js`);
const EMAIL_RE = /^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/;

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}

    let id, time; try { id = crypt.decrypt(jsonReq.id); time = crypt.decrypt(jsonReq.time); } catch (err) {
		LOG.error(`Bad ID or Time in the incoming request for getProfile. ID is ${id}, time is ${time}. Error is ${err}.`);
		return CONSTANTS.FALSE_RESULT;
	}

	if (Date.now() - time > APP_CONSTANTS.CONF.reset_expiry_time) {LOG.error(`Reset link timed out for email: ${id}`); return CONSTANTS.FALSE_RESULT;}
    if (!id.match(EMAIL_RE)) {LOG.error(`Validation failure due to bad email: ${id}.`); return CONSTANTS.FALSE_RESULT;}

	LOG.info("Got getProfile request for ID: " + id);

	const result = await userid.existsID(id);

	if (result.result) LOG.info(`Sending data for ID: ${id}.`); else LOG.error(`Unable to find: ${id}, DB error.`);

	return result;
}

const validateRequest = jsonReq => (jsonReq && jsonReq.id && jsonReq.time);
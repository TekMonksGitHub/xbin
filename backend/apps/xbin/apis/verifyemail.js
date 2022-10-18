/**
 * Verifies a user's email. 
 * (C) 2022 TekMonks. All rights reserved.
 */
const crypt = require(`${CONSTANTS.LIBDIR}/crypt.js`);
const utils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const userid = require(`${APP_CONSTANTS.LIB_DIR}/userid.js`);
const EMAIL_RE = /^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/;
const DEFAULT_EXPIRY_24_HOURS = 24*60*60;   // 24 hours is default email verification expiry
const DEFAULT_VERIFYRUL_SAFE_TIMERANGE = 10;    // 10 seconds max mismatch between verify URL time and register time

exports.doService = async jsonReq => {
    if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
    const id = crypt.decrypt(jsonReq.e), _getIntOrZero = s => {try {return parseInt(s);} catch (err) {return 0;}}, urltime =  _getIntOrZero(crypt.decrypt(jsonReq.t));
    const email_expiry_limit = exports.getEmailExpiryTimeoutInSeconds();
    if (!id.match(EMAIL_RE)) {LOG.error(`Email verification failure due to bad email: ${id}.`); return CONSTANTS.FALSE_RESULT;}

    LOG.info("Got email verification for ID: " + id);

    let result = await userid.existsID(id); 
    if (!result.result) {LOG.error(`Email verification failure due to missing ID: ${id}.`); return CONSTANTS.FALSE_RESULT;}
    if (result.verified == 1) {LOG.error(`Email verification ID already verified: ${id}.`); return CONSTANTS.TRUE_RESULT;}
    if (utils.getUnixEpoch() - result.registerdate > email_expiry_limit) {LOG.error(`Email verification timed out for email: ${id}`); return CONSTANTS.FALSE_RESULT;}
    if (Math.abs(result.registerdate - urltime) > (APP_CONSTANTS.CONF.verifyurl_safe_time_range||DEFAULT_VERIFYRUL_SAFE_TIMERANGE)) {
        LOG.error(`Email verification url time and user ID register time out of safe range for: ${id}`); return CONSTANTS.FALSE_RESULT; }

    result = await userid.verifyEmail(id);

    if (result.result) LOG.info(`Email for ID verified ${id}.`);
    else LOG.error(`Email verification failure due to DB error for ID: ${id}.`);

    return {result: result.result};
}

exports.getEmailExpiryTimeoutInSeconds = _ => {
    if (APP_CONSTANTS.CONF.email_verification_expiry_timeout_hours) 
        return APP_CONSTANTS.CONF.email_verification_expiry_timeout_hours*60*60;
    if (APP_CONSTANTS.CONF.email_verification_expiry_timeout_minutes) 
        return APP_CONSTANTS.CONF.email_verification_expiry_timeout_minutes*60;
    if (APP_CONSTANTS.CONF.email_verification_expiry_timeout_seconds) return APP_CONSTANTS.CONF.email_verification_expiry_timeout_seconds;
    return DEFAULT_EXPIRY_24_HOURS;
}

const validateRequest = jsonReq => (jsonReq && jsonReq.e && jsonReq.t);
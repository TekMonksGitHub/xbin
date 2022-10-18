/**
 * Deletes unverified accounts.
 * 
 * (C) 2021 TekMonks. All rights reserved.
 * See enclosed LICENSE file.
 */
const userid = require(APP_CONSTANTS.LIB_DIR+"/userid.js");
const verifyemail = require(APP_CONSTANTS.API_DIR+"/verifyemail.js");

const DEFAULT_CLEANUP_FREQUENCY = 600000;

module.exports.init = _ => setInterval(_=>
    {
        try {
            const result = userid.deleteAllUnverifiedAndExpiredAccounts(verifyemail.getEmailExpiryTimeoutInSeconds());
            if (result.result && result.usersDropped.length) LOG.info(`Dropped the following unverified users, whose verification periods expired ${result.usersDropped}`); 
        } catch (err) {LOG.error(`Encountered the following error while trying to find and drop unverified users: ${err}`);}
    },
    APP_CONSTANTS.CONF.cleanup_unverified_accounts_frequency||DEFAULT_CLEANUP_FREQUENCY);
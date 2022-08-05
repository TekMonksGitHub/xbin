/** 
 * Returns true or false depending on whether we should
 * enable remote logging.
 * (C) 2020 TekMonks. All rights reserved.
 */

const CONF = require(`${API_CONSTANTS.CONF_DIR}/xbin.json`);

exports.doService = async _jsonReq => {return {result: true, remote_log: CONF.REMOTE_LOG};}
/** 
 * Returns true or false depending on whether we should
 * enable remote logging.
 * (C) 2020 TekMonks. All rights reserved.
 */

// in dev launch backend server may not have init apps when this API is called
// so include the conf using a direct path instead of global constants
const conf = require(`${__dirname}/../conf/xbin.json`); 

exports.doService = async _jsonReq => {return {result: true, remote_log: conf.REMOTE_LOG};}
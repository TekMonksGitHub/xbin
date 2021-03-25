/** 
 * Sends status of the file being downloaded - how many bytes we have sent.
 * This may not match the bytes that the other side received, due to buffering.
 * E.g. we sent 1 MB but 0.5 MB of that is sitting on the write stream's buffers.
 * (C) 2021 TekMonks. All rights reserved.
 */
const REQIDS_WITH_NO_STATUS = {};
const CONF = require(`${API_CONSTANTS.CONF_DIR}/xbin.json`);
const EXPIRED_REQID_INTERVAL = CONF.TIME_TO_WAIT_FOR_DOWNLOADS_TO_START||20000;

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
    const reqid = decodeURIComponent(jsonReq.reqid);
	const statusStorage = CLUSTER_MEMORY.get("__org_xbin_file_writer_req_statuses") || {};

    let result;
    if (statusStorage[reqid]) {
        result = statusStorage[reqid].failed?CONSTANTS.FALSE_RESULT:{result:true,...statusStorage[reqid]};
        if (REQIDS_WITH_NO_STATUS[reqid]) delete REQIDS_WITH_NO_STATUS[reqid];  // has status now
        if (statusStorage[reqid].size == statusStorage[reqid].bytesSent) {  // done 100%
            delete statusStorage[reqid];
            CLUSTER_MEMORY.set("__org_xbin_file_writer_req_statuses", statusStorage);
        }
    } else {
        if (!REQIDS_WITH_NO_STATUS[reqid]) REQIDS_WITH_NO_STATUS[reqid] = Date.now();   // new transfer

        if (REQIDS_WITH_NO_STATUS[reqid] - Date.now() < EXPIRED_REQID_INTERVAL) 
            result = {result: true, size: -1, bytesSent: 0, failed: false}; // transfer hasn't started yet
        else {
            result = {result: false, size: -1, bytesSent: 0, failed: true}; // waited too long, has no status, failed.
            delete REQIDS_WITH_NO_STATUS[reqid];
        }
    }
    
    return result;
}

const validateRequest = jsonReq => (jsonReq && jsonReq.reqid);

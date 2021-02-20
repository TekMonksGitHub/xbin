/* 
 * (C) 2020 TekMonks. All rights reserved.
 */

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
    const reqid = decodeURIComponent(jsonReq.reqid);
	const statusStorage = CLUSTER_MEMORY.get("__org_xbin_file_writer_req_statuses") || {};
    const result = statusStorage[reqid]?
        statusStorage[reqid].failed?CONSTANTS.FALSE_RESULT:{result:true,...statusStorage[reqid]} : 
        {result: true, size: -1, bytesSent: 0, failed: false};

    if (statusStorage[reqid] && statusStorage[reqid].size == statusStorage[reqid].bytesSent) {
        delete statusStorage[reqid];
        CLUSTER_MEMORY.set("__org_xbin_file_writer_req_statuses", statusStorage);
    }
    
    return result;
}

const validateRequest = jsonReq => (jsonReq && jsonReq.reqid);

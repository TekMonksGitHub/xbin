/* 
 * (C) 2020 TekMonks. All rights reserved.
 */

const crypt = require(`${CONSTANTS.LIBDIR}/crypt.js`);

const CLUSTER_SYNC_TIME = require("os").cpus().length*100;

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
    const token = await exports.getSecurID(jsonReq);
    return {result: true, id: token};
}

exports.getSecurID = jsonReq => {
    return new Promise(resolve =>{
        const token = crypt.encrypt(jsonReq.path+decodeURIComponent(jsonReq.reqid)+Math.random());

        const securids = CLUSTER_MEMORY.get("__org_xbin_securids") || [];
        securids.push(token);
        CLUSTER_MEMORY.set("__org_xbin_securids", securids);
        setTimeout(_=>{ // expire it quickly
            const securids = CLUSTER_MEMORY.get("__org_xbin_securids");
            securids.splice(securids.indexOf(token),1); CLUSTER_MEMORY.set("__org_xbin_securids", securids);
        }, 1000000000);//CLUSTER_SYNC_TIME+(XBIN_CONSTANTS.CONF.SECURID_EXPIRY||2000));
        setTimeout(_=>resolve(token), CLUSTER_SYNC_TIME);   // this ensures the secure ID has replicated
    });  
}

exports.check = id => {
    const securIDs = (CLUSTER_MEMORY.get("__org_xbin_securids") || []);
    return securIDs.includes(id);
}

const validateRequest = jsonReq => (jsonReq && jsonReq.reqid && jsonReq.path);

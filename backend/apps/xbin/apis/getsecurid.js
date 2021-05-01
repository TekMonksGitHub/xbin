/* 
 * (C) 2020 TekMonks. All rights reserved.
 */

const crypt = require(`${CONSTANTS.LIBDIR}/crypt.js`);
const CONF = require(`${API_CONSTANTS.CONF_DIR}/xbin.json`);

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
    const token = exports.getSecurID(jsonReq);
    return {result: true, id: token};
}

exports.getSecurID = jsonReq => {
    const token = crypt.encrypt(jsonReq.path+decodeURIComponent(jsonReq.reqid)+Math.random());

	const securids = CLUSTER_MEMORY.get("__org_xbin_securids") || [];
    securids.push(token);
    CLUSTER_MEMORY.set("__org_xbin_securids", securids);
    setTimeout(_=>{ // expire it quickly
        const securids = CLUSTER_MEMORY.get("__org_xbin_securids");
        securids.splice(securids.indexOf(token),1); CLUSTER_MEMORY.set("__org_xbin_securids", securids);
    }, CONF.SECURID_EXPIRY||2000);
    return token;
}

exports.check = id => (CLUSTER_MEMORY.get("__org_xbin_securids") || []).includes(id);

const validateRequest = jsonReq => (jsonReq && jsonReq.reqid && jsonReq.path);

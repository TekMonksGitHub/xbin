/**
 * Library for managing quotas
 * (C) 2022 TekMonks
 */

const CONF = XBIN_CONSTANTS.CONF;
const cms = require(`${XBIN_CONSTANTS.LIB_DIR}/cms.js`);
const db = require(`${XBIN_CONSTANTS.LIB_DIR}/xbindb.js`).getDB();
const uploadfile = require(`${XBIN_CONSTANTS.API_DIR}/uploadfile.js`);

exports.checkQuota = async function(headersOrLoginIDAndOrg, extraInfo, writeLength) {
	const cmsRoot = await cms.getCMSRoot(headersOrLoginIDAndOrg, extraInfo); 
	const id = cms.getID(headersOrLoginIDAndOrg);
    if (!id) {LOG.error("Not valid ID "+id); return {result: false};}
	let quota; try {quota = (await db.getQuery("SELECT quota FROM quotas WHERE id = ?", [id]))[0]} catch (err) {
		LOG.error(`Error retrieving quota for ID ${id} due to error: ${err}, using DEFAULT_QUOTA of ${CONF.DEFAULT_QUOTA}`);
	};
	if (!quota) quota = CONF.DEFAULT_QUOTA;
	const currentsize = await uploadfile.getFolderSize(cmsRoot); if (currentsize+writeLength > quota) return {result: false, quota, 
		currentsize}; else return {result: true, quota, currentsize};
}

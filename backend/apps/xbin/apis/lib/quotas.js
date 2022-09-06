
/**
 * Library for managing quotas
 * (C) 2022 TekMonks
 */

const db = require(`${API_CONSTANTS.LIB_DIR}/db.js`);
const cms = require(`${API_CONSTANTS.API_DIR}/cms.js`);
const login = require(`${API_CONSTANTS.API_DIR}/login.js`);

exports.checkQuota = async function(headers, writeLength, id) {
	const cmsRoot = await cms.getCMSRoot(headers), if (!id) id = login.getID(headers);
    if (!id) {LOG.error("Not valid ID "+id); return {result: false};}
	const quota = (await db.getQuery("SELECT quota FROM quotas WHERE id = ?", [id]))[0] || CONF.DEFAULT_QUOTA;
	if (_dirSize(cmsRoot)+writeLength > quota) return {result: false, quota}; else return {result: true, quota};
}
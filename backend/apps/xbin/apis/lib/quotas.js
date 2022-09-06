
/**
 * Library for managing quotas
 * (C) 2022 TekMonks
 */
const fspromises = require("fs").promises;
const db = require(`${API_CONSTANTS.LIB_DIR}/db.js`);
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);
const login = require(`${API_CONSTANTS.API_DIR}/login.js`);
const CONF = require(`${API_CONSTANTS.CONF_DIR}/xbin.json`);

exports.checkQuota = async function(headers, writeLength, id) {
	const cmsRoot = await cms.getCMSRoot(headers); if (!id) id = login.getID(headers);
    if (!id) {LOG.error("Not valid ID "+id); return {result: false};}
	let quota; try {quota = (await db.getQuery("SELECT quota FROM quotas WHERE id = ?", [id]))[0]} catch (err) {};
	if (!quota) quota = CONF.DEFAULT_QUOTA;
	if ((await _dirSize(cmsRoot))+writeLength > quota) return {result: false, quota}; else return {result: true, quota};
}

async function _dirSize(path) {
	let currentDirSize = 0; 
	for (const dirEntry of await fspromises.readdir(path)) { const stat = fspromises.stat(dirEntry); 
		currentDirSize += stat.isDirectory() ? _dirSize(path+"/"+dirEntry) : stat.size; }
	return currentDirSize;
}
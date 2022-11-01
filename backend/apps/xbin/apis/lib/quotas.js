/**
 * Library for managing quotas
 * (C) 2022 TekMonks
 */
const path = require("path");
const fspromises = require("fs").promises;
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);
const login = require(`${API_CONSTANTS.API_DIR}/login.js`);
const CONF = require(`${API_CONSTANTS.CONF_DIR}/xbin.json`);
const DB_PATH = path.resolve(`${APP_CONSTANTS.DB_DIR}/app.db`);
const DB_CREATION_SQLS = require(`${APP_CONSTANTS.DB_DIR}/dbschema.json`);
const db = require(`${CONSTANTS.LIBDIR}/db.js`).getDBDriver("sqlite", DB_PATH, DB_CREATION_SQLS);

exports.checkQuota = async function(headers, writeLength, id) {
	const cmsRoot = await cms.getCMSRoot(headers); if (!id) id = login.getID(headers);
    if (!id) {LOG.error("Not valid ID "+id); return {result: false};}
	let quota; try {quota = (await db.getQuery("SELECT quota FROM quotas WHERE id = ?", [id]))[0]} catch (err) {
		LOG.error(`Error retrieving quota for ID ${id} due to error: ${err}`);
	};
	if (!quota) quota = CONF.DEFAULT_QUOTA;
	const currentsize = await _dirSize(cmsRoot); if (currentsize+writeLength > quota) return {result: false, quota, 
		currentsize}; else return {result: true, quota, currentsize};
}

async function _dirSize(path) {
	let currentDirSize = 0; 
	for (const dirEntry of await fspromises.readdir(path)) { const stat = await fspromises.stat(`${path}/${dirEntry}`); 
		currentDirSize += stat.isDirectory() ? (await _dirSize(`${path}/${dirEntry}`)) : stat.size; }
	return currentDirSize;
}
/**
 * User ID management support.
 * (C) 2021 TekMonks. All rights reserved.
 * See enclosed LICENSE file.
 */
const util = require("util");
const path = require("path");
const bcryptjs = require("bcryptjs");
const CONF = require(`${API_CONSTANTS.CONF_DIR}/app.json`);
const serverutils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const DB_PATH = path.resolve(`${APP_CONSTANTS.DB_DIR}/app.db`);
const db = require(`${CONSTANTS.LIBDIR}/db.js`).getDBDriver('sqlite');
const DB_CREATION_SQLS = require(`${APP_CONSTANTS.DB_DIR}/dbschema.json`);
const getUserHash = async text => await (util.promisify(bcryptjs.hash))(text, 12);

exports.register = async (id, name, org, pwph, totpSecret, role, approved, verifyEmail=1, domain) => {
	const existsID = await exports.existsID(id);
	if (existsID.result) return({result:false}); 
	const pwphHashed = await getUserHash(pwph);
	const registerResult = await db.runCmd("INSERT INTO users (id, name, org, pwph, totpsec, role, approved, verified, domain) VALUES (?,?,?,?,?,?,?,?,?)", 
		[id, name, org, pwphHashed, totpSecret, role, approved?1:0, verifyEmail?0:1, domain], DB_PATH, DB_CREATION_SQLS);

	return {result: registerResult, id, name, org, pwph: pwphHashed, totpsec: totpSecret, role, approved:approved?1:0, verified:verifyEmail?0:1, domain};
}

exports.delete = async id => {
	const existsID = await exports.existsID(id);
	if (!existsID.result) return({result:false}); 

	const deleteDrops = ["DELETE FROM users where id = ?",
		"DELETE FROM shares where id = ?", "DELETE FROM quotas where id = ?"];

	if (!await db.runCmd("BEGIN TRANSACTION"), [], DB_PATH, DB_CREATION_SQLS) return {result: false};
	for (const deleteStatement of deleteDrops) if (!await db.runCmd(deleteStatement, [id], DB_PATH, DB_CREATION_SQLS)) return {result: false};
	if (!await db.runCmd("END TRANSACTION"), [], DB_PATH, DB_CREATION_SQLS) return {result: false}; else return {result: true};
}

exports.update = async (oldid, id, name, org, pwph, totpSecret, role, approved, domain) => {
	const pwphHashed = await getUserHash(pwph);
	return {result: await db.runCmd("UPDATE users SET id=?, name=?, org=?, pwph=?, totpsec=?, role = ?, approved = ?, domain = ? WHERE id=?", 
		[id, name, org, pwphHashed, totpSecret, role, approved?1:0, domain, oldid], 
		DB_PATH, DB_CREATION_SQLS), oldid, id, name, org, pwph, totpSecret, role, approved, domain};
}

exports.checkPWPH = async (id, pwph) => {
	const idEntry = await exports.existsID(id); if (!idEntry.result) return {result: false}; else delete idEntry.result;
	const pwphCompareResult = await (util.promisify(bcryptjs.compare))(pwph, idEntry.pwph);
	return {result: pwphCompareResult, ...idEntry}; 
}

exports.getTOTPSec = exports.existsID = async id => {
	const rows = await db.getQuery("SELECT * FROM users WHERE id = ? COLLATE NOCASE", [id], DB_PATH, DB_CREATION_SQLS);
	if (rows && rows.length) return {result: true, ...(rows[0])}; else return {result: false};
}

exports.changepwph = async (id, pwph) => {
	const pwphHashed = await getUserHash(pwph);
	return {result: await db.runCmd("UPDATE users SET pwph = ? WHERE id = ? COLLATE NOCASE", [pwphHashed, id], DB_PATH, DB_CREATION_SQLS)};
}

exports.getUsersForOrg = async org => {
	const users = await db.getQuery("SELECT * FROM users WHERE org = ? COLLATE NOCASE", [org], DB_PATH, DB_CREATION_SQLS);
	if (users && users.length) return {result: true, users}; else return {result: false};
}

exports.getUsersForDomain = async domain => {
	const users = await db.getQuery("SELECT * FROM users WHERE domain = ? COLLATE NOCASE", [domain], DB_PATH, DB_CREATION_SQLS);
	if (users && users.length) return {result: true, users}; else return {result: false};
}

exports.getOrgForDomain = async domain => {
	const users = await db.getQuery("SELECT org FROM users WHERE domain = ? COLLATE NOCASE", [domain], DB_PATH, DB_CREATION_SQLS);
	if (users && users.length) return users[0].org; else return null;
}

exports.getOrgsMatching = async org => {
	const orgs = await db.getQuery("SELECT DISTINCT org FROM users WHERE org LIKE ? COLLATE NOCASE", [org], DB_PATH, DB_CREATION_SQLS);
	if (orgs && orgs.length) return {result: true, orgs}; else return {result: true, orgs:[]};
}

exports.approve = async id => {
	return {result: await db.runCmd("UPDATE users SET approved=1 WHERE id=?", [id], DB_PATH, DB_CREATION_SQLS)};
}

exports.verifyEmail = async id => {
	return {result: await db.runCmd("UPDATE users SET verified=1 WHERE id=? AND verified=0", [id], DB_PATH, DB_CREATION_SQLS)};
}

exports.deleteAllUnverifiedAndExpiredAccounts = async verificationExpiryInSeconds => {
	const unverifiedRows = await db.getQuery(`SELECT * from users WHERE verified=0 AND ${serverutils.getUnixEpoch()}-registerdate>=${verificationExpiryInSeconds}`, 
		[], DB_PATH, DB_CREATION_SQLS);
	if ((!unverifiedRows) || (!Array.isArray(unverifiedRows))) {LOG.error("Error deleting unverified accounts due to DB error."); return {result: false};}
	const usersDropped = []; for (const unverifiedRow of unverifiedRows) 
		if ((await exports.delete(unverifiedRow.id)).result) usersDropped.push(unverifiedRow);
	return {result: true, usersDropped};
}

exports.updateLoginStats = async (id, date, ip) => {
	const rows = (await db.getQuery("SELECT * FROM users WHERE id = ? COLLATE NOCASE", [id], DB_PATH, DB_CREATION_SQLS))[0];
	const currentLoginsAndIPsJSON = JSON.parse(rows.loginsandips_json||"[]"); currentLoginsAndIPsJSON.unshift({date, ip});
	const maxLoginsToRemember = CONF.max_logins_to_remember||100;
	if (currentLoginsAndIPsJSON.length > maxLoginsToRemember) currentLoginsAndIPsJSONawait = currentLoginsAndIPsJSON.slice(0, maxLoginsToRemember);
	await db.runCmd("UPDATE users SET lastlogin=?, lastip=?, loginsandips_json=? WHERE id=?", [date, ip, 
		JSON.stringify(currentLoginsAndIPsJSON), id], DB_PATH, DB_CREATION_SQLS);
}

exports.getAdminsFor = async id => {
	const admins = await db.getQuery("SELECT * FROM users WHERE role = 'admin' AND org = (select org from users where id = ? COLLATE NOCASE) COLLATE NOCASE", 
		[id], DB_PATH, DB_CREATION_SQLS);
	if (admins && admins.length) return admins; else return null;
}
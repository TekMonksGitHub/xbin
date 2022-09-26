/* 
 * (C) 2015 TekMonks. All rights reserved.
 * See enclosed LICENSE file.
 */
const util = require("util");
const bcryptjs = require("bcryptjs");
const db = require(`${APP_CONSTANTS.LIB_DIR}/db.js`);
const getUserHash = async text => await (util.promisify(bcryptjs.hash))(text, 12);

exports.register = async (id, name, org, pwph, totpSecret, role, approved, domain) => {
	const existsID = await exports.existsID(id);
	if (existsID.result) return({result:false}); 
	const pwphHashed = await getUserHash(pwph);

	return {result: await db.runCmd("INSERT INTO users (id, name, org, pwph, totpsec, role, approved, domain) VALUES (?,?,?,?,?,?,?,?)", 
		[id, name, org, pwphHashed, totpSecret, role, approved?1:0, domain])};
}

exports.delete = async id => {
	const existsID = await exports.existsID(id);
	if (!existsID.result) return({result:false}); 

	return {result: await db.runCmd("DELETE FROM users where id = ?", [id])};
}

exports.update = async (oldid, id, name, org, pwph, totpSecret, role, approved, domain) => {
	const pwphHashed = await getUserHash(pwph);
	return {result: await db.runCmd("UPDATE users SET id=?, name=?, org=?, pwph=?, totpsec=?, role = ?, approved = ?, domain = ? WHERE id=?", 
		[id, name, org, pwphHashed, totpSecret, role, approved?1:0, oldid]), oldid, id, name, org, pwph, totpSecret, role, approved, domain};
}

exports.checkPWPH = async (id, pwph) => {
	const idEntry = await exports.existsID(id); if (!idEntry.result) return {result: false}; else delete idEntry.result;
	return {result: await (util.promisify(bcryptjs.compare))(pwph, idEntry.pwph), ...idEntry}; 
}

exports.getTOTPSec = exports.existsID = async id => {
	const rows = await db.getQuery("SELECT * FROM users WHERE id = ? COLLATE NOCASE", [id]);
	if (rows && rows.length) return {result: true, ...(rows[0])}; else return {result: false};
}

exports.changepwph = async (id, pwph) => {
	const pwphHashed = await getUserHash(pwph);
	return {result: await db.runCmd("UPDATE users SET pwph = ? WHERE id = ? COLLATE NOCASE", [pwphHashed, id])};
}

exports.getUsersForOrg = async org => {
	const users = await db.getQuery("SELECT id, name, org, role, approved FROM users WHERE org = ? COLLATE NOCASE", [org]);
	if (users && users.length) return {result: true, users}; else return {result: false};
}

exports.getUsersForDomain = async domain => {
	const users = await db.getQuery("SELECT id, name, org, role, approved FROM users WHERE domain = ? COLLATE NOCASE", [domain]);
	if (users && users.length) return {result: true, users}; else return {result: false};
}

exports.getOrgForDomain = async domain => {
	const users = await db.getQuery("SELECT org FROM users WHERE domain = ? COLLATE NOCASE", [domain]);
	if (users && users.length) return users[0].org; else return null;
}

exports.getOrgsMatching = async org => {
	const orgs = await db.getQuery("SELECT org FROM users WHERE org LIKE ? COLLATE NOCASE", [org]);
	if (orgs && orgs.length) return {result: true, orgs}; else return {result: true, orgs:[]};
}

exports.approve = async id => {
	return {result: await db.runCmd("UPDATE users SET approved=1 WHERE id=?", [id])};
}
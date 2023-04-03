/**
 * User ID management support.
 * (C) 2021 TekMonks. All rights reserved.
 * See enclosed LICENSE file.
 */
const util = require("util");
const path = require("path");
const bcryptjs = require("bcryptjs");
const CONF = require(`${APP_CONSTANTS.CONF_DIR}/app.json`);
const serverutils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const DB_PATH = path.resolve(`${APP_CONSTANTS.DB_DIR}/app.db`);
const DB_CREATION_SQLS = require(`${APP_CONSTANTS.DB_DIR}/dbschema.json`);
const getUserHash = async text => await (util.promisify(bcryptjs.hash))(text, 12);
const ID_BLACK_WHITE_LISTS = require(`${APP_CONSTANTS.CONF_DIR}/idblackwhitelists.json`)
const db = require(`${CONSTANTS.LIBDIR}/db.js`).getDBDriver("sqlite", DB_PATH, DB_CREATION_SQLS);

const idDeletionListeners = [];

exports.initDB = async _ => await db.init();

exports.register = async (id, name, org, pwph, totpSecret, role, approved, verifyEmail=1, domain) => {
	const existsID = await exports.existsID(id);
	if (existsID.result) return({result:false, reason: exports.ID_EXISTS}); 

	const pwphHashed = await getUserHash(pwph);
	const commandsToInsert = [
		{
			cmd: "INSERT INTO users (id, name, org, pwph, totpsec, role, approved, verified, domain) VALUES (?,?,?,?,?,?,?,?,?)",
			params: [id, name, org, pwphHashed, totpSecret, role, approved?1:0, verifyEmail?0:1, domain]
		},
		{
			cmd:`INSERT INTO orgs (name, primary_contact_name, primary_contact_email, address, domain, alternate_names_json) SELECT ? AS name, ? AS primary_contact_name, ? AS primary_contact_email, 'undefined' AS address, ? AS domain, '[]' AS alternate_names_json WHERE NOT EXISTS(SELECT * FROM orgs WHERE name=? COLLATE NOCASE) LIMIT 1;`,
			params: [org, name, id, domain, org]
		},
		{
			cmd: `INSERT OR IGNORE INTO domains (domain, org) values (?,?);`,
			params: [domain, org]
		}
	];
	const registerResult = await db.runTransaction(commandsToInsert);

	return {result: registerResult, id, name, org, pwph: pwphHashed, totpsec: totpSecret, role, 
		approved:approved?1:0, verified:verifyEmail?0:1, domain};
}

exports.delete = async id => {
	const existsID = await exports.existsID(id);
	if (!existsID.result) return({result:false}); 

	for (const idDeletionListener of idDeletionListeners) if (!(await idDeletionListener(id))) return {result: false};

	return {result: await db.runCmd("DELETE FROM users WHERE id = ?", [id])};
}

exports.addIDDeletionListener = listener => idDeletionListeners.push(listener);

exports.update = async (oldid, id, name, org, oldPwphHashed, newPwph, totpSecret, role, approved, domain) => {
	const pwphHashed = newPwph?await getUserHash(newPwph):oldPwphHashed;
	const commandsToUpdate = [
		{
			cmd: "UPDATE users SET id=?, name=?, org=?, pwph=?, totpsec=?, role = ?, approved = ?, domain = ? WHERE id=?", 
			params: [id, name, org, pwphHashed, totpSecret, role, approved, domain, oldid]
		},
		{
			cmd: `INSERT OR IGNORE INTO domains (domain, org) values (?,?);`,
			params: [domain, org]
		}
	];
	const updateResult = await db.runTransaction(commandsToUpdate);

	return {result: updateResult, oldid, id, name, org, pwph: pwphHashed, totpSecret, role, approved, domain};
}

exports.checkPWPH = async (id, pwph) => {
	const idEntry = await exports.existsID(id); if (!idEntry.result) return {result: false, reason: exports.NO_ID}; 
	const pwphCompareResult = await (util.promisify(bcryptjs.compare))(pwph, idEntry.pwph);
	return {...idEntry, result: pwphCompareResult, reason: exports.BAD_PASSWORD}; 
}

exports.existsID = exports.getTOTPSec = async id => {
	const rows = await db.getQuery("SELECT * FROM users WHERE id = ? COLLATE NOCASE", [id]);
	if (rows && rows.length) return {result: true, ...(rows[0])}; else return {result: false};
}

exports.changepwph = async (id, pwph) => {
	const pwphHashed = await getUserHash(pwph);
	return {result: await db.runCmd("UPDATE users SET pwph = ? WHERE id = ? COLLATE NOCASE", [pwphHashed, id])};
}

exports.getUsersForOrg = async org => {
	const users = await db.getQuery("SELECT * FROM users WHERE org = ? COLLATE NOCASE", [org]);
	if (users && users.length) return {result: true, users}; else return {result: false};
}

exports.getUsersForDomain = async domain => {
	const users = await db.getQuery("SELECT * FROM users WHERE domain = ? COLLATE NOCASE", [domain]);
	if (users && users.length) return {result: true, users}; else return {result: false};
}

exports.getOrgForDomain = async domain => {
	const orgs = await db.getQuery("SELECT org FROM domains WHERE domain = ? COLLATE NOCASE", [domain]);
	if (orgs && orgs.length) return orgs[0].org; else return null;
}

exports.getDomainsForOrg = async org => {
	const domains = await db.getQuery("SELECT domain FROM domains WHERE org = ? COLLATE NOCASE", [org]);
	if (domains && domains.length) return _flattenArray(domains, "domain", domain => domain.toLowerCase()); else return null;
}

exports.approve = async id => {
	return {result: await db.runCmd("UPDATE users SET approved=1 WHERE id=?", [id])};
}

exports.verifyEmail = async id => {
	return {result: await db.runCmd("UPDATE users SET verified=1 WHERE id=? AND verified=0", [id])};
}

exports.deleteAllUnverifiedAndExpiredAccounts = async verificationExpiryInSeconds => {
	const unverifiedRows = await db.getQuery(`SELECT * FROM users WHERE verified=0 AND ${serverutils.getUnixEpoch()}-registerdate>=${verificationExpiryInSeconds}`, 
		[]);
	if ((!unverifiedRows) || (!Array.isArray(unverifiedRows))) {LOG.error("Error deleting unverified accounts due to DB error."); return {result: false};}
	const usersDropped = []; for (const unverifiedRow of unverifiedRows) 
		if ((await exports.delete(unverifiedRow.id)).result) usersDropped.push(unverifiedRow);
	return {result: true, usersDropped};
}

exports.updateLoginStats = async (id, date, ip="unknown") => {
	const rows = (await db.getQuery("SELECT * FROM users WHERE id = ? COLLATE NOCASE", [id]))[0];
	const currentLoginsAndIPsJSON = JSON.parse(rows.loginsandips_json||"[]"); currentLoginsAndIPsJSON.unshift({date, ip});
	const maxLoginsToRemember = CONF.max_logins_to_remember||100;
	if (currentLoginsAndIPsJSON.length > maxLoginsToRemember) currentLoginsAndIPsJSONawait = currentLoginsAndIPsJSON.slice(0, maxLoginsToRemember);
	await db.runCmd("UPDATE users SET lastlogin=?, lastip=?, loginsandips_json=? WHERE id=?", [date, ip, 
		JSON.stringify(currentLoginsAndIPsJSON), id]);
}

exports.getAdminsFor = async id => {
	const admins = await db.getQuery("SELECT * FROM users WHERE role = 'admin' AND org = (select org from users where id = ? COLLATE NOCASE) COLLATE NOCASE", [id]);
	if (admins && admins.length) return admins; else return null;
}

exports.shouldAllowDomain = async domain => {
	const orgMainDomain = _flattenArray(	// check if this domain is registered already and if so check its main domain in the whitelist
		await db.getQuery("SELECT domain FROM orgs WHERE name IN (SELECT org FROM domains WHERE domain=? COLLATE NOCASE LIMIT 1);",[domain]),
		"domain", domain => domain.toLowerCase())[0];

	// if in whitelist only mode activated so check if this domain or this org's main domain is whitelisted
	if (CONF.id_whitelist_mode) return ID_BLACK_WHITE_LISTS.whitelist.includes(orgMainDomain||domain.toLowerCase());	
	// blacklist check
	if (CONF.id_blacklist_mode) return (!ID_BLACK_WHITE_LISTS.blacklist.includes(domain.toLowerCase()));	
	
}

exports.addOrUpdateOrg = async (name, primary_contact_name, primary_contact_email, address, domain, alternate_names, alternate_domains) => {
	const alternate_names_json = JSON.stringify(alternate_names), transactions = [];
	transactions.push({cmd: "INSERT INTO orgs (name, primary_contact_name, primary_contact_email, address, domain, alternate_names_json) values (?,?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET primary_contact_name=?, primary_contact_email=?, address=?, domain=?, alternate_names_json=?", 
		params:[name, primary_contact_name, primary_contact_email, address, domain, alternate_names_json, 
			primary_contact_name, primary_contact_email, address, domain, alternate_names_json]});
	transactions.push({cmd:"DELETE FROM domains WHERE org = ?", params: [name]});
	for (const domainThis of [...alternate_domains, domain]) transactions.push({
		cmd: "INSERT INTO DOMAINS (domain, org) VALUES (?,?)", params: [domainThis, name]});

	return {result: await db.runTransaction(transactions), name, primary_contact_name, 
		primary_contact_email, address, domain, alternate_names, alternate_domains};
}

exports.getOrgsMatching = async org => {
	const orgs = await db.getQuery("SELECT DISTINCT name FROM orgs WHERE name LIKE ? COLLATE NOCASE", [org]);
	if (orgs && orgs.length) return {result: true, orgs}; else return {result: true, orgs:[]};
}

exports.getOrg = async org => {
	const orgs = await db.getQuery("SELECT * FROM orgs WHERE name is ? COLLATE NOCASE", [org]);
	if (orgs && orgs.length) return {result: true, ...orgs[0]}; else return {result: false};
}

exports.deleteOrg = async org => {
	[{cmd:"DELETE FROM users WHERE org = ?", params: [org]},
		{cmd:"DELETE FROM domains WHERE org = ?", params: [org]}, {cmd:"DELETE FROM orgs WHERE org = ?", params: [org]}];

	return {result: await db.runTransaction(deleteDrops), org};
}

exports.addDomain = async (domain, org) => {
	return {result: await db.runCmd("INSERT OR IGNORE INTO DOMAINS (domain, org) VALUES (?,?)", [domain, org]), domain, org};
}

exports.deleteDomain = async domain => {
	return {result: await db.runCmd("DELETE FROM domain WHERE domain = ?", [domain]), domain};
}

function _flattenArray(results, columnName, functionToCall) { 
	if (!results) return [];
	const retArray = []; for (const result of results) retArray.push(
		functionToCall?functionToCall(result[columnName]):result[columnName]); return retArray;
}

exports.ID_EXISTS = "useridexists"; exports.NO_ID = "noid"; exports.BAD_PASSWORD = "badpassword";
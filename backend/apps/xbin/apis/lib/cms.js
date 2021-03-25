/* 
 * (C) 2020 TekMonks. All rights reserved.
 */
const fspromises = require("fs").promises;
const login = require(`${API_CONSTANTS.API_DIR}/login.js`);
const CONF = require(`${API_CONSTANTS.CONF_DIR}/xbin.json`);

exports.getCMSRoot = function(headers) {
	let loginID = login.getID(headers); if (!loginID) throw "No login for CMS root"; else loginID = loginID.toLowerCase();
	let org = login.getOrg(headers); org = org?org.toLowerCase():"unknown";
	if (loginID) return `${CONF.CMS_ROOT}/${encodeURIComponent(org)}/${encodeURIComponent(loginID)}`;
	else throw "Bad user or no user logged in";
}

exports.initID = async function(headers) {
    try {await fspromises.access(this.getCMSRoot(headers), fs.F_OK)} catch (err) {
        await fspromises.mkdir(this.getCMSRoot(headers), {recursive: true});}
}
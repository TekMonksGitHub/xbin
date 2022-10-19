/**
 * Registers a new user. 
 * (C) 2015 TekMonks. All rights reserved.
 */
const mustache = require('mustache');
const utils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const crypt = require(`${CONSTANTS.LIBDIR}/crypt.js`);
const totp = require(`${APP_CONSTANTS.LIB_DIR}/totp.js`);
const CONF = require(`${API_CONSTANTS.CONF_DIR}/app.json`);
const mailer = require(`${APP_CONSTANTS.LIB_DIR}/mailer.js`);
const userid = require(`${APP_CONSTANTS.LIB_DIR}/userid.js`);
const queueExecutor = require(`${CONSTANTS.LIBDIR}/queueExecutor.js`);
const emailTemplate = require(`${APP_CONSTANTS.CONF_DIR}/email.json`);

const DEFAULT_QUEUE_DELAY = 500;

exports.doService = async (jsonReq, servObject) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got register request for ID: " + jsonReq.id);

	if (!totp.verifyTOTP(jsonReq.totpSecret, jsonReq.totpCode)) {
		LOG.error(`Unable to register: ${jsonReq.name}, ID: ${jsonReq.id}, wrong totp code`);
		return CONSTANTS.FALSE_RESULT;
	}

	await exports.updateOrgAndDomain(jsonReq);	// set domain and override org if needed

	const existingUsersForDomain = await userid.getUsersForDomain(_getRootDomain(jsonReq)), 
		existingUsersForOrg = await userid.getUsersForOrg(jsonReq.org), 
		notFirstUserForThisDomain = existingUsersForDomain && existingUsersForDomain.result && existingUsersForDomain.users.length,
		notFirstUserForThisOrg = existingUsersForOrg && existingUsersForOrg.result && existingUsersForOrg.users.length,
		approved = notFirstUserForThisOrg||notFirstUserForThisDomain?0:1, 
		role = notFirstUserForThisOrg||notFirstUserForThisDomain?"user":"admin";

	const result = await userid.register(jsonReq.id, jsonReq.name, jsonReq.org, jsonReq.pwph, jsonReq.totpSecret, role, 
		approved, jsonReq.domain);
	if (!result.result) LOG.error(`Unable to register: ${jsonReq.name}, ID: ${jsonReq.id} DB error.`);

	if (result.result && APP_CONSTANTS.CONF.verify_email_on_registeration) {
		let mailVerificationResult = false; try{mailVerificationResult = _emailAccountVerification(result.id, result.name, result.org, jsonReq.lang);} catch (err) {}
		if (!mailVerificationResult) {
			try {userid.delete(id)} catch(_) {};	// try to drop the account
			LOG.info(`Unable to register: ${jsonReq.name}, ID: ${jsonReq.id} verification email error.`); 
			result.result = false;	// email verification is needed, and failed
		}
	}

	if (result.result) {
		LOG.info(`User registered: ${jsonReq.name}, ID: ${jsonReq.id}, approval status is: ${result.approved}`); 
		queueExecutor.add(userid.updateLoginStats, [jsonReq.id, Date.now(), utils.getClientIP(servObject.req)], true, 
			CONF.login_update_delay||DEFAULT_QUEUE_DELAY);
	}
	
	return {result: result.result, name: result.name, id: result.id, org: result.org, role: result.role, 
		needs_verification: APP_CONSTANTS.CONF.verify_email_on_registeration, tokenflag: result.approved?true:false};
}

exports.updateOrgAndDomain = async jsonReq => {
	const rootDomain = _getRootDomain(jsonReq);
	const existingUsersForDomain = await userid.getUsersForDomain(rootDomain);
	if (existingUsersForDomain && existingUsersForDomain.result && existingUsersForDomain.users.length) 
		jsonReq.org = (await userid.getOrgForDomain(rootDomain))||jsonReq.org;	// if this domain already exists, override the org to the existing organization
	jsonReq.domain = rootDomain;
}

function _getRootDomain(jsonReq) {
	const domain = jsonReq.id.indexOf("@") != -1 ? jsonReq.id.substring(jsonReq.id.indexOf("@")+1) : "undefined"
	return domain;
}

async function _emailAccountVerification(id, name, org, lang) {
	const cryptID = crypt.encrypt(id), cryptTime = crypt.encrypt(utils.getUnixEpoch().toString()), 
        action_url = APP_CONSTANTS.CONF.base_url + Buffer.from(`${APP_CONSTANTS.CONF.verify_url}?e=${cryptID}&t=${cryptTime}`).toString("base64"),
        button_code_pre = mustache.render(emailTemplate.button_code_pre, {action_url}), 
			button_code_post = mustache.render(emailTemplate.button_code_post, {action_url}),
        email_title = mustache.render(emailTemplate[`${lang||"en"}_verifyemail_title`], {name, org, action_url}),
        email_html = mustache.render(emailTemplate[`${lang||"en"}_verifyemail_html`], {name, org, button_code_pre,
			button_code_post}),
        email_text = mustache.render(emailTemplate[`${lang||"en"}_verifyemail_text`], {name, org, action_url});

	return await mailer.email(id, email_title, email_html, email_text);
}

const validateRequest = jsonReq => (jsonReq && jsonReq.pwph && jsonReq.id && jsonReq.name && jsonReq.org && 
	jsonReq.totpSecret && jsonReq.totpCode && jsonReq.lang);
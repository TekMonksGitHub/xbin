/**
 * Adds a new user - Admin API. Will fill in random password
 * and random TOTP secret. The login URL will allow the user
 * to adjust both.
 * (C) 2020 TekMonks. All rights reserved.
 */
const mustache = require('mustache');
const crypt = require(`${CONSTANTS.LIBDIR}/crypt.js`);
const totp = require(`${APP_CONSTANTS.LIB_DIR}/totp.js`);
const login = require(`${APP_CONSTANTS.API_DIR}/login.js`);
const mailer = require(`${APP_CONSTANTS.LIB_DIR}/mailer.js`);
const register = require(`${APP_CONSTANTS.API_DIR}/register.js`);
const template = require(`${APP_CONSTANTS.CONF_DIR}/email.json`);

exports.doService = async (jsonReq, servObject, headers) => {
    if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
    
    LOG.debug("Got add user request for ID: " + jsonReq.id);

    const result = await register.addUser({pwph: '', id: jsonReq.id, name: jsonReq.name, org: jsonReq.org,
        totpSecret: totp.getSecret(), lang: jsonReq.lang, role: jsonReq.role, verifyEmail : 0,
        approved: (jsonReq.approved==true||jsonReq.approved==1)?1:0}, servObject, true);

    if (result.result) {
        LOG.info(`User registered ${jsonReq.name}, ID: ${jsonReq.id}, by admin with ID: ${login.getID(headers)}, emailing them initial login instructions.`); 

        const cryptID = crypt.encrypt(jsonReq.id), cryptTime = crypt.encrypt(Date.now().toString()), 
            action_url = APP_CONSTANTS.CONF.base_url + Buffer.from(`${APP_CONSTANTS.CONF.initiallogin_url}?e=${cryptID}&t=${cryptTime}`).toString("base64"),
            button_code_pre = mustache.render(template.button_code_pre, {action_url}), button_code_post = mustache.render(template.button_code_post, {action_url}),
            email_title = mustache.render(template[`${jsonReq.lang}_adduser_title`], {name: jsonReq.name, org: jsonReq.org, action_url}),
            email_html = mustache.render(template[`${jsonReq.lang}_adduser_email_html`], {name: jsonReq.name, org: jsonReq.org, button_code_pre, button_code_post}),
            email_text = mustache.render(template[`${jsonReq.lang}_adduser_email_text`], {name: jsonReq.name, org: jsonReq.org, action_url});

        const emailResult = await mailer.email(jsonReq.id, email_title, email_html, email_text);
        if (!emailResult) LOG.error(`Unable to email inital login instructions for ${jsonReq.name}, ID: ${jsonReq.id}. Initial login URL is ${action_url}`); 
        
        return {result: true, emailresult: emailResult, loginurl: action_url};
    } else {
        LOG.error(`Unable to register: ${jsonReq.name}, ID: ${jsonReq.id} DB error`);
        return CONSTANTS.FALSE_RESULT;
    }
}
 
const validateRequest = jsonReq => (jsonReq && jsonReq.id && jsonReq.name && jsonReq.org && jsonReq.role && 
    jsonReq.approved && jsonReq.lang);
 
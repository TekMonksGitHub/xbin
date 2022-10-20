/**
 * Email module.
 * 
 * (C) 2020 TekMonks. All rights reserved.
 * See enclosed LICENSE file.
 */
const crypt = require(CONSTANTS.LIBDIR+"/crypt.js");
const conf = require(`${APP_CONSTANTS.CONF_DIR}/smtp.json`);
const serverMailer = require(CONSTANTS.LIBDIR+"/mailer.js");

module.exports.email = async function(to, title, email_html, email_text) {
    const auth = {user: conf.user, pass: crypt.decrypt(conf.password)};
    const smtpConfig = {server: conf.server, port: conf.port, secure: conf.secure, from: conf.from};
    return (await serverMailer.email(to, title, email_html, email_text, smtpConfig, auth));
}
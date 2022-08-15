/**
 * Email module.
 * 
 * (C) 2020 TekMonks. All rights reserved.
 * See enclosed LICENSE file.
 */
const nodemailer = require("nodemailer");
const crypt = require(CONSTANTS.LIBDIR+"/crypt.js");
const conf = require(`${APP_CONSTANTS.CONF_DIR}/smtp.json`);

module.exports.email = async function(to, title, email_html, email_text) {
    const smtpConfig = { pool: true, host: conf.server, port: conf.port, secure: conf.secure,
            auth: {user: conf.user, pass: crypt.decrypt(conf.password)} },
        transporter = nodemailer.createTransport(smtpConfig);

    try {
        await transporter.sendMail({"from": conf.from, "to": to, "subject": title, "text": email_text, "html": email_html});
        return true;
    } catch (err) {
        LOG.error(`Email send failed due to ${err}`);
        return false;
    }
}
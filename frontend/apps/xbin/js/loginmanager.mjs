/* 
 * (C) 2018 TekMonks. All rights reserved.
 * License: MIT - see enclosed license.txt file.
 */
import {apimanager as apiman} from "/framework/js/apimanager.mjs";
import {application} from "./application.mjs";
import {session} from "/framework/js/session.mjs";
import {securityguard} from "/framework/js/securityguard.mjs";

async function signin(id, pass) {
    let pwph = `${id} ${pass}`;
        
    return new Promise(async (resolve, _reject) => {
        await $$.require(`${APP_CONSTANTS.APP_PATH}/3p/bcrypt.js`);
        let bcrypt = dcodeIO.bcrypt;
        bcrypt.hash(pwph, APP_CONSTANTS.BCRYPT_SALT, async (_err, hash) => {
            let req = {}; req[APP_CONSTANTS.USERID] = hash;
            let resp = await apiman.rest(APP_CONSTANTS.API_LOGIN, "POST", req, false, true);
            if (resp && resp.result) {
                session.set(APP_CONSTANTS.USERID, hash); 
                securityguard.setCurrentRole(APP_CONSTANTS.USER_ROLE);
                resolve(true);
            } else resolve(false);
        });
    });
}

async function register(regid, pass) {
    let pwph = `${regid} ${pass}`;

    return new Promise(async (resolve, _reject) => {
        await $$.require(`${APP_CONSTANTS.APP_PATH}/3p/bcrypt.js`);
        let bcrypt = dcodeIO.bcrypt;
        bcrypt.hash(pwph, APP_CONSTANTS.BCRYPT_SALT, async (_err, hash) => {
            let req = {}; req[APP_CONSTANTS.USERID] = hash; req["user"] = regid;
            let resp = await apiman.rest(APP_CONSTANTS.API_REGISTER, "POST", req, true, false);
            if (resp && resp.result) {
                session.set(APP_CONSTANTS.USERID, hash); 
                securityguard.setCurrentRole(APP_CONSTANTS.USER_ROLE);
                resolve(true);
            } else resolve(false);
        });
    });
}

function logout() {
    let savedLang = session.get($$.MONKSHU_CONSTANTS.LANG_ID);
	session.destroy(); securityguard.setCurrentRole(APP_CONSTANTS.GUEST_ROLE);
    session.set($$.MONKSHU_CONSTANTS.LANG_ID, savedLang);
	application.main();
}

export const loginmanager = {signin, register, logout}
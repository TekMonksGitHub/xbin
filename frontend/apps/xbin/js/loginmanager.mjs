/* 
 * (C) 2018 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */
import {i18n} from "/framework/js/i18n.mjs";
import {application} from "./application.mjs";
import {router} from "/framework/js/router.mjs";
import {session} from "/framework/js/session.mjs";
import {securityguard} from "/framework/js/securityguard.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";

let currTimeout, logoutListeners = [];

async function signin(id, pass, otp) {
    const pwph = `${id} ${pass}`;
    logoutListeners = [];   // reset listeners on sign in
        
    const resp = await apiman.rest(APP_CONSTANTS.API_LOGIN, "POST", {pwph, otp, id}, false, true);
    if (!resp) {LOG.warn(`Unknown reason for login failure for ${id}. Null response.`); return loginmanager.ID_INTERNAL_ERROR;}
    if (resp && resp.tokenflag) {   // login successful, JWT has been generated
        session.set(APP_CONSTANTS.USERID, resp.id); 
        session.set(APP_CONSTANTS.USERNAME, resp.name);
        session.set(APP_CONSTANTS.USERORG, resp.org);
        session.set("__org_telemeet_cuser_pass", pass);
        session.set(APP_CONSTANTS.USER_NEEDS_VERIFICATION, resp.verified);
        securityguard.setCurrentRole(resp.role);
        LOG.info(`Login succeeded for ${id}.`);
        return resp.verified?loginmanager.ID_OK:loginmanager.ID_OK_NOT_YET_VERIFIED;
    } else if (resp.reason == "notapproved") {  // failed due to not approved   
        LOG.warn(`Login OK but not approved yet for ${id}.`); return loginmanager.ID_OK_NOT_YET_APPROVED;
    } else if (resp.reason == "badpw") { // failed due to bad password
        LOG.warn(`Bad password for ${id}.`); return loginmanager.ID_FAILED_PASSWORD;
    } else if (resp.reason == "badid") {    // failed due to bad ID
        LOG.warn(`Bad ID given for ${id}.`); return loginmanager.ID_FAILED_MISSING;
    } else if (resp.reason == "badotp") {   // failed due to bad OTP
        LOG.warn(`Bad OTP given for ${id}.`); return loginmanager.ID_FAILED_OTP;
    } else if (resp.reason == "domainerror") {    // failed due to domain error
        LOG.warn(`Domain error for ${id}.`); return loginmanager.ID_DOMAIN_ERROR;
    } else {    // failed due to some internal error
        LOG.warn(`Unknown reason for login failure for ${id}.`); return loginmanager.ID_INTERNAL_ERROR;
    }
}

const reset = id => apiman.rest(APP_CONSTANTS.API_RESET, "GET", {id, lang: i18n.getSessionLang()});

async function registerOrUpdate(old_id, name, id, pass, org, totpSecret, totpCode, role, approved) {
    const pwph = `${id} ${pass||session.get("__org_telemeet_cuser_pass")}`;

    const req = {old_id, name, id: (old_id && session.get(APP_CONSTANTS.USERID))?session.get(APP_CONSTANTS.USERID):id, 
        pwph, org, totpSecret, totpCode, role, approved, lang: i18n.getSessionLang(), new_id: old_id?id:undefined}; 
    const resp = await apiman.rest(old_id?APP_CONSTANTS.API_UPDATE:APP_CONSTANTS.API_REGISTER, "POST", req, old_id?true:false, true);
    if (!resp) {LOG.error(`${old_id?"Update":"Registration"} failed for ${id} due to internal error. Null response.`); return loginmanager.ID_INTERNAL_ERROR;}
    else if (!resp.result) {    // registration failed, reasons can be bad OTP, ID exists or some internal error
        LOG.error(`${old_id?"Update":"Registration"} failed for ${id} due to ${resp.reason}.`); 
        return resp.reason=="exists"?loginmanager.ID_FAILED_EXISTS:resp.reason=="otp"?loginmanager.ID_FAILED_OTP:
        resp.reason=="securityerror"?loginmanager.ID_SECURITY_ERROR:resp.reason=="domainerror"?loginmanager.ID_DOMAIN_ERROR:
        loginmanager.ID_INTERNAL_ERROR;
    } else if (resp.result && resp.tokenflag) { // registration/update succeeded and JWT token is generated, so login can proceed
        session.set(APP_CONSTANTS.USERID, id); 
        session.set(APP_CONSTANTS.USERNAME, name);
        session.set(APP_CONSTANTS.USERORG, org);
        session.set(APP_CONSTANTS.USER_NEEDS_VERIFICATION, resp.needs_verification);
        session.set("__org_telemeet_cuser_pass", pass);
        securityguard.setCurrentRole(resp.role);
        return loginmanager.ID_OK;
    } else if (resp.result && (!resp.approved)) {   // registration/update succeeded but no token, so approval is probably pending
        LOG.warn(`${old_id?"Update":"Registration"} done but not approved yet for ${id}.`); 
        return loginmanager.ID_OK_NOT_YET_APPROVED;
    } 
}

async function changepassword(id, pass) {
    const pwph = `${id} ${pass}`;
        
    const resp = await apiman.rest(APP_CONSTANTS.API_CHANGEPW, "POST", {id, pwph}, true, false);
    if (resp && resp.result) return true;
    else {LOG.error(`Password change failed for ${id}`); return false;}
}

const addLogoutListener = listener => logoutListeners.push(listener);

async function logout(dueToTimeout) {
    for (const listener of logoutListeners) await listener();
    _stopAutoLogoutTimer(); 

    const savedLang = session.get($$.MONKSHU_CONSTANTS.LANG_ID);
    session.remove(APP_CONSTANTS.USERID); session.remove(APP_CONSTANTS.USERNAME);
    session.remove(APP_CONSTANTS.USERORG); session.remove("__org_telemeet_cuser_pass");
    session.set($$.MONKSHU_CONSTANTS.LANG_ID, savedLang);     securityguard.setCurrentRole(APP_CONSTANTS.GUEST_ROLE);
    
    if (dueToTimeout) application.main(APP_CONSTANTS.ERROR_HTML, {error: await i18n.get("Timeout_Error"), 
        button: await i18n.get("Relogin"), link: router.encodeURL(APP_CONSTANTS.LOGIN_HTML)}); 
    else application.main(APP_CONSTANTS.LOGIN_HTML);
}

async function checkResetSecurity() {
    const pageData = await router.getPageData(router.getCurrentURL()); 
    if (!pageData.url.e || pageData.url.e == "" || !pageData.url.t || pageData.url.e == "") router.doIndexNavigation();
}

const getSessionUser = _ => { return {id: session.get(APP_CONSTANTS.USERID), name: session.get(APP_CONSTANTS.USERNAME),
    org: session.get(APP_CONSTANTS.USERORG)} }

async function getProfileData(id, time) {
    const resp = await apiman.rest(APP_CONSTANTS.API_GETPROFILE, "GET", {id, time}, false, true);
    if (resp && resp.result) return resp; else return null;
}

function startAutoLogoutTimer() { return;
    if (!session.get(APP_CONSTANTS.USERID)) return; // no one is logged in
    
    const events = ["load", "mousemove", "mousedown", "click", "scroll", "keypress"];
    const resetTimer = _=> {_stopAutoLogoutTimer(); currTimeout = setTimeout(_=>logout(true), APP_CONSTANTS.TIMEOUT);}
    for (const event of events) {document.addEventListener(event, resetTimer);}
    resetTimer();   // start the timing
}

const interceptPageLoad = _ => router.addOnLoadPage("*", startAutoLogoutTimer); 

const _stopAutoLogoutTimer = _ => { if (currTimeout) {clearTimeout(currTimeout); currTimeout = null;} }

export const loginmanager = {signin, reset, registerOrUpdate, logout, changepassword, startAutoLogoutTimer, 
    addLogoutListener, getProfileData, checkResetSecurity, getSessionUser, interceptPageLoad, 
    ID_OK: 1, ID_FAILED_EXISTS: -4, ID_FAILED_OTP: -5, ID_OK_NOT_YET_APPROVED: -1, 
    ID_INTERNAL_ERROR: -2, ID_DB_ERROR: -3, ID_OK_NOT_YET_VERIFIED: 2, ID_FAILED_PASSWORD: -6, ID_FAILED_MISSING: -7,
    ID_SECURITY_ERROR: -8, ID_DOMAIN_ERROR: -9}
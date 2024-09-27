/* 
 * (C) 2020 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */
import {loginmanager} from "./loginmanager.mjs"

const dialog = _ => monkshu_env.components['dialog-box'];

function toggleMenu() {
    const imgElement = document.querySelector("span#menubutton > img"), menuIsOpen = imgElement.src.indexOf("menu.svg") != -1;
    const menuDiv = document.querySelector("div#menu");

    if (menuIsOpen) {    
        menuDiv.classList.add("visible"); menuDiv.style.maxHeight = menuDiv.scrollHeight+"px"; 
        imgElement.src = "./img/menu_close.svg";
    } else {
        menuDiv.classList.remove("visible"); menuDiv.style.maxHeight = 0; 
        imgElement.src = "./img/menu.svg";
    }
}

async function changePassword(_element) {
    dialog().showDialog(`${APP_CONSTANTS.DIALOGS_PATH}/changepass.html`, true, true, {}, "dialog", ["p1","p2"], async result=>{
        const done = await loginmanager.changepassword($$.libsession.get(APP_CONSTANTS.USERID), result.p1);
        if (!done) dialog().error("dialog", await $$.libi18n.get("PWCHANGEFAILED"));
        else { dialog().hideDialog("dialog"); _showMessage(await $$.libi18n.get("PWCHANGED")); }
    });
}

async function showOTPQRCode(_element) {
    const id = $$.libsession.get(APP_CONSTANTS.USERID).toString(); 
    const totpSec = await $$.libapimanager.rest(APP_CONSTANTS.API_GETTOTPSEC, "GET", {id}, true, false); if (!totpSec || !totpSec.result) return;
    const qrcode = await _getTOTPQRCode(totpSec.totpsec);
    dialog().showDialog(`${APP_CONSTANTS.DIALOGS_PATH}/changephone.html`, true, true, {img:qrcode}, "dialog", ["otpcode"], async result => {
        const otpValidates = await $$.libapimanager.rest(APP_CONSTANTS.API_VALIDATE_TOTP, "GET", {totpsec: totpSec.totpsec, otp:result.otpcode, id}, true, false);
        if (!otpValidates||!otpValidates.result) dialog().error("dialog", await $$.libi18n.get("PHONECHANGEFAILED"));
        else dialog().hideDialog("dialog");
    });
}

async function changeProfile(_element) {
    const sessionUser = loginmanager.getSessionUser();
    dialog().showDialog(`${APP_CONSTANTS.DIALOGS_PATH}/resetprofile.html`, true, true, sessionUser, "dialog", 
            ["name", "id", "org"], async result => {
        
        const updateResult = await loginmanager.registerOrUpdate(sessionUser.id, result.name, result.id, null, result.org);
        if (updateResult == loginmanager.ID_OK) dialog().hideDialog("dialog");
        else {
            let errorKey = "Internal"; switch (updateResult)
            {
                case loginmanager.ID_FAILED_EXISTS: errorKey = "Exists"; break;
                case loginmanager.ID_FAILED_OTP: errorKey = "OTP"; break;
                case loginmanager.ID_INTERNAL_ERROR: errorKey = "Internal"; break;
                case loginmanager.ID_DB_ERROR: errorKey = "Internal"; break;
                case loginmanager.ID_SECURITY_ERROR: errorKey = "SecurityError"; break;
                case loginmanager.ID_DOMAIN_ERROR: errorKey = "DomainError"; break;
                default: errorKey = "Internal"; break;
            }
            dialog().error("dialog", await $$.libi18n.get(`ProfileChangedFailed${errorKey}`));
        }
    });
}

function showLoginMessages() {
    const data = $$.librouter.getCurrentPageData();
    if (data.showDialog) { _showMessage(data.showDialog.message); delete data.showDialog; $$.librouter.setCurrentPageData(data); }
}

const logoutClicked = _ => loginmanager.logout();

const interceptPageData = _ => $$.librouter.addOnLoadPageData(APP_CONSTANTS.MAIN_HTML, async data => {   // set admin role if applicable
    if ($$.libsecurityguard.getCurrentRole()==APP_CONSTANTS.ADMIN_ROLE) data.admin = true; 
});

async function _getTOTPQRCode(key) {
	const title = await $$.libi18n.get("Title");
	await $$.require(`${APP_CONSTANTS.COMPONENTS_PATH}/register-box/3p/qrcode.min.js`);
	return new Promise(resolve => QRCode.toDataURL(
	    `otpauth://totp/${title}?secret=${key}&issuer=TekMonks&algorithm=sha1&digits=6&period=30`, (_, data_url) => resolve(data_url)));
}

const _showMessage = message => dialog().showMessage(message, "dialog");
export const main = {toggleMenu, changePassword, showOTPQRCode, showLoginMessages, changeProfile, logoutClicked, interceptPageData}
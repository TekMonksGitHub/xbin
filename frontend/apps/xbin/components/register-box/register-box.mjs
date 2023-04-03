/** 
 * Helps with profile registration as well as resets.
 * 
 * The dataOnSuccess attribute contains the following
 * fields - name, id, org, role, and needs_verification if
 * the email needs to be verified by the user.
 *
 * (C) 2018 TekMonks. All rights reserved.
 * License: See enclosed license file.
 */
import {base32} from "./3p/base32.mjs";
import {i18n} from "/framework/js/i18n.mjs";
import {util} from "/framework/js/util.mjs";
import {router} from "/framework/js/router.mjs";
import {session} from "/framework/js/session.mjs";
import {loginmanager} from "../../js/loginmanager.mjs";
import {securityguard} from "/framework/js/securityguard.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

const COMPONENT_PATH = util.getModulePath(import.meta), DIALOGS_PATH = `${COMPONENT_PATH}/dialogs`;
let API_GETMATCHINGORGS;

let conf, dialog_box;

async function elementConnected(host) {
	if (window.monkshu_env.components["dialog-box"]) dialog_box = window.monkshu_env.components["dialog-box"];
	else dialog_box = (await import("./subcomponents/dialog-box/dialog-box.mjs"))["dialog_box"];

	API_GETMATCHINGORGS = `${host.getAttribute("apiPath")}/getorgsmatching`;

	conf = await $$.requireJSON(`${COMPONENT_PATH}/conf/config.json`);
	const data = {COMPONENT_PATH};

	if (host.getAttribute("styleBody")) data.styleBody = `<style>${host.getAttribute("styleBody")}</style>`;

	const memory = register_box.getMemory(host.id), type = host.getAttribute("type");
	memory.totpKey = _getTOTPRandomKey(); memory.type = type;
	data.totpQRCodeData = await _getTOTPQRCode(memory.totpKey); 
	data.totpURL = await _getTOTPURL(memory.totpKey);
	data.AuthenticatorMsg = await i18n.get(type == "reset"?"ResetAuthenticatorMsg":"DownloadAuthenticatorMsg");
	data.Password = await i18n.get(type == "reset"?"NewPassword":"Password");
	data.PasswordAgain = await i18n.get(type == "reset"?"NewPasswordAgain":"PasswordAgain");
	data.Submit = await i18n.get(type == "reset"?"Modify" : type=="initial" ? "SignIn" : "Register");
	data.minlength = host.getAttribute("minlength"); data.initial = type == "initial"?true:undefined;
	data.reset = type == "reset"?true:undefined; data.SUBCOMPONENTS_PATH = `${COMPONENT_PATH}/subcomponents`;
	if (host.getAttribute("email") && host.getAttribute("time") && (type == "reset" || type == "initial")) 
		await _checkAndFillAccountProfile(data, host.getAttribute("email"), host.getAttribute("time"));
	data.authLink = conf[`authLink_${$$.getOS()}`];
	if ($$.isMobile()) {
		let mobileQueries = host.getAttribute("mobileQueries"); try {mobileQueries = JSON.parse(mobileQueries)} catch (err) {mobileQueries = {}};
		data.MOBILE_MEDIA_QUERY_START = mobileQueries.start||`<style>@media only screen and (max-width: ${conf.mobileBreakpoint}) {`;
		data.MOBILE_MEDIA_QUERY_END = mobileQueries.end||"}</style>"; data.IS_MOBILE_PLATFORM = true;
	}

	register_box.setData(host.id, data);
}

async function initialRender(host) {
	if (host.getAttribute("type") != "reset") return;

	// for profile updates OTP is optional
	const otpInput = register_box.getShadowRootByHostId(host.getAttribute("id")).querySelector("input#otp");
	otpInput.removeAttribute("required"); otpInput.removeAttribute("minlength"); otpInput.removeAttribute("oninvalid");
}

async function registerOrUpdate(element) {	
	const shadowRoot = register_box.getShadowRootByContainedElement(element); _resetUI(shadowRoot); 
	if (!_validateForm(shadowRoot)) return;
	const memory = register_box.getMemoryByContainedElement(element);

	const nameSelector = shadowRoot.querySelector("input#name"); const name = nameSelector.value;
	const idSelector = shadowRoot.querySelector("input#id"); const id = idSelector.value.toLowerCase();
	const id_old = register_box.getHostElement(element).getAttribute("email") ? shadowRoot.querySelector("input#oldid").value.toLowerCase() : undefined;
	const passSelector = shadowRoot.querySelector("password-box#pass1"); const pass = passSelector.value;
	const orgSelector = shadowRoot.querySelector("input#org"); const org = orgSelector.value;
	const totpCodeSelector = shadowRoot.querySelector("input#otp"); const totpCode = totpCodeSelector.value && totpCodeSelector.value != ""?totpCodeSelector.value:null;
	const routeOnSuccess = register_box.getHostElement(element).getAttribute("routeOnSuccess");
	const routeOnNotApproved = register_box.getHostElement(element).getAttribute("routeOnNotApproved");

	_showWait(shadowRoot);
	const registerResult = await loginmanager.registerOrUpdate(id_old, name, id, pass, org, totpCode?memory.totpKey:null, totpCode);
	_hideWait(shadowRoot);

	const dataOnSuccess = JSON.parse(await router.expandPageData(register_box.getHostElement(element).getAttribute("dataOnSuccess")||"{}",
		undefined, {name, id, org, role: securityguard.getCurrentRole(), needs_verification: session.get(APP_CONSTANTS.USER_NEEDS_VERIFICATION)}));

	switch (registerResult) {
		case loginmanager.ID_OK: router.loadPage(routeOnSuccess, dataOnSuccess); break;
		case loginmanager.ID_OK_NOT_YET_APPROVED: router.loadPage(routeOnNotApproved, dataOnSuccess); break;

		case loginmanager.ID_FAILED_OTP: shadowRoot.querySelector("span#errorOTP").style.display = "inline"; break;
		case loginmanager.ID_FAILED_EXISTS: shadowRoot.querySelector("span#errorExists").style.display = "inline"; break;
		case loginmanager.ID_INTERNAL_ERROR: shadowRoot.querySelector("span#errorInternal").style.display = "inline"; break;
		case loginmanager.ID_SECURITY_ERROR: shadowRoot.querySelector("span#errorSecurity").style.display = "inline"; break;
		case loginmanager.ID_DOMAIN_ERROR: shadowRoot.querySelector("span#errorDomain").style.display = "inline"; break;
		default: shadowRoot.querySelector("span#errorInternal").style.display = "inline"; break;
	}
}

async function openAuthenticator(containedElement, totpURL) {
	const secret = new URL(totpURL).searchParams.get("secret"), newURL = await _getTOTPURL(secret, register_box.getHostElement(containedElement));
	if ($$.getOS() == "ios") dialog_box.showDialog(`${DIALOGS_PATH}/ios_totp_message.html`, false, false, {totpURL, secret}, "register_box_dialog");
	else window.open(newURL);
}

async function updateOrgDataList(org, datalist) {
	util.removeAllChildElements(datalist);
	const resp = await apiman.rest(API_GETMATCHINGORGS, "GET", {org}); if (!resp || !resp.orgs) return;  
	for (const org of resp.orgs) datalist.appendChild(new Option(org, org));
}

function _validateForm(shadowRoot) {
	const name = shadowRoot.querySelector("input#name"), id = shadowRoot.querySelector("input#id"),
		pass1 = shadowRoot.querySelector("password-box#pass1"), pass2 = shadowRoot.querySelector("password-box#pass2"),
		org = shadowRoot.querySelector("input#org"), otp = shadowRoot.querySelector("input#otp"); 

	if (!name.checkValidity()) {name.reportValidity(); return false;}
	if (!id.checkValidity()) {id.reportValidity(); return false;}
	if (!pass1.checkValidity()) {pass1.reportValidity(); return false;}
	if (!pass2.checkValidity()) {pass2.reportValidity(); return false;}
	if (!org.checkValidity()) {org.reportValidity(); return false;}
	if (!otp.checkValidity()) {otp.reportValidity(); return false;}
	if (!_doPasswordsMatch(shadowRoot)) {shadowRoot.querySelector("span#errorPasswordMismatch").style.display = "inline"; return false;}

	return true;
}

function _doPasswordsMatch(shadowRoot) {
	const pass1 = shadowRoot.querySelector("password-box#pass1"), pass2 = shadowRoot.querySelector("password-box#pass2")
	return pass1.value == pass2.value;
}

function _getTOTPRandomKey() {
	const randomBytes = window.crypto.getRandomValues(new Uint8Array(20));
	const key = base32.encode(randomBytes, "RFC3548"); return key;
}

async function _getTOTPQRCode(key) {
	await $$.require("./components/register-box/3p/qrcode.min.js");
	return new Promise(async resolve => QRCode.toDataURL(await _getTOTPURL(key), (_, data_url) => resolve(data_url)));
}

const _getTOTPURL = async (key, host) => {
	const id = host?register_box.getShadowRootByHost(host).querySelector("input#id").value:undefined; 
	return `${$$.getOS()=="ios"?"totp":"otpauth"}://totp/${await i18n.get("Title")+(id?`:${id}`:"")}?secret=${key}&issuer=TekMonks&digits=6&period=30`;
} 

async function _checkAndFillAccountProfile(data, email, time) {
	const profileData = await loginmanager.getProfileData(email, time);
	if (!profileData || !profileData.id) {
		LOG.error(`Bad profile data provided - the provided email was ${email} and time was ${time}. Rerouting to the main page.`)
		router.doIndexNavigation();	// bad profile or hack attempt
	} else Object.assign(data, profileData);
}

function _resetUI(shadowRoot) {
	shadowRoot.querySelector("span#errorOTP").style.display = "none";
	shadowRoot.querySelector("span#errorExists").style.display = "none";
	shadowRoot.querySelector("span#errorPasswordMismatch").style.display = "none";
	shadowRoot.querySelector("span#errorSecurity").style.display = "none";
	shadowRoot.querySelector("span#errorInternal").style.display = "none";
	shadowRoot.querySelector("span#errorDomain").style.display = "none";
	_hideWait(shadowRoot);
}

const _showWait = shadowRoot => shadowRoot.querySelector("span#spinner").classList.add("visible");
const _hideWait = shadowRoot => shadowRoot.querySelector("span#spinner").classList.remove("visible")

const trueWebComponentMode = true;	// making this false renders the component without using Shadow DOM
export const register_box = {registerOrUpdate, trueWebComponentMode, elementConnected, initialRender, openAuthenticator, updateOrgDataList}
monkshu_component.register("register-box", `${COMPONENT_PATH}/register-box.html`, register_box);
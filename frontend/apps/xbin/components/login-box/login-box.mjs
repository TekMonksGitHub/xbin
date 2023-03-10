/* 
 * (C) 2018 TekMonks. All rights reserved.
 * License: See enclosed license file.
 */
import {util} from "/framework/js/util.mjs";
import {router} from "/framework/js/router.mjs";
import {session} from "/framework/js/session.mjs";
import {loginmanager} from "../../js/loginmanager.mjs";
import {securityguard} from "/framework/js/securityguard.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

const COMPONENT_PATH = util.getModulePath(import.meta);

async function elementConnected(host) {
	let data = {};

	if (host.getAttribute("styleBody")) data.styleBody = `<style>${host.getAttribute("styleBody")}</style>`;
	data.minlength = host.getAttribute("minlength"); data.COMPONENT_PATH = COMPONENT_PATH;

	login_box.setData(host.id, data);
}

async function signin(signInButton) {	
	const shadowRoot = login_box.getShadowRootByContainedElement(signInButton); _hideErrors(shadowRoot);
	if (!_validateForm(shadowRoot)) return;	// HTML5 validation failed

	const userid = shadowRoot.querySelector("#userid").value.toLowerCase();
	const pass = shadowRoot.querySelector("#pass").value;
	const otp = shadowRoot.querySelector("#otp").value;
	const routeOnSuccess = login_box.getHostElement(signInButton).getAttribute("routeOnSuccess");
	const routeOnNotApproved = login_box.getHostElement(signInButton).getAttribute("routeOnNotApproved");

	_showWait(shadowRoot); const loginResult = await loginmanager.signin(userid, pass, otp); _hideWait(shadowRoot);
	_handleLoginResult(loginResult, shadowRoot, routeOnSuccess, routeOnNotApproved, signInButton);
}

async function resetAccount(element) {
	const shadowRoot = login_box.getShadowRootByContainedElement(element);
	_hideErrors(shadowRoot);

	_showWait(shadowRoot); const result = await loginmanager.reset(shadowRoot.getElementById("userid").value); _hideWait(shadowRoot);
	if ((!result) || (!result.result)) shadowRoot.getElementById("notifier3").classList.add("visible");
	else shadowRoot.getElementById("notifier2").classList.add("visible");
}

function _validateForm(shadowRoot) {
	const userid = shadowRoot.querySelector("input#userid"), pass = shadowRoot.querySelector("#pass"), otp = shadowRoot.querySelector("#otp");
	if (!userid.checkValidity()) {userid.reportValidity(); return false;}
	if (!pass.checkValidity()) {pass.reportValidity(); return false;}
	if (!otp.checkValidity()) {otp.reportValidity(); return false;}
	return true;
}

function _hideErrors(shadowRoot) {
	shadowRoot.querySelector("span#errorMissingID").classList.remove("visible");
	shadowRoot.querySelector("span#errorOTP").classList.remove("visible");
	shadowRoot.querySelector("span#errorPassword").classList.remove("visible");
	shadowRoot.querySelector("span#errorGeneric").classList.remove("visible");
	shadowRoot.querySelector("span#errorDomain").classList.remove("visible");
	shadowRoot.querySelector("span#notifier2").classList.remove("visible");
	shadowRoot.querySelector("span#notifier3").classList.remove("visible");
	shadowRoot.querySelector("span#spinner").classList.remove("visible");
}

async function _handleLoginResult(result, shadowRoot, routeOnSuccess, routeOnNotApproved, containedElement) {
	let data; if (result == loginmanager.ID_OK_NOT_YET_VERIFIED) data = JSON.parse(
		await router.expandPageData(login_box.getHostElement(containedElement).getAttribute("dataOnSuccessButNotVerified")||"{}",
		undefined, {name: session.get(APP_CONSTANTS.USERNAME), id: session.get(APP_CONSTANTS.USERID), 
			org: session.get(APP_CONSTANTS.USERORG), role: securityguard.getCurrentRole(), needs_verification: true}));
	if (result == loginmanager.ID_OK) data = JSON.parse(
		await router.expandPageData(login_box.getHostElement(containedElement).getAttribute("dataOnSuccess")||"{}",
		undefined, {name: session.get(APP_CONSTANTS.USERNAME), id: session.get(APP_CONSTANTS.USERID), 
			org: session.get(APP_CONSTANTS.USERORG), role: securityguard.getCurrentRole(), needs_verification: false}));
			
	switch (result) {
		case loginmanager.ID_OK: router.loadPage(routeOnSuccess, data); break;
		case loginmanager.ID_OK_NOT_YET_VERIFIED: router.loadPage(routeOnSuccess, data); break;
		case loginmanager.ID_OK_NOT_YET_APPROVED: router.loadPage(routeOnNotApproved, data); break;

		case loginmanager.ID_FAILED_MISSING: shadowRoot.querySelector("span#errorMissingID").classList.add("visible"); break;
		case loginmanager.ID_FAILED_OTP: shadowRoot.querySelector("span#errorOTP").classList.add("visible"); break;
		case loginmanager.ID_FAILED_PASSWORD: shadowRoot.querySelector("span#errorPassword").classList.add("visible"); break;
		case loginmanager.ID_DOMAIN_ERROR: shadowRoot.querySelector("span#errorDomain").classList.add("visible"); break;

		case loginmanager.ID_INTERNAL_ERROR: shadowRoot.querySelector("span#errorGeneric").classList.add("visible"); break;
		default: shadowRoot.querySelector("span#errorGeneric").classList.add("visible"); break;
	}
}

const _showWait = shadowRoot => shadowRoot.querySelector("span#spinner").classList.add("visible");
const _hideWait = shadowRoot => shadowRoot.querySelector("span#spinner").classList.remove("visible");

const trueWebComponentMode = true;	// making this false renders the component without using Shadow DOM
export const login_box = {signin, resetAccount, trueWebComponentMode, elementConnected}
monkshu_component.register("login-box", `${COMPONENT_PATH}/login-box.html`, login_box);
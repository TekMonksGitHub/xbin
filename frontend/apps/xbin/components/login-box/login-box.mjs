/* 
 * (C) 2018 TekMonks. All rights reserved.
 * License: See enclosed license file.
 */
import {util} from "/framework/js/util.mjs";
import {router} from "/framework/js/router.mjs";
import {loginmanager} from "../../js/loginmanager.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

const COMPONENT_PATH = util.getModulePath(import.meta);

async function elementConnected(element) {
	let data = {};

	if (element.getAttribute("styleBody")) data.styleBody = `<style>${element.getAttribute("styleBody")}</style>`;
	data.minlength = element.getAttribute("minlength");
	
	if (element.id) {
		if (!login_box.datas) login_box.datas = {}; login_box.datas[element.id] = data;
	} else login_box.data = data;
}

async function signin(signInButton) {	
	const shadowRoot = login_box.getShadowRootByContainedElement(signInButton); _hideErrors(shadowRoot);
	if (!_validateForm(shadowRoot)) return;	// HTML5 validation failed

	const userid = shadowRoot.querySelector("#userid").value.toLowerCase();
	const pass = shadowRoot.querySelector("#pass").value;
	const otp = shadowRoot.querySelector("#otp").value;
	const routeOnSuccess = login_box.getHostElement(signInButton).getAttribute("routeOnSuccess");

	_handleLoginResult(await loginmanager.signin(userid, pass, otp), shadowRoot, routeOnSuccess);
}

function resetAccount(element) {
	const shadowRoot = login_box.getShadowRootByContainedElement(element);
	shadowRoot.getElementById("notifier").style.display = "none";
	shadowRoot.getElementById("notifier2").style.display = "inline";

	loginmanager.reset(shadowRoot.getElementById("userid").value);
}

function _validateForm(shadowRoot) {
	const userid = shadowRoot.querySelector("input#userid"), pass = shadowRoot.querySelector("#pass"), otp = shadowRoot.querySelector("#otp");
	if (!userid.checkValidity()) {userid.reportValidity(); return false;}
	if (!pass.checkValidity()) {pass.reportValidity(); return false;}
	if (!otp.checkValidity()) {otp.reportValidity(); return false;}
	return true;
}

function _hideErrors(shadowRoot) {
	shadowRoot.getElementById("notifier").style.display = "none";
	shadowRoot.getElementById("notifier2").style.display = "none";
}

function _handleLoginResult(result, shadowRoot, routeOnSuccess) {
	if (result) router.loadPage(routeOnSuccess);
	else shadowRoot.getElementById("notifier").style.display = "inline";
}

const trueWebComponentMode = true;	// making this false renders the component without using Shadow DOM
export const login_box = {signin, resetAccount, trueWebComponentMode, elementConnected}
monkshu_component.register("login-box", `${COMPONENT_PATH}/login-box.html`, login_box);
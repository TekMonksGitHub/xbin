/* 
 * (C) 2018 TekMonks. All rights reserved.
 * License: MIT - see enclosed license.txt file.
 */
import {router} from "/framework/js/router.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";
import {loginmanager} from "../../js/loginmanager.mjs";

async function elementConnected(element) {
	let data = {};

	if (element.getAttribute("styleBody")) data.styleBody = `<style>${element.getAttribute("styleBody")}</style>`;
	
	if (element.id) {
		if (!login_box.datas) login_box.datas = {}; login_box.datas[element.id] = data;
	} else login_box.data = data;
}

async function signin(signInButton) {	
	let shadowRoot = login_box.getShadowRootByContainedElement(signInButton);
	let userid = shadowRoot.getElementById("userid").value;
	let pass = shadowRoot.getElementById("pass").value;
		
	_handleLoginResult(await loginmanager.signin(userid, pass), shadowRoot);
}

function _handleLoginResult(result, shadowRoot) {
	if (result) router.loadPage(APP_CONSTANTS.MAIN_HTML);
	else shadowRoot.getElementById("notifier").MaterialSnackbar.showSnackbar({message:"Login Failed"});
}

export const login_box = { trueWebComponentMode: true, signin, elementConnected }
monkshu_component.register("login-box", `${APP_CONSTANTS.APP_PATH}/components/login-box/login-box.html`, login_box);
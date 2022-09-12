/**
 * A simple password component, with a show password icon.
 * Primarily a UI component.
 *  
 * (C) 2021 TekMonks. All rights reserved.
 * License: See enclosed license file.
 */
import {util} from "/framework/js/util.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

const COMPONENT_PATH = util.getModulePath(import.meta);

async function elementConnected(element) {
	const data = {
		closed_image: element.getAttribute("hide_password_image")||`${APP_CONSTANTS.COMPONENTS_PATH}/password-box/img/closed.svg`,
		open_image: element.getAttribute("show_password_image")||`${APP_CONSTANTS.COMPONENTS_PATH}/password-box/img/open.svg`,
		customValidity: element.getAttribute("customValidity"),
		placeholder: element.getAttribute("placeholder"),
		minlength: element.getAttribute("minlength"),
		required: element.getAttribute("required"),
		pattern: element.getAttribute("pattern"),
		onkeyup: element.getAttribute("onkeyup")
	}

	if (element.getAttribute("styleBody")) data.styleBody = `<style>${element.getAttribute("styleBody")}</style>`;
	
	if (element.id) {
		if (!password_box.datas) password_box.datas = {}; password_box.datas[element.id] = data;
	} else password_box.data = data;
}

async function elementRendered(host) {
	_attachFormValidationControls(host);
	const eyeElement = password_box.getShadowRootByHost(host).querySelector("img#eye");
	eyeElement.addEventListener("contextmenu", event => event.preventDefault());
}

function onKeyUp(element, _event) {
	const hostElement = password_box.getShadowRootByContainedElement(element).host;
	hostElement.value = element.value;
	if (hostElement.getAttribute("onkeyup")) eval(hostElement.getAttribute("onkeyup"));
}

function _attachFormValidationControls(element) {
	const inputElement = password_box.getShadowRootByHostId(element.id).querySelector("input#pwinput");

	element.getValue = _ => inputElement.value;
	element.setValue = v => inputElement.value = v;
	element.getValidity = _=> inputElement.validity;
	element.getWillValidate = _=> inputElement.willValidate;
	element.checkValidity = _=> inputElement.checkValidity();
	element.reportValidity = _=> inputElement.reportValidity();
	element.getValidationMessage = _=> inputElement.validationMessage;
}

export const password_box = {trueWebComponentMode: true, elementConnected, elementRendered, onKeyUp}
monkshu_component.register("password-box", `${COMPONENT_PATH}/password-box.html`, password_box);
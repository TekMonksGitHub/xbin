/* 
 * (C) 2018 TekMonks. All rights reserved.
 * License: See enclosed license file.
 */
import {util} from "/framework/js/util.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

const COMPONENT_PATH = util.getModulePath(import.meta);
let conf;

async function initialRender(host) {
	const data = {}; data.content = _getContent(host);
	if (host.getAttribute("styleBody")) data.styleBody = `<style>${await span_with_menu.getAttrValue(host, "styleBody")}</style>`;
	const menuItems = host.children; if (menuItems && menuItems.length) {
		data.menuitems = [];
		for (const menuItem of menuItems) if (menuItem.nodeType == 1 && menuItem.tagName.toUpperCase() == "MENU-ITEM")
			data.menuitems.push({entry: menuItem.getAttribute("label")||menuItem.innerText, onclick: menuItem.getAttribute("onclick")});
	}
	if (util.parseBoolean(host.getAttribute("bottommenu"))) data.risesFromBottom = true;

	conf = await $$.requireJSON(`${COMPONENT_PATH}/conf/config.json`);
	for (const key in conf) data[key] = conf[key];

	span_with_menu.bindData(data, host.id);
}

function hideMenu(element) {
	const shadowRoot = span_with_menu.getShadowRootByContainedElement(element);
	const memory = span_with_menu.getMemoryByContainedElement(element);
	if (!memory.menuOpen) return;

	const contextMenu = shadowRoot.querySelector("div#menu"); contextMenu.classList.remove("visible");
	memory.menuOpen = false;
}

function showMenu(element) {
	const shadowRoot = span_with_menu.getShadowRootByContainedElement(element);
	const memory = span_with_menu.getMemoryByContainedElement(element);
	if (memory.menuOpen == true) return;

	const contextMenu = shadowRoot.querySelector("div#menu");
	contextMenu.classList.add("visible");
	memory.menuOpen = true; 
}

function toggleMenu(element) {
	const memory = span_with_menu.getMemoryByContainedElement(element);
	if (memory.menuOpen) hideMenu(element, true); else showMenu(element);
}

function _getContent(element) {
	let content = "";
	for (const child of element.childNodes) {
		if (child.nodeValue && child.nodeValue.trim() != "") content += util.escapeHTML(child.nodeValue.trim());
		if (child.outerHTML && child.outerHTML.trim() != "" && child.tagName.toUpperCase() != "MENU-ITEM") content += child.outerHTML.trim();
	}
	return content;
}

const trueWebComponentMode = true;	// making this false renders the component without using Shadow DOM
export const span_with_menu = {trueWebComponentMode, initialRender, showMenu, hideMenu, toggleMenu}
monkshu_component.register("span-with-menu", `${COMPONENT_PATH}/span-with-menu.html`, span_with_menu);
/* 
 * (C) 2018 TekMonks. All rights reserved.
 * License: See enclosed license file.
 */
import {util} from "/framework/js/util.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

const COMPONENT_PATH = util.getModulePath(import.meta);
let conf;

async function initialRender(element) {
	const data = {}; data.content = _getContent(element);
	if (element.getAttribute("styleBody")) data.styleBody = `<style>${await span_with_menu.getAttrValue(element, "styleBody")}</style>`;
	const menuItems = element.children; if (menuItems && menuItems.length) {
		data.menuitems = [];
		for (const menuItem of menuItems) if (menuItem.nodeType == 1 && menuItem.tagName.toUpperCase() == "MENU-ITEM")
			data.menuitems.push({entry: menuItem.getAttribute("label")||menuItem.innerText, onclick: menuItem.getAttribute("onclick")});
	}
	if (util.parseBoolean(element.getAttribute("bottommenu"))) data.risesFromBottom = true;

	conf = await $$.requireJSON(`${COMPONENT_PATH}/conf/config.json`);
	for (const key in conf) data[key] = conf[key];

	span_with_menu.bindData(data, element.id);

	const memory = span_with_menu.getMemory(element.id);
 
	document.addEventListener("click", _e => {
	   if (!memory.menuOpen) return;
	   if (memory.ignoreClick) {memory.ignoreClick = false; return;}
 
	   const contextMenu = span_with_menu.getShadowRootByHostId(element.getAttribute("id")).querySelector("div#menu");
	   contextMenu.classList.remove("visible");
	   memory.menuOpen = false;
	});
 }

function showMenu(element) {
	const shadowRoot = span_with_menu.getShadowRootByContainedElement(element);
	const memID = span_with_menu.getHostElementID(element); const memory = span_with_menu.getMemory(memID);
	if (memory.menuOpen == true) return;

	const contextMenu = shadowRoot.querySelector("div#menu");
	contextMenu.classList.add("visible");
	memory.menuOpen = true; memory.ignoreClick = true;
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
export const span_with_menu = {trueWebComponentMode, initialRender, showMenu}
monkshu_component.register("span-with-menu", `${APP_CONSTANTS.APP_PATH}/components/span-with-menu/span-with-menu.html`, span_with_menu);
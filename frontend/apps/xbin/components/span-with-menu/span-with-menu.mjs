/* 
 * (C) 2018 TekMonks. All rights reserved.
 * License: See enclosed license file.
 */
import {util} from "/framework/js/util.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

const COMPONENT_PATH = util.getModulePath(import.meta);

async function initialRender(host) {
	new MutationObserver(_ => _render(host)).observe(host, {subtree: true, attributes: true});
	_render(host);
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
	if (memory.menuOpen) hideMenu(element); else showMenu(element);
}

function doAction(element, id) {
	const dataThisElement = span_with_menu.getDataByContainedElement(element);
	Function(dataThisElement.menuitems[id].onclick)();
	hideMenu(element);
}

async function _render(host) {
	const data = await _createData(host);
	span_with_menu.bindData(data, host.id);
}

async function _createData(host) {
	const data = {}; data.content = _getContent(host);
	if (host.getAttribute("styleBody")) data.styleBody = `<style>${await span_with_menu.getAttrValue(host, "styleBody")}</style>`;
	const menuItems = host.children; if (menuItems && menuItems.length) {
		data.menuitems = [];
		for (const menuItem of menuItems) if (menuItem.nodeType == 1 && menuItem.tagName.toUpperCase() == "MENU-ITEM")
			data.menuitems.push({ id: data.menuitems.length, entry: menuItem.getAttribute("label")||menuItem.innerText, 
				onclick: menuItem.getAttribute("onclick"), icon: menuItem.getAttribute("icon")? {
					icon: menuItem.getAttribute("icon"), iconhover: menuItem.getAttribute("iconhover")||menuItem.getAttribute("icon")
				}:undefined });
	}
	if (util.parseBoolean(host.getAttribute("bottommenu"))) data.risesFromBottom = true;
	if ($$.isMobile()) data.isMobile = true;
	return data;
}

function _getContent(host) {
	let content = "";
	for (const child of host.childNodes) {
		if (child.nodeValue && child.nodeValue.trim() != "") content += util.escapeHTML(child.nodeValue.trim());
		if (child.outerHTML && child.outerHTML.trim() != "" && child.tagName.toUpperCase() != "MENU-ITEM") content += child.outerHTML.trim();
	}
	return content;
}

const trueWebComponentMode = true;	// making this false renders the component without using Shadow DOM
export const span_with_menu = {trueWebComponentMode, initialRender, showMenu, hideMenu, toggleMenu, doAction}
monkshu_component.register("span-with-menu", `${COMPONENT_PATH}/span-with-menu.html`, span_with_menu);
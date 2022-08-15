/** 
 * (C) 2021 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */
import {i18n} from "/framework/js/i18n.mjs";
import {util} from "/framework/js/util.mjs";
import {router} from "/framework/js/router.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

const COMPONENT_PATH = util.getModulePath(import.meta), MENU_BREAK_INDICATOR = "menubreak", MAX_WIDTH_THRESHOLD_PX = 96;

/**
 * Element was rendered
 * @param element Host element
 */
async function elementRendered(element) {
	const data = context_menu.getData(element.id)||{}, shadowRoot = context_menu.getShadowRootByHost(element);
	if (data.htmlContent) {	// run any contained JS scripts
		const domHTMLContent = new DOMParser().parseFromString(data.htmlContent, "text/html").documentElement;
		router.runShadowJSScripts(domHTMLContent, shadowRoot);
	}
}

/**
 * Shows the given menu.
 * @param hostID The host ID of the context-menu element which should be used to display this menu
 * @param contentOrMenuItems The menuitems, can be HTML string or an object of menuitmes of format -> 
 *                  {"text to display":function() {function called when clicked}}
 * @param x The X coordinates (pageX) where to display the menu
 * @param y The Y coordinates (pageY) where to display the menu
 * @param adjustX Any adjustment to make for the menu X coordinates (e.g. shift right by 5px or -5px)
 * @param adjustY Any adjustment to make for the menu Y coordinates (e.g. shift top by 5px or -5px)
 * @param data Any additional data to pass to the HTML renderer
 * @param dontShowCancel Don't show the cancel menu item
 * @param isTopMenu Menu rises up, that is the bottom is positioned where the click was, instead of bottom
 * @param dontCloseIfClickedWithin Won't auto close the menu if the click is within the menu
 */
async function showMenu(hostID, contentOrMenuItems, x, y, adjustX, adjustY, data, dontShowCancel, isTopMenu, 
		dontCloseIfClickedWithin) {

	const isMenuHTML = typeof contentOrMenuItems == "string", formattedMenuItems = []; 

	const menuObject = {}; if (!isMenuHTML) {
		const memory = context_menu.getMemory(hostID);
		memory.menuFunctions = {}; let functionIndex = 0; for (const menuText in contentOrMenuItems) {
			memory.menuFunctions[functionIndex] = {function: contentOrMenuItems[menuText]};
			if (menuText != MENU_BREAK_INDICATOR) formattedMenuItems.push({menuentry: {displayText:menuText, functionID: functionIndex++}});
			else formattedMenuItems.push({menubreak: true});
		}; 
		
		// add cancellation menu item
		if (!dontShowCancel) {
			formattedMenuItems.push({menubreak: true});
			memory.menuFunctions[functionIndex] = {function: _=>{}}; 
			formattedMenuItems.push({menuentry: {displayText:await i18n.get("Cancel"), functionID: functionIndex}});
		}
		
		menuObject.items = formattedMenuItems;
	} else menuObject.htmlContent = await router.expandPageData(contentOrMenuItems, undefined, {...data, hostID});

	const signX = adjustX.toString().trim().startsWith("-") ? "-":"+",  signY = adjustY.toString().trim().startsWith("-") ? "-":"+",
		appendUnitsX = typeof(adjustX) == "number" ? "px":adjustX.trim().substring(parseInt(adjustX).toString().length), 
		appendUnitsY = typeof(adjustY) == "number" ? "px":adjustY.trim().substring(parseInt(adjustY).toString().length),
		positioner = context_menu.getShadowRootByHostId(hostID).querySelector("div#positioner"), 
		positionerRect = positioner.getBoundingClientRect(), 
		yAdjusted = `calc(${isTopMenu?"100vh -":"0px +"} ${y}px - ${positionerRect.y}px ${signY} ${Math.abs(parseInt(adjustY))+appendUnitsY||"0px"})`, 
		xAdjusted = `calc(${x}px - ${positionerRect.x}px ${signX} ${Math.abs(parseInt(adjustX))+appendUnitsX||"0px"})`,
		maxWidthPossible = window.innerWidth - x -positionerRect.x + (typeof(adjustX) == "number"?(adjustX.toString().trim().startsWith("-")?-1:1)*adjustX:0), 
		xFinal = maxWidthPossible < MAX_WIDTH_THRESHOLD_PX ? `calc(${xAdjusted} - ${MAX_WIDTH_THRESHOLD_PX}px)` : xAdjusted, 
		maxWidth = `calc(100vw - ${xFinal} - 4px)`;
		
	const cloneData = {...data}; if (cloneData.styleBody) delete cloneData.styleBody; const host = context_menu.getHostElementByID(hostID);
	const styleBody = `<style>${host.getAttribute("styleBody")||""}\ndiv#menu {${isTopMenu?"bottom:":"top:"}${yAdjusted}; left:${xFinal}; border-width:1px; max-width:${maxWidth}}\n${data?.styleBody||""}</style>`;
	const dataForMenu = {...menuObject, ...cloneData, styleBody};
	
	window.addEventListener("click", function(event) {
		window.removeEventListener("click", this); 
		if ((!dontCloseIfClickedWithin)||_isClickOutsideMenu(hostID, event)) hideMenu(hostID);
	});
	context_menu.bindData(dataForMenu, hostID); 
	context_menu.getMemory(hostID).isOpen = true;
}

/**
 * Called when menu clicked. Internal function don't call directly.
 * @param containedElement The contained element which caused this event
 * @param functionIndex The function index of the function to call.
 */
async function menuClicked(containedElement, functionIndex) {
	const memory = context_menu.getMemoryByContainedElement(containedElement);
	await hideMenu(context_menu.getHostElementID(containedElement));

	if (memory.menuFunctions[functionIndex]) setTimeout(_=>memory.menuFunctions[functionIndex].function(),1);	// ensures menu is hidden before action is called :)
}

/**
 * Hides the context menu
 * @param hostID The host ID of the context menu element.
 */
async function hideMenu(hostID) {
	const dataForMenu = {}; await context_menu.bindData(dataForMenu, hostID); 
	context_menu.getMemory(hostID).isOpen = false;
}

/** @return true if menu is open, false otherwise */
const isOpen = hostID => context_menu.getMemory(hostID).isOpen == true;

function _isClickOutsideMenu(hostID, event) {
	const menuDiv = context_menu.getShadowRootByHostId(hostID).querySelector("div#menu");
	const menuRect = menuDiv.getBoundingClientRect(); 
	if (event.clientX >= menuRect.left && event.clientX <= menuRect.right && event.clientY >= menuRect.top &&
		event.clientY <= menuRect.bottom) return false; else return true;
}

// convert this all into a WebComponent so we can use it
export const context_menu = {trueWebComponentMode: true, showMenu, menuClicked, hideMenu, elementRendered, isOpen}
monkshu_component.register("context-menu", `${COMPONENT_PATH}/context-menu.html`, context_menu);
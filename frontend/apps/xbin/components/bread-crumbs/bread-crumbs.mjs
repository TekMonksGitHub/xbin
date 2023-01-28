/**
 * A breadcrumb component. 
 * 
 * Usage -> <bread-crumbs value='[{url:..., name:..., icon:...}, {url:..., name:..., icon:...}]' 
 * 	crumbicon='<some image url, used as default crumb icon if one wasn't provided>' 
 *	stybeBody='<some style or URL to a CSS>' 
 *	spreadcrumbs='<how many crumbs should be spread before nesting them, default is 3>'></bread-crumbs>
 * 
 * This component needs the span-with-menu component to work.
 * 
 * (C) 2022 TekMonks. All rights reserved.
 * License: See enclosed license file.
 */
import {i18n} from "/framework/js/i18n.mjs";
import {util} from "/framework/js/util.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

const COMPONENT_PATH = util.getModulePath(import.meta), DEFAULT_SPREAD_CRUMBS_SIZE = 3;

async function elementConnected(host) {
	const data = {COMPONENT_PATH};

	await _createDataCrumbs(host, data, host.getAttribute("value"));
	
	if (host.getAttribute("styleBody")) data.styleBody = `<style>${await bread_crumbs.getAttrValue(host, "styleBody")}</style>`;

	bread_crumbs.setData(host.id, data);
}

const doCrumbAction = (actionID, hostID) => {
	const data = bread_crumbs.getDataByHost(bread_crumbs.getHostElementByID(hostID !== "undefined"?hostID:undefined)), 
		allcrumbs = [...data.singlecrumbs, ...data.nestedcrumbs];
	Function(allcrumbs[actionID].action)();
}

async function attributeChanged(host, name, _oldValue, newValue) {
	if (name != "value") return; 
	const data = bread_crumbs.getDataByHost(host)||{};
	await _createDataCrumbs(host, data, newValue); await bread_crumbs.bindDataByHost(host, data);
}

const getObservedAttributes = _ => ["value"];

async function _createDataCrumbs(host, data, allcrumbsValue) {
	const allcrumbs = JSON.parse(allcrumbsValue||`[{"action": "monkshu_env.frameworklibs['router'].navigate('${window.location}')", "name": "${(await i18n.get("Home"))||"Home"}"}]`);
	const numberOfSpreadCrumbs = host.getAttribute("spreadcrumbs") || DEFAULT_SPREAD_CRUMBS_SIZE;
	const nestedCrumbsSplit = allcrumbs.length > numberOfSpreadCrumbs ? allcrumbs.length - numberOfSpreadCrumbs : -1;
	data.singlecrumbs = nestedCrumbsSplit != -1 ? allcrumbs.slice(nestedCrumbsSplit, allcrumbs.length) : allcrumbs, 
		data.nestedcrumbs = nestedCrumbsSplit != -1 ? allcrumbs.slice(0, nestedCrumbsSplit) : []; 
	for (const [i, crumb] of [...data.singlecrumbs, ...data.nestedcrumbs].entries()) {
		if (!crumb.icon) crumb.icon = _getCrumbIcon(host); crumb.iconhover = _getCrumbHoverIcon(host);
		crumb.actionID = i; crumb.hostID = host.id||"undefined";
	}
	if (data.nestedcrumbs.length) data.showNestedCrumbs = true; else data.showNestedCrumbs = undefined;
}

const _getCrumbIcon = host => host.getAttribute("crumbicon")||`${COMPONENT_PATH}/img/page.svg`;
const _getCrumbHoverIcon = host => host.getAttribute("crumbiconhover")||`${COMPONENT_PATH}/img/page.svg`;

export const bread_crumbs = {trueWebComponentMode: true, elementConnected, doCrumbAction, attributeChanged, 
	getObservedAttributes}
monkshu_component.register("bread-crumbs", `${COMPONENT_PATH}/bread-crumbs.html`, bread_crumbs);
/**
 * A component to hold and display a list of items.
 * Items are sent as an array of item objects.
 * Each item object can be a simple string or an object. If 
 * it is an object then the format must be {id - item ID, label - item text}.
 * 
 * Value attribute returns or expects an array of items in the format
 * listed above. Returned values are always in the object array format as JSON
 * parsable strings.
 *  
 * (C) 2020 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */
import {util} from "/framework/js/util.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

const COMPONENT_PATH = util.getModulePath(import.meta), DEFAULT_PLACEHOLDER = "Add new item";

async function elementConnected(host) {
	Object.defineProperty(host, "value", {
		get: _ => {_refreshItemData(host.id); return JSON.stringify(editable_list.getData(host.id).items)}, 
		set: value => {
			const newData = editable_list.getData(host.id); newData.items = _addDBLClickHandlerToItems(
				_normalizeItemObjects(JSON.parse(value)), host.getAttribute("ondblclickHandler"));
			editable_list.bindData(newData, host.id) } 
	});

	const data = { 
        items: _addDBLClickHandlerToItems(_normalizeItemObjects(JSON.parse(host.getAttribute("value")||
			(host.innerText.trim()!=""?host.innerText:undefined)||"[]")), host.getAttribute("ondblclickHandler")), 
		styleBody: host.getAttribute("styleBody")?`<style>${host.getAttribute("styleBody")}</style>`:undefined,
		placeholder: host.getAttribute("placeholder")||DEFAULT_PLACEHOLDER, 
		COMPONENT_PATH }

	editable_list.setDataByHost(host, data);
}

function addItem(element) {
	const host = editable_list.getHostElement(element), value = element.value, data = editable_list.getData(host.id);
	if (value.trim() == "") return;	// empty
	data.items.push({id: Date.now(), label: value, ondblclick: host.getAttribute("ondblclickHandler")||undefined});
	editable_list.bindData(data, host.id)
}

function removeItem(element, itemID) {
	const host = editable_list.getHostElement(element), data = editable_list.getData(host.id);
	for (const item of data.items) if (item.id == itemID && item.label == element.value) {
		data.items.splice(data.items.indexOf(item), 1); break;
	}
	editable_list.bindData(data, host.id)
}

function getValuesAsJSArray(hostID, asStringArray) {
	const items = JSON.parse(editable_list.getHostElementByID(hostID).getValue());
	const returnValue = []; for (const item of items) returnValue.push(asStringArray?item.label:{...item});
	return returnValue;
}

function _addDBLClickHandlerToItems(items, ondblclick) {
	if (!ondblclick) return items;
	for (const item of items) item.ondblclick = ondblclick; 
    return items;
}

function _refreshItemData(hostID) {
	const shadowRoot = editable_list.getShadowRootByHostId(hostID), items = editable_list.getData(hostID).items;
	for (const item of items) {
		const inputThisItem = shadowRoot.querySelector(`input#node${item.id}`);
		item.label = inputThisItem.value.trim();
	}
}

function _normalizeItemObjects(itemObjects) {
	const normalizedItemObjects = [];
	for (const [i, item] of itemObjects.entries()) if (typeof item == "string") normalizedItemObjects.push(
		{id: i, label: item}); else normalizedItemObjects.push({...item});
	return normalizedItemObjects;
}

export const editable_list = {trueWebComponentMode: true, elementConnected, addItem, removeItem, getValuesAsJSArray};
monkshu_component.register("editable-list", `${COMPONENT_PATH}/editable-list.html`, editable_list);
/** 
 * Progress bar component.
 * (C) 2021 TekMonks. All rights reserved.
 * License: See enclosed license file.
 */
import {util} from "/framework/js/util.mjs";
import {router} from "/framework/js/router.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

const COMPONENT_PATH = util.getModulePath(import.meta);

async function elementConnected(host) {
	const borderradius = host.getAttribute("borderradius") || 0;
	const innerfillborderradius = host.getAttribute("roundedprogressbar")?.toLowerCase() == "true" &&  host.getAttribute("borderradius")?
		`calc(${borderradius} - 2px)` : "0px";
	const fillborderradius = host.getAttribute("borderradius") ? `calc(${borderradius} - 2px)` : "0px";

	const data = {}, commonData = {
		progresstext: await _getProgressText(host),
		value: _getValue(host),
		fill: host.getAttribute("fill"),
		background: host.getAttribute("background"),
		borderwidth: host.getAttribute("borderwidth")||"1px",
		bordercolor: host.getAttribute("bordercolor"),
		borderradius, fillborderradius, innerfillborderradius,
		filltextcolor: host.getAttribute("filltextcolor"),
		bgtextcolor: host.getAttribute("bgtextcolor"),
		progresstextsize: host.getAttribute("progresstextsize"),
		textfont: host.getAttribute("textfont") || "Serif",
		style_start: "<style>", style_end: "</style>"
	};
	if (!host.getAttribute("isvertical")) data.horizontal_progress = commonData; else data.vertical_progress = commonData;
	
	progress_bar.setData(host.id, data);
}

async function setValue(hostID, newvalue) {
	const host = progress_bar.getHostElementByID(hostID), data = progress_bar.getData(hostID), commonData = 
		host.getAttribute("isvertical") ? data.vertical_progress : data.horizontal_progress;
	commonData.progresstext = await _getProgressText(host, newvalue); commonData.value = _getValue(host, newvalue); 
	progress_bar.bindData(data, hostID);
}

async function _getProgressText(host, value) {
	const valueParsed = _getValue(host, value), progrestext = host.getAttribute("progresstext") ? 
		(await router.getMustache()).render(host.getAttribute("progresstext"), {value: valueParsed}) : `${valueParsed}%`;
	return progrestext;
}

const _getValue = (host, value) => {try {return parseInt(value||(host.getAttribute("value")||"0"));} catch(err) {return 0;}}

export const progress_bar = {trueWebComponentMode: true, elementConnected, setValue}
monkshu_component.register("progress-bar", `${COMPONENT_PATH}/progress-bar.html`, progress_bar);
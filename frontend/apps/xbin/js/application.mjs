/* 
 * (C) 2015 TekMonks. All rights reserved.
 * License: MIT - see enclosed license.txt file.
 */
 
import {router} from "/framework/js/router.mjs";
import {session} from "/framework/js/session.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";
import {securityguard} from "/framework/js/securityguard.mjs";

const init = async _ => {
	window.APP_CONSTANTS = (await import ("./constants.mjs")).APP_CONSTANTS;
	window.LOG = (await import ("/framework/js/log.mjs")).LOG;
	if (!session.get($$.MONKSHU_CONSTANTS.LANG_ID)) session.set($$.MONKSHU_CONSTANTS.LANG_ID, "en");
	securityguard.setPermissionsMap(APP_CONSTANTS.PERMISSIONS_MAP);
	securityguard.setCurrentRole(securityguard.getCurrentRole() || APP_CONSTANTS.GUEST_ROLE);
}

const main = async _ => {
	apiman.registerAPIKeys(APP_CONSTANTS.API_KEYS, APP_CONSTANTS.KEY_HEADER);
	const decodedURL = router.decodeURL(window.location.href), justURL = decodedURL.split("?")[0];

	if (justURL == APP_CONSTANTS.INDEX_HTML) router.loadPage(APP_CONSTANTS.LOGIN_HTML);
	else if (securityguard.isAllowed(justURL)) {
		if (router.getLastSessionURL() && decodedURL == router.getLastSessionURL().toString()) router.reload();
		else router.loadPage(decodedURL);
	} else router.loadPage(APP_CONSTANTS.LOGIN_HTML);
}

export const application = {init, main};
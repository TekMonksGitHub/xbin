/* 
 * (C) 2015 TekMonks. All rights reserved.
 * License: MIT - see enclosed license.txt file.
 */
import {session} from "/framework/js/session.mjs";
import {router} from "/framework/js/router.mjs";

function changeLanguage(lang) {
	session.set($$.MONKSHU_CONSTANTS.LANG_ID, lang);
	router.reload(); 
}

export const language = {changeLanguage};
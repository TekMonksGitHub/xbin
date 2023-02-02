/* 
 * (C) 2015 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */
import {i18n} from "/framework/js/i18n.mjs";
import {router} from "/framework/js/router.mjs";

function changeLanguage(lang) {
	i18n.setSessionLang(lang);
	router.reload(); 
}

export const language = {changeLanguage};
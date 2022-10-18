/**
 * Verifies the user's email
 * (C) 2022 TekMonks. All rights reserved.
 * License: See enclosed license file.
 */

import {i18n} from "/framework/js/i18n.mjs";
import {router} from "/framework/js/router.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";

const interceptPageData = _ => router.addOnLoadPageData(APP_CONSTANTS.VERIFY_HTML, async (data, url) => {   // verify email
    const urlParsed = new URL(url), e = urlParsed.searchParams.get("e"), t = urlParsed.searchParams.get("t"),
        verifyResult = (e && t) ? await apiman.rest(APP_CONSTANTS.API_VERIFY_EMAIL, "POST", {e, t}) : {result: false};
    
    if (verifyResult && verifyResult.result) {
        data.emailVerifyMsg = await i18n.get("EmailVerified"); 
        data.emailVerified = true; 
    } else data.emailVerifyMsg = await i18n.get("EmailNotVerified");
});

export const verify = {interceptPageData};
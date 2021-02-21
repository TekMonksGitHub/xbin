/* 
 * (C) 2020 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */
import {router} from "/framework/js/router.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";

function downloadFile() {
    const params = new URL(router.getCurrentURL()).searchParams, id = params.get("id"), name = params.get("name");
    const downloadLink = `${APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/downloadsharedfile"}?id=${id}`;
    apiman.blob(downloadLink, name, "GET");
}

export const download = {downloadFile}
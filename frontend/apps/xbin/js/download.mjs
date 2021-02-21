/* 
 * (C) 2020 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */
import {i18n} from "/framework/js/i18n.mjs";
import {router} from "/framework/js/router.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";

const API_CHECKSHARE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/checkshare";

function downloadFile() {
    const params = new URL(router.getCurrentURL()).searchParams, id = params.get("id"), name = params.get("name");
    const downloadLink = `${APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/downloadsharedfile"}?id=${id}`;
    apiman.blob(downloadLink, name, "GET");
}

async function checkShare() {
    const params = new URL(router.getCurrentURL()).searchParams, id = params.get("id"), name = params.get("name");
    const result = await apiman.rest(API_CHECKSHARE, "GET", {id, name});
    if (!result.result) {
        document.querySelector("img#download").src = "./img/brokendownload.svg";
        document.querySelector("span#downloadmsg").innerHTML = await i18n.get("BadDownload");
        document.querySelector("div#background").onclick = _=>false;
    } else {
        document.querySelector("img#download").src = "./img/download.svg";
        document.querySelector("span#downloadmsg").innerHTML = `${await i18n.get("DownloadFile")} - ${name}`;
        document.querySelector("div#background").onclick = function(){downloadFile();}
    }
}

export const download = {downloadFile, checkShare}
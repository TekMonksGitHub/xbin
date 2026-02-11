/**
 * Handles download of shared files. 
 *  
 * (C) 2020 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */
import {router} from "/framework/js/router.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";

function downloadFile() {
    const params = new URL(router.getCurrentURL()).searchParams, 
        id = params.get("id"), name = params.get("name"), apipath = params.get("apipath");
    const downloadLink = `${apipath}/downloadsharedfile?id=${id}`;
    const link = document.createElement("a"); link.download = name; link.href = downloadLink; link.style.display="none";
    link.click(); 
}

async function checkShare() {
    const params = new URL(router.getCurrentURL()).searchParams, 
        id = params.get("id"), name = params.get("name"), apipath = params.get("apipath");
    const result = await apiman.rest(`${apipath}/checkshare`, "GET", {id, name});
    if (!result.result) {
        document.querySelector("img#download").src = "./img/brokendownload.svg";
        document.querySelector("span#downloadmsg").innerHTML = "Bad download";
        document.querySelector("div#background").onclick = _=>false;
    } else {
        document.querySelector("img#download").src = "./img/download.svg";
        document.querySelector("span#downloadmsg").innerHTML = `Download - ${name}`;
        document.querySelector("div#background").onclick = function(){downloadFile();}
    }
}

export const downloadshared = {downloadFile, checkShare}
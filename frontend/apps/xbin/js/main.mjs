/* 
 * (C) 2020 TekMonks. All rights reserved.
 * License: MIT - see enclosed license.txt file.
 */
import {loginmanager} from "./loginmanager.mjs"
import {router} from "/framework/js/router.mjs";
import {session} from "/framework/js/session.mjs";

function toggleMenu() {
    const imgElement = document.querySelector("span#menubutton > img"), menuIsOpen = imgElement.src.indexOf("menu.svg") != -1;

    if (menuIsOpen) {    
        const menuDiv = document.querySelector("div#menu"); menuDiv.style.maxHeight = menuDiv.scrollHeight+"px";
        menuDiv.classList.add("visible");
        imgElement.src = "./img/menu_close.svg";
    } else {
        let menuDiv = document.querySelector("div#menu"); menuDiv.style.maxHeight = 0; 
        menuDiv.classList.remove("visible");
        imgElement.src = "./img/menu.svg";
    }
}

async function fileSelected(entry) {
    let template = document.querySelector(entry?"template#fileinfo":"template#defaultinfo").innerHTML; 
    const matches = /<!--([\s\S]+)-->/g.exec(template); template = matches[1]; 
    
    if (entry) entry.size = entry.size.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (entry) entry.ctime = `${entry.ctime.split("T")[0]} ${entry.ctime.split("T")[1].substring(0, entry.ctime.split("T")[1].lastIndexOf("."))}`;
    if (entry) entry.birthtime = `${entry.birthtime.split("T")[0]} ${entry.birthtime.split("T")[1].substring(0, entry.birthtime.split("T")[1].lastIndexOf("."))}`;
    const rendered = await router.expandPageData(template, session.get($$.MONKSHU_CONSTANTS.PAGE_URL), entry);
    document.querySelector("div#info").innerHTML = rendered;
}

const logout = _ => loginmanager.logout();

export const main = {toggleMenu, fileSelected, logout}
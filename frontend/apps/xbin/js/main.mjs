/* 
 * (C) 2020 TekMonks. All rights reserved.
 * License: MIT - see enclosed license.txt file.
 */

import {loginmanager} from "./loginmanager.mjs"

function toggleMenu() {
    const menuIsOpen = document.querySelector("span#menubutton").innerText == "☰";

    if (menuIsOpen) {    
        const menuDiv = document.querySelector("div#menu"); menuDiv.style.maxHeight = menuDiv.scrollHeight+"px";
        menuDiv.classList.add("visible");
        document.querySelector("span#menubutton").innerHTML="X";
    } else {
        let menuDiv = document.querySelector("div#menu"); menuDiv.style.maxHeight = 0; 
        menuDiv.classList.remove("visible");
        document.querySelector("span#menubutton").innerHTML="☰";
    }
}

const logout = _ => loginmanager.logout();

export const main = {toggleMenu, logout}
/* 
 * (C) 2020 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */
import {util} from "/framework/js/util.mjs";
import {router} from "/framework/js/router.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

const COMPONENT_PATH = util.getModulePath(import.meta);

async function showDialog(templatePath, showOK, showCancel, data, hostID, retValIDs, callback) {
    const templateHTML = await router.loadHTML(templatePath, data, false);
    if (callback) _showDialogInternal(templateHTML, showOK, showCancel, hostID, retValIDs, callback);
    else return new Promise(resolve => _showDialogInternal(templateHTML, showOK, showCancel, hostID, retValIDs, ret=>resolve(ret)));
}

function hideDialog(element) {
    const shadowRoot = element instanceof Element ? dialog_box.getShadowRootByContainedElement(element): 
        dialog_box.getShadowRootByHostId(element);
    const hostElement = shadowRoot.querySelector("div#dialogcontent");
    while (hostElement && hostElement.firstChild) hostElement.removeChild(hostElement.firstChild);  // deletes everything
    const modalCurtain = shadowRoot.querySelector("div#modalcurtain");
    const dialog = shadowRoot.querySelector("div#dialog");
    dialog.classList.remove("visible"); modalCurtain.classList.remove("visible");
}

function error(element, msg) {
    const shadowRoot = element instanceof Element ? dialog_box.getShadowRootByContainedElement(element): 
        dialog_box.getShadowRootByHostId(element);
    const divError = shadowRoot.querySelector("div#error");
    divError.innerHTML = msg; divError.style.visibility = "visible";
}

const showMessage = (templatePath, data, hostID) => dialog_box.showDialog(templatePath, true, 
    false, data, hostID, [], _=> dialog_box.hideDialog("dialog"));

function hideError(element) {
    const shadowRoot = dialog_box.getShadowRootByContainedElement(element);
    const divError = shadowRoot.querySelector("div#error");
    divError.style.visibility = "hidden";
}

function submit(element) {
    const memory = dialog_box.getMemoryByContainedElement(element);

    if (memory.dialogResult) {memory.callback(memory.dialogResult); return;} 
    else if (memory.retValIDs) {
        const ret = {}; const shadowRoot = dialog_box.getShadowRootByContainedElement(element);
        for (const retValId of memory.retValIDs) ret[retValId] = shadowRoot.querySelector(`#${retValId}`)?shadowRoot.querySelector(`#${retValId}`).value:null;
        memory.callback(ret);
        return;
    } else if (memory.callback) memory.callback();
} 

function _showDialogInternal(templateHTML, showOK, showCancel, hostID, retValIDs, callback) {
    const shadowRoot = dialog_box.getShadowRootByHostId(hostID); _resetUI(shadowRoot);
    const templateRoot = new DOMParser().parseFromString(templateHTML, "text/html").documentElement;
    router.runShadowJSScripts(templateRoot, shadowRoot);
    const hostElement = shadowRoot.querySelector("div#dialogcontent");
    hostElement.appendChild(templateRoot);
    const modalCurtain = shadowRoot.querySelector("div#modalcurtain");
    const dialog = shadowRoot.querySelector("div#dialog");
    modalCurtain.classList.add("visible"); dialog.classList.add("visible"); 
    if (!showOK) shadowRoot.querySelector("span#ok").style.display = "none";
    if (!showCancel) shadowRoot.querySelector("span#cancel").style.display = "none";
    
    const memory = dialog_box.getMemory(hostID); memory.retValIDs = retValIDs; memory.callback = callback;
    memory.dialog = dialog;
}

function _resetUI(shadowRoot) {
    shadowRoot.querySelector("div#error").style.visibility = "hidden";
    shadowRoot.querySelector("span#ok").style.display = "inline";
    shadowRoot.querySelector("span#cancel").style.display = "inline";
}

const trueWebComponentMode = true;	// making this false renders the component without using Shadow DOM
export const dialog_box = {showDialog, trueWebComponentMode, hideDialog, error, showMessage, hideError, submit}
monkshu_component.register("dialog-box", `${COMPONENT_PATH}/dialog-box.html`, dialog_box);
/**
 * Dialog component, modal.
 * 
 * (C) 2020 TekMonks. All rights reserved.
 * License: MIT - see enclosed license.txt file.
 */
 import {util} from "/framework/js/util.mjs";
 import {router} from "/framework/js/router.mjs";
 import {monkshu_component} from "/framework/js/monkshu_component.mjs";
 
 const COMPONENT_PATH = util.getModulePath(import.meta);
 
 /**
  * Shows a new dialog
  * @param {string} templatePath The template to use
  * @param {boolean} showOK Show OK button or not
  * @param {boolean} showCancel Show Cancel button or not
  * @param {object} data The data to instantiate the template
  * @param {string} hostID The ID of the host element for the dialog-box
  * @param {array} retValIDs An array of element IDs from the template, whose values should be returned, can be null
  * @param {function} callback The callback function, receives a data object with the values of retValIDs above, can be null
  * @param {function} callbackCancel The callback function if cancel is clicked, can be null
  */
 async function showDialog(templatePath, showOK, showCancel, data, hostID, retValIDs, callback, callbackCancel) {
     const templateHTML = await router.loadHTML(templatePath, data, false);
     if (callback || callbackCancel) _showDialogInternal(templateHTML, showOK, showCancel, hostID, retValIDs, callback, callbackCancel);
     else return new Promise(resolve => _showDialogInternal(templateHTML, showOK, showCancel, hostID, retValIDs, result => resolve(result)));
 }
 
 /**
  * Hides the dialog
  * @param {object|string} element The element hosting the dialog or it's ID
  */
 function hideDialog(element) {
     const shadowRoot = element instanceof Element ? dialog_box.getShadowRootByContainedElement(element): 
         dialog_box.getShadowRootByHostId(element);
     const hostElement = shadowRoot.querySelector("div#dialogcontent"); 
     while (hostElement && hostElement.firstChild) hostElement.removeChild(hostElement.firstChild);  // deletes everything
     const modalCurtain = shadowRoot.querySelector("div#modalcurtain");
     const dialog = shadowRoot.querySelector("div#dialog");
     dialog.classList.remove("visible"); modalCurtain.classList.remove("visible"); 
 }
 
 /**
  * Shows the given error, within an open dialog
  * @param {object|string} element The element hosting the dialog or it's ID 
  * @param {string} message The message to show
  */
 function error(element, message) {
     const shadowRoot = element instanceof Element ? dialog_box.getShadowRootByContainedElement(element): 
         dialog_box.getShadowRootByHostId(element);
     const divError = shadowRoot.querySelector("div#error");
     divError.innerHTML = message; divError.style.visibility = "visible";
 }
 
 /**
  * Shows the given message in a new dialog
  * @param {string} message The message to show
  * @param {string} hostID The ID of the host element for the dialog-box
  * @param {function} callback The callback function once OK is clicked, optional
  */
 const showMessage = (message, hostID, callback=_=>{}) => monkshu_env.components['dialog-box'].showDialog(
     `${APP_CONSTANTS.COMPONENTS_PATH}/dialog-box/templates/message.html`, true, 
     false, {message}, hostID, [], _=> {monkshu_env.components['dialog-box'].hideDialog(hostID); callback();});
 
 /**
  * Hides the error being shown on the dialog
  * @param {object|string} element The element hosting the dialog or it's ID
  */
 function hideError(element) {
     const shadowRoot = element instanceof Element ? dialog_box.getShadowRootByContainedElement(element): 
         dialog_box.getShadowRootByHostId(element);
     const divError = shadowRoot.querySelector("div#error");
     divError.style.visibility = "hidden";
 }
 
 /**
  * Called when submit (ok) is clicked
  * @param {object|string} element The element hosting the dialog or it's ID
  */
 function submit(element) {
     const memory = dialog_box.getMemoryByContainedElement(element);
 
     if (memory.retValIDs && memory.callback) {
         const ret = {}; const shadowRoot = dialog_box.getShadowRootByContainedElement(element);
         for (const retValId of memory.retValIDs) ret[retValId] = shadowRoot.querySelector(`#${retValId}`)?shadowRoot.querySelector(`#${retValId}`).value:null;
         memory.callback(ret);
     } else if (memory.callback) memory.callback();
 } 
 
 /**
  * Called when cancel is clicked
  * @param {object|string} element The element hosting the dialog or it's ID
  */
 function cancel(element) {
     hideDialog(element); const memory = dialog_box.getMemoryByContainedElement(element);
     if (memory.callbackCancel) memory.callbackCancel();
 }
 
 function _showDialogInternal(templateHTML, showOK, showCancel, hostID, retValIDs, callback, callbackCancel) {
     const shadowRoot = dialog_box.getShadowRootByHostId(hostID); _resetUI(shadowRoot);
     const templateRoot = new DOMParser().parseFromString(templateHTML, "text/html").documentElement;
     router.runShadowJSScripts(templateRoot, shadowRoot);
     const hostElement = shadowRoot.querySelector("div#dialogcontent");
     hostElement.appendChild(templateRoot);
     const modalCurtain = shadowRoot.querySelector("div#modalcurtain");
     const dialog = shadowRoot.querySelector("div#dialog");
     modalCurtain.classList.add("visible"); dialog.classList.add("visible"); 
     if (!showOK) shadowRoot.querySelector("span#ok").style.display = "none";
     if (!showCancel) {shadowRoot.querySelector("span#cancel").style.display = "none"; shadowRoot.querySelector("span#close").style.display = "none";}
     if (!showOK || !showCancel) shadowRoot.querySelector("div#buttonbar").style.justifyContent = "space-around";
     
     const memory = dialog_box.getMemory(hostID); memory.retValIDs = retValIDs; 
     memory.callback = callback; memory.callbackCancel = callbackCancel;
 }
 
 function _resetUI(shadowRoot) {
     shadowRoot.querySelector("div#error").style.visibility = "hidden";
     shadowRoot.querySelector("span#ok").style.display = "inline";
     shadowRoot.querySelector("span#cancel").style.display = "inline";
     shadowRoot.querySelector("html").style.height = "fit-content";
     shadowRoot.querySelector("body").style.height = "fit-content";
 }
 
 const trueWebComponentMode = true;	// making this false renders the component without using Shadow DOM
 export const dialog_box = {showDialog, trueWebComponentMode, hideDialog, cancel, error, showMessage, hideError, submit}
 monkshu_component.register("dialog-box", `${COMPONENT_PATH}/dialog-box.html`, dialog_box);
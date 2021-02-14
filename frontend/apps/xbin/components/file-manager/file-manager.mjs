/* 
 * (C) 2020 TekMonks. All rights reserved.
 * License: MIT - see enclosed license.txt file.
 */
import {i18n} from "/framework/js/i18n.mjs";
import {util} from "/framework/js/util.mjs";
import {router} from "/framework/js/router.mjs";
import {session} from "/framework/js/session.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

let mouseX, mouseY, menuOpen, timer, selectedPath, selectedIsDirectory, selectedElement, filesAndPercents, selectedCut, selectedCopy, shareDuration;

const DIALOG_HIDE_WAIT = 1300, DEFAULT_SHARE_EXPIRY = 5;

const API_GETFILES = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/getfiles";
const API_UPLOADFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/uploadfile";
const API_DELETEFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/deletefile";
const API_CREATEFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/createfile";
const API_RENAMEFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/renamefile";
const API_OPERATEFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/operatefile";
const API_DOWNLOADFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/downloadfile";
const API_COPYFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/copyfile";
const API_SHAREFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/sharefile";
const API_DOWNLOADFILE_SHARED = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/downloadsharedfile";

const DIALOG_HOST_ELEMENT_ID = "templateholder";
const dialog = _ => monkshu_env.components['dialog-box'];

const IO_CHUNK_SIZE = 10485760;   // 10M read buffer

async function elementConnected(element) {
   menuOpen = false; 

   const path = element.getAttribute("path") || "/"; selectedPath = path.replace(/[\/]+/g,"/"); selectedIsDirectory = true;
   let resp = await apiman.rest(API_GETFILES, "GET", {path}, true);
   if (!resp || !resp.result) return;
   
   // if a file or folder has been selected, show the paste button
   if (selectedCopy || selectedCut) resp.entries.unshift({name: await i18n.get("Paste", session.get($$.MONKSHU_CONSTANTS.LANG_ID)), path, stats:{paste: true}});

   resp.entries.unshift({name: await i18n.get("Create", session.get($$.MONKSHU_CONSTANTS.LANG_ID)), path, stats:{create: true}});
   resp.entries.unshift({name: await i18n.get("Upload", session.get($$.MONKSHU_CONSTANTS.LANG_ID)), path, stats:{upload: true}});

   if (!path.match(/^[\/]+$/g)) { // add in back and home buttons
      let parentPath = path.substring(0, path.lastIndexOf("/")); if (parentPath == "") parentPath = "/";
      resp.entries.unshift({name: await i18n.get("Back", session.get($$.MONKSHU_CONSTANTS.LANG_ID)), path:parentPath, stats:{back: true}});
      resp.entries.unshift({name: await i18n.get("Home", session.get($$.MONKSHU_CONSTANTS.LANG_ID)), path:"/", stats:{home: true}});
   }

   let data = {entries: resp.entries};

   if (element.getAttribute("styleBody")) data.styleBody = `<style>${element.getAttribute("styleBody")}</style>`;
   shareDuration = element.getAttribute("defaultShareDuration") || DEFAULT_SHARE_EXPIRY; 
   
   if (element.id) {
       if (!file_manager.datas) file_manager.datas = {}; file_manager.datas[element.id] = data;
   } else file_manager.data = data;
}

async function elementRendered(element) {
   const shadowRoot = file_manager.getShadowRootByHostId(element.getAttribute("id"));
   shadowRoot.addEventListener("mousemove", e => {mouseX = e.pageX; mouseY = e.pageY;});

   const container = shadowRoot.querySelector("div#container");
   shadowRoot.addEventListener(isMobile()?"click":"contextmenu", e => { e.preventDefault(); if (!menuOpen) showMenu(container, true); else hideMenu(container); });
   if (!isMobile()) shadowRoot.addEventListener("click", e => { e.stopPropagation(); if (menuOpen) hideMenu(container); });
}

function handleClick(element, path, isDirectory, fromClickEvent, nomenu) {
   selectedPath = path?path.replace(/[\/]+/g,"/"):selectedPath; 
   selectedIsDirectory = (isDirectory!== undefined) ? util.parseBoolean(isDirectory) : selectedIsDirectory;
   selectedElement = element;

   if (nomenu) return;
   
   if (timer) {clearTimeout(timer); if (fromClickEvent) editFile(element); timer=null;}
   else timer = setTimeout(_=> {timer=null;if ((fromClickEvent && isMobile())||!fromClickEvent) showMenu(element);}, 400);
}

function upload(containedElement) {
   filesAndPercents = {};  // reset progress indicator bucket
   file_manager.getShadowRootByContainedElement(containedElement).querySelector("input#upload").click();
}

function create(){
   dialog().showDialog(`${APP_CONSTANTS.APP_PATH}/dialogs/createfile.html`, true, true, {}, "dialog", 
         ["createType", "path"], async result => {

      const path = `${selectedPath}/${result.path}`, isDirectory = result.createType == "file" ? false: true
      const resp = await apiman.rest(API_CREATEFILE, "GET", {path, isDirectory}, true);
      if (resp.result) {dialog().hideDialog("dialog"); router.reload();} else dialog().error("dialog", await i18n.get("Error"));
   });
}

const uploadFiles = async (element, files) => {for (const file of files) uploadAFile(element, file)}

async function uploadAFile(element, file) {
   const totalChunks = Math.ceil(file.size / IO_CHUNK_SIZE); const lastChunkSize = file.size - (totalChunks-1)*IO_CHUNK_SIZE;
   const waitingReaders = [];

   const queueReadFileChunk = (fileToRead, chunkNumber, resolve, reject) => {
      const reader = new FileReader();
      const rejectReadPromises = error => {
         LOG.error(`Error reading ${fileToRead}, error is: ${error}`); 
         while (waitingReaders.length) (waitingReaders.pop())(error);   // reject all waiting readers too
         reject(error);
      }
      const onloadFunction = async loadResult => {
         const resp = await apiman.rest(API_UPLOADFILE, "POST", {data:loadResult.target.result, path:`${selectedPath}/${fileToRead.name}`}, true);
         if (!resp.result) rejectReadPromises("Error writing to the server."); else {
            showProgress(element, chunkNumber+1, totalChunks, fileToRead.name);
            if (waitingReaders.length) (waitingReaders.pop())();  // issue next chunk read if queued reads
            resolve();
         }
      }
      reader.onload = onloadFunction;
      reader.onerror = _ => rejectReadPromises(reader.error);

      // queue reads if we are waiting for a chunk to be returned, so the writes are in correct order 
      const sizeToRead = chunkNumber == totalChunks-1 ? lastChunkSize : IO_CHUNK_SIZE;
      waitingReaders.unshift(abortRead=>{
         if (!abortRead) reader.readAsDataURL(fileToRead.slice(IO_CHUNK_SIZE*chunkNumber, IO_CHUNK_SIZE*chunkNumber+sizeToRead));
         else reject(abortRead);
      });
   }

   let readPromises = []; 
   for (let i = 0; i < totalChunks; i++) readPromises.push(new Promise((resolve, reject) => queueReadFileChunk(file, i, resolve, reject)));
   const startReaders = _ => {showProgress(element, 0, totalChunks, file.name); (waitingReaders.pop())();}
   startReaders();   // kicks off the first read in the queue, which then fires others 
   return Promise.all(readPromises);
}

function showMenu(element, documentMenuOnly) {
   const shadowRoot = file_manager.getShadowRootByContainedElement(element);

   if (documentMenuOnly) {
      shadowRoot.querySelector("div#contextmenu > span#upload").classList.remove("hidden");
      shadowRoot.querySelector("div#contextmenu > span#create").classList.remove("hidden");
      if (selectedCopy || selectedCut) shadowRoot.querySelector("div#contextmenu > span#paste").classList.remove("hidden"); 
      else shadowRoot.querySelector("div#contextmenu > span#paste").classList.add("hidden"); 
      shadowRoot.querySelector("div#contextmenu > span#edit").classList.add("hidden"); 
      shadowRoot.querySelector("div#contextmenu > span#hr1").classList.add("hidden"); 
      shadowRoot.querySelector("div#contextmenu > span#sharefile").classList.add("hidden");
      shadowRoot.querySelector("div#contextmenu > span#renamefile").classList.add("hidden");
      shadowRoot.querySelector("div#contextmenu > span#deletefile").classList.add("hidden"); 
      shadowRoot.querySelector("div#contextmenu > span#downloadfile").classList.add("hidden");  
      shadowRoot.querySelector("div#contextmenu > span#hr2").classList.add("hidden"); 
      shadowRoot.querySelector("div#contextmenu > span#cut").classList.add("hidden"); 
      shadowRoot.querySelector("div#contextmenu > span#copy").classList.add("hidden");
   } else if (element.getAttribute("id") && (element.getAttribute("id") == "home" || element.getAttribute("id") == "back" || element.getAttribute("id") == "upload" || element.getAttribute("id") == "create" || element.getAttribute("id") == "paste")) {
      shadowRoot.querySelector("div#contextmenu > span#upload").classList.add("hidden");
      shadowRoot.querySelector("div#contextmenu > span#create").classList.add("hidden");
      shadowRoot.querySelector("div#contextmenu > span#hr1").classList.add("hidden"); 
      shadowRoot.querySelector("div#contextmenu > span#sharefile").classList.add("hidden");
      shadowRoot.querySelector("div#contextmenu > span#renamefile").classList.add("hidden");
      shadowRoot.querySelector("div#contextmenu > span#deletefile").classList.add("hidden"); 
      shadowRoot.querySelector("div#contextmenu > span#downloadfile").classList.add("hidden");  
      shadowRoot.querySelector("div#contextmenu > span#hr2").classList.add("hidden"); 
      shadowRoot.querySelector("div#contextmenu > span#cut").classList.add("hidden"); 
      shadowRoot.querySelector("div#contextmenu > span#copy").classList.add("hidden"); 
      shadowRoot.querySelector("div#contextmenu > span#paste").classList.add("hidden"); 
      shadowRoot.querySelector("div#contextmenu > span#edit").classList.remove("hidden");
   } else {
      shadowRoot.querySelector("div#contextmenu > span#edit").classList.remove("hidden");
      shadowRoot.querySelector("div#contextmenu > span#hr1").classList.remove("hidden"); 
      shadowRoot.querySelector("div#contextmenu > span#sharefile").classList.remove("hidden");
      shadowRoot.querySelector("div#contextmenu > span#renamefile").classList.remove("hidden");
      shadowRoot.querySelector("div#contextmenu > span#deletefile").classList.remove("hidden"); 
      shadowRoot.querySelector("div#contextmenu > span#downloadfile").classList.remove("hidden");  
      shadowRoot.querySelector("div#contextmenu > span#hr2").classList.remove("hidden"); 
      shadowRoot.querySelector("div#contextmenu > span#cut").classList.remove("hidden"); 
      shadowRoot.querySelector("div#contextmenu > span#copy").classList.remove("hidden");
      if (selectedCopy || selectedCut) shadowRoot.querySelector("div#contextmenu > span#paste").classList.remove("hidden"); 
      else shadowRoot.querySelector("div#contextmenu > span#paste").classList.add("hidden"); 
      shadowRoot.querySelector("div#contextmenu > span#upload").classList.add("hidden");
      shadowRoot.querySelector("div#contextmenu > span#create").classList.add("hidden");
   }

   const contextMenu = shadowRoot.querySelector("div#contextmenu");
   contextMenu.style.top = mouseY+"px"; contextMenu.style.left = mouseX+"px";
   contextMenu.classList.add("visible");   
   menuOpen = true;
}

function hideMenu(element) {
   const shadowRoot = file_manager.getShadowRootByContainedElement(element);
   const contextMenu = shadowRoot.querySelector("div#contextmenu");
   contextMenu.classList.remove("visible");   
   menuOpen = false;
}

function menuEventDispatcher(name, element) {
   hideMenu(element);
   file_manager[name](element);
}

async function deleteFile() {
   let resp = await apiman.rest(API_DELETEFILE, "GET", {path: selectedPath}, true);
   if (resp.result) router.reload(); else _showErrorDialog();
}

function editFile() {
   if (selectedIsDirectory) {
      const urlToLoad = util.replaceURLParamValue(session.get($$.MONKSHU_CONSTANTS.PAGE_URL), "path", selectedPath);
      router.loadPage(urlToLoad);
      return;
   } 

   if (selectedElement.id == "upload") {upload(selectedElement); return;}

   if (selectedElement.id == "create") {create(selectedElement); return;}

   if (selectedElement.id == "paste") {paste(selectedElement); return;}

   editFileLoadData();  // now it can only be a file 
}

async function editFileLoadData() {
   const resp = await apiman.rest(API_OPERATEFILE, "POST", {path: selectedPath, op: "read"}, true);
   if (resp.result) dialog().showDialog(`${APP_CONSTANTS.APP_PATH}/dialogs/editfile.html`, true, true, 
         {fileContents: resp.data}, "dialog", ["filecontents"], async result => {

      const resp = await apiman.rest(API_OPERATEFILE, "POST", {path: selectedPath, op: "write", data: result.filecontents}, true);
      dialog().hideDialog("dialog"); if (!resp.result) _showErrorDialog();
   }); else _showErrorDialog();
}

async function downloadFile(_element) {
   const paths = selectedPath.split("/"), file = paths[paths.length-1];
   const result = await apiman.blob(API_DOWNLOADFILE+"?path="+selectedPath, file, "GET", null, true, false);
   if (!result) dialog().showMessage(await i18n.get("DownloadFailed"), "dialog");
}

function cut(_element) { selectedCut = selectedPath }

function copy(_element) { selectedCopy = selectedPath }

function paste() {
   const selectedPathToOperate = selectedCut?selectedCut:selectedCopy;
   const baseName = selectedPathToOperate.substring(selectedPathToOperate.lastIndexOf("/")+1);
   if (selectedCut) _performRename(selectedCut, `${selectedPath}/${baseName}`);
   else if (selectedCopy) _performCopy(selectedCopy, `${selectedPath}/${baseName}`);
   selectedCut = null; selectedCopy = null;
}

async function showProgress(element, currentBlock, totalBlocks, fileName) {
   const templateID = "progressdialog"; 

   filesAndPercents[fileName] = Math.round(currentBlock/totalBlocks*100); 
   const files = []; for (const file of Object.keys(filesAndPercents)) files.push({name: file, percent: filesAndPercents[file]});

   await showDialog(element, templateID, {files});

   closeProgressAndReloadIfAllFilesUploaded(element, filesAndPercents);
}

function closeProgressAndReloadIfAllFilesUploaded(element, filesAndPercents) {
   for (const file of Object.keys(filesAndPercents)) if (filesAndPercents[file] != 100) return;
   setTimeout(_=>{hideDialog(element); router.reload();}, DIALOG_HIDE_WAIT); // hide dialog if all files done, after a certain wait
}

const _showErrorDialog = async hideAction => dialog().showMessage(await i18n.get("Error"), "dialog", hideAction);

async function showDialog(element, dialogTemplateID, data, hideAction) {
   data = data || {}; const shadowRoot = file_manager.getShadowRootByContainedElement(element);

   let template = shadowRoot.querySelector(`template#${dialogTemplateID}`).innerHTML; 
   const matches = /<!--([\s\S]+)-->/g.exec(template);
   if (!matches) return; template = matches[1]; // can't show progress if the template is bad
   
   const rendered = await router.expandPageData(template, session.get($$.MONKSHU_CONSTANTS.PAGE_URL), data);
   if (hideAction) shadowRoot.querySelector(`#${DIALOG_HOST_ELEMENT_ID}`)["__com_wsadmin_hideAction"] = hideAction;
   shadowRoot.querySelector(`#${DIALOG_HOST_ELEMENT_ID}`).innerHTML = rendered;
}

function hideDialog(element) {
   const hostElement = file_manager.getShadowRootByContainedElement(element).querySelector(`#${DIALOG_HOST_ELEMENT_ID}`);
   while (hostElement && hostElement.firstChild) hostElement.removeChild(hostElement.firstChild);
   const hideAction = hostElement["__com_wsadmin_hideAction"]; if (hideAction) {hideAction(element); delete hostElement["__com_wsadmin_hideAction"]}
}

function renameFile() {
   const oldName = selectedPath?selectedPath.substring(selectedPath.lastIndexOf("/")+1):null;
   dialog().showDialog(`${APP_CONSTANTS.APP_PATH}/dialogs/renamefile.html`, true, true, {oldName}, "dialog", 
         ["renamepath"], async result => {

      const subpaths = selectedPath.split("/"); subpaths.splice(subpaths.length-1, 1, result.renamepath);
      const newPath = subpaths.join("/");

      dialog().hideDialog("dialog"); _performRename(selectedPath, newPath); 
   });
}

async function shareFile() {
   const resp = await apiman.rest(API_SHAREFILE, "GET", {path: selectedPath, expiry: shareDuration}, true);
   if (!resp || !resp.result) _showErrorDialog(); else dialog().showDialog(
         `${APP_CONSTANTS.APP_PATH}/dialogs/sharefile.html`, true, false, 
         {link: `${API_DOWNLOADFILE_SHARED}?id=${resp.id}`, id: resp.id, shareDuration}, "dialog", ["expiry"], 
         async result => {

      dialog().hideDialog("dialog");
      if (result.expiry != shareDuration) await apiman.rest(API_SHAREFILE, "GET", {id: resp.id, expiry: result.expiry}, true); 
   });
}

function isMobile() {
   return true; //return navigator.maxTouchPoints?true:false;
}

async function _performRename(oldPath, newPath) {
   const resp = await apiman.rest(API_RENAMEFILE, "GET", {old: oldPath, new: newPath}, true);
   if (!resp || !resp.result) _showErrorDialog(_=>router.reload()); else router.reload();
}

async function _performCopy(fromPath, toPath) {
   const resp = await apiman.rest(API_COPYFILE, "GET", {from: fromPath, to: toPath}, true);
   if (!resp || !resp.result) _showErrorDialog(_=>router.reload()); else router.reload();
}

export const file_manager = { trueWebComponentMode: true, elementConnected, elementRendered, handleClick, 
   showMenu, deleteFile, editFile, downloadFile, cut, copy, paste, upload, uploadFiles, hideDialog,  create, 
   shareFile, renameFile, menuEventDispatcher, isMobile }
monkshu_component.register("file-manager", `${APP_CONSTANTS.APP_PATH}/components/file-manager/file-manager.html`, file_manager);
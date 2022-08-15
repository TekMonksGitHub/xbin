/**
 * Filemanager component. Can be used only one instance per page for now, due to 
 * local variables inside the component.
 * 
 * Future versions may be multi-instance capable via using component memory instead
 * of local variables.
 *  
 * (C) 2020 TekMonks. All rights reserved.
 * License: MIT - see enclosed license.txt file.
 */
import {i18n} from "/framework/js/i18n.mjs";
import {util} from "/framework/js/util.mjs";
import {router} from "/framework/js/router.mjs";
import {session} from "/framework/js/session.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

let user, mouseX, mouseY, menuOpen, timer, selectedPath, selectedIsDirectory, selectedElement, filesAndPercents = {}, selectedCut, selectedCopy, shareDuration, showNotification;

const API_GETFILES = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/getfiles";
const API_COPYFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/copyfile";
const API_SHAREFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/sharefile";
const API_UPLOADFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/uploadfile";
const API_DELETEFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/deletefile";
const API_CREATEFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/createfile";
const API_RENAMEFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/renamefile";
const API_OPERATEFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/operatefile";
const API_DOWNLOADFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/downloadfile";
const COMPONENT_PATH = util.getModulePath(import.meta), DIALOGS_PATH = `${COMPONENT_PATH}/dialogs`;
const API_DOWNLOADFILE_GETSECURID = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/getsecurid";
const API_DOWNLOADFILE_STATUS = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/getdownloadstatus";
const API_DOWNLOADFILE_DND = APP_CONSTANTS.FRONTEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/proxiedapis/downloaddnd";
let PAGE_DOWNLOADFILE_SHARED = `${APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/downloadsharedfile"}`;

const DIALOG_SCROLL_ELEMENT_ID = "notificationscrollpositioner", DIALOG_HOST_ELEMENT_ID = "notification", PROGRESS_TEMPLATE="progressdialog", DEFAULT_SHARE_EXPIRY = 5;
const DOUBLE_CLICK_DELAY=400, DOWNLOADFILE_REFRESH_INTERVAL = 500, UPLOAD_ICON = "⇧", DOWNLOAD_ICON = "⇩";
const dialog = _ => monkshu_env.components['dialog-box'];
const isMobile = _ => true;//navigator.maxTouchPoints?true:false;

const IO_CHUNK_SIZE = 10485760;   // 10M read buffer

async function elementConnected(element) {
   menuOpen = false; user = element.getAttribute("user");

   const path = element.getAttribute("path") || "/"; selectedPath = path.replace(/[\/]+/g,"/"); selectedIsDirectory = true;
   const resp = await apiman.rest(API_GETFILES, "GET", {path}, true); if (!resp || !resp.result) return; 
   for (const entry of resp.entries) {entry.stats.name = entry.name; entry.stats.json = JSON.stringify(entry.stats);}
   
   // if a file or folder has been selected, show the paste button
   if (selectedCopy || selectedCut) resp.entries.unshift({name: await i18n.get("Paste"), path, stats:{paste: true}});

   resp.entries.unshift({name: await i18n.get("Create"), path, stats:{create: true}});
   resp.entries.unshift({name: await i18n.get("Upload"), path, stats:{upload: true}});

   if (!path.match(/^[\/]+$/g)) { // add in back and home buttons
      let parentPath = path.substring(0, path.lastIndexOf("/")); if (parentPath == "") parentPath = "/";
      resp.entries.unshift({name: await i18n.get("Back"), path:parentPath, stats:{back: true}});
      resp.entries.unshift({name: await i18n.get("Home"), path:"/", stats:{home: true}});
   }

   const data = {entries: resp.entries, COMPONENT_PATH: `${APP_CONSTANTS.COMPONENTS_PATH}/file-manager`};

   if (element.getAttribute("styleBody")) data.styleBody = `<style>${element.getAttribute("styleBody")}</style>`;
   shareDuration = element.getAttribute("defaultShareDuration") || DEFAULT_SHARE_EXPIRY; 
   
   file_manager.setData(element.id, data);

   if (element.getAttribute("downloadpage")) PAGE_DOWNLOADFILE_SHARED = element.getAttribute("downloadpage");
}

async function elementRendered(element) {
   const shadowRoot = file_manager.getShadowRootByHostId(element.getAttribute("id"));
   shadowRoot.addEventListener("mousemove", e => {mouseX = e.clientX; mouseY = e.clientY;});

   const container = shadowRoot.querySelector("div#container");
   shadowRoot.addEventListener(isMobile()?"click":"contextmenu", e => { e.preventDefault(); if (!menuOpen) showMenu(container, true); else hideMenu(container); });
   if (!isMobile()) shadowRoot.addEventListener("click", e => { e.stopPropagation(); if (menuOpen) hideMenu(container); });

   if (showNotification) _showNotification(container, PROGRESS_TEMPLATE);
}

function handleClick(element, path, isDirectory, fromClickEvent, nomenu) {
   selectedPath = path?path.replace(/[\/]+/g,"/"):selectedPath; 
   selectedIsDirectory = (isDirectory!== undefined) ? util.parseBoolean(isDirectory) : selectedIsDirectory;
   selectedElement = element; const event = element.getAttribute("stats")?JSON.parse(element.getAttribute("stats")):null;  // used below in eval
   const hostElement = file_manager.getHostElement(element); if (hostElement.getAttribute("onselect")) eval(hostElement.getAttribute("onselect"));

   if (nomenu) return;
   
   if (timer) {clearTimeout(timer); if (fromClickEvent) editFile(element); timer=null;}
   else timer = setTimeout(_=> { timer=null; 
      if ((fromClickEvent && isMobile())||!fromClickEvent) {if (!menuOpen) showMenu(element); else hideMenu(element); return;}
      if (fromClickEvent && menuOpen) hideMenu(element); // menu is open and user clicked anywhere, close it
   }, DOUBLE_CLICK_DELAY);
}

function upload(containedElement, files) {
   if (!files) file_manager.getShadowRootByContainedElement(containedElement).querySelector("input#upload").click(); // upload button clicked
   else uploadFiles(containedElement, files);   // drag and drop happened
}

function create(element) {
   dialog().showDialog(`${DIALOGS_PATH}/createfile.html`, true, true, {}, "dialog", ["createType", "path"], async result => {
      const path = `${selectedPath}/${result.path}`, isDirectory = result.createType == "file" ? false: true
      const resp = await apiman.rest(API_CREATEFILE, "GET", {path, isDirectory}, true), hostID = file_manager.getHostElementID(element);
      if (resp.result) {dialog().hideDialog("dialog"); file_manager.reload(hostID);} else dialog().error("dialog", await i18n.get("Error"));
   });
}

const uploadFiles = async (element, files) => {
   for (const file of files) {
      if (Object.keys(filesAndPercents).includes(file.name) && filesAndPercents[file.name].percent != 100 && !filesAndPercents[file.name].cancelled) {LOG.info(`Skipped ${file.name}, already being uploaded.`); continue;}  // already being uploaded
      else _uploadAFile(element, file);
   }
}

async function _uploadAFile(element, file) {
   const totalChunks = file.size != 0 ? Math.ceil(file.size / IO_CHUNK_SIZE) : 1, lastChunkSize = file.size - (totalChunks-1)*IO_CHUNK_SIZE;
   if (filesAndPercents[file.name]?.cancelled) filesAndPercents[file.name].cancelled = false; // being reuploaded
   const waitingReaders = [];  

   const queueReadFileChunk = (fileToRead, chunkNumber, resolve, reject) => {
      const _rejectReadPromises = error => {
         LOG.error(`Error reading ${fileToRead}, error is: ${error}`); 
         while (waitingReaders.length) (waitingReaders.pop())(error);   // reject all waiting readers too
         reject(error);
      }
      const reader = new FileReader(), savePath = selectedPath;
      reader.onload = async loadResult => {
         const dataToPost = file.size != 0 ? loadResult.target.result : "data:;base64,";  // handle 0 byte files
         const resp = await apiman.rest(API_UPLOADFILE, "POST", {data:dataToPost, path:`${savePath}/${fileToRead.name}`, user}, true);
         if (!resp.result) _rejectReadPromises("Error writing to the server."); else {
            _showProgress(element, chunkNumber+1, totalChunks, fileToRead.name, UPLOAD_ICON);
            if (!filesAndPercents[fileToRead.name]?.cancelled && (waitingReaders.length)) (waitingReaders.pop())();  // issue next chunk read if queued reads
            else if (filesAndPercents[fileToRead.name]?.cancelled) await apiman.rest(API_DELETEFILE, "GET", {path: `${savePath}/${fileToRead.name}`}, true);
            resolve();
         }
      }
      reader.onerror = _ => _rejectReadPromises(reader.error);

      // queue reads if we are waiting for a chunk to be returned, so the writes are in correct order 
      const sizeToRead = chunkNumber == totalChunks-1 ? lastChunkSize : IO_CHUNK_SIZE;
      waitingReaders.unshift(abortRead=>{
         if (!abortRead) reader.readAsDataURL(fileToRead.slice(IO_CHUNK_SIZE*chunkNumber, IO_CHUNK_SIZE*chunkNumber+sizeToRead));
         else reject(abortRead);
      });
   }

   let readPromises = []; 
   for (let i = 0; i < totalChunks; i++) readPromises.push(new Promise((resolve, reject) => queueReadFileChunk(file, i, resolve, reject)));
   const startReaders = _ => {_showProgress(element, 0, totalChunks, file.name, UPLOAD_ICON); (waitingReaders.pop())();}
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

async function deleteFile(element) {
   let resp = await apiman.rest(API_DELETEFILE, "GET", {path: selectedPath}, true);
   if (resp.result) file_manager.reload(file_manager.getHostElementID(element)); else _showErrorDialog();
}

function editFile(element) {
   if (selectedIsDirectory) {
      const host = file_manager.getHostElement(element); host.setAttribute("path", selectedPath); 
      file_manager.reload(host.id); return;
   } 

   if (selectedElement.id == "upload") {upload(selectedElement); return;}

   if (selectedElement.id == "create") {create(selectedElement); return;}

   if (selectedElement.id == "paste") {paste(selectedElement); return;}

   editFileLoadData();  // now it can only be a file 
}

async function editFileLoadData() {
   const resp = await apiman.rest(API_OPERATEFILE, "POST", {path: selectedPath, op: "read"}, true);
   if (resp.result) dialog().showDialog(`${DIALOGS_PATH}/editfile.html`, true, true, {fileContents: resp.data}, 
         "dialog", ["filecontents"], async result => {

      const resp = await apiman.rest(API_OPERATEFILE, "POST", {path: selectedPath, op: "write", data: result.filecontents}, true);
      dialog().hideDialog("dialog"); if (!resp.result) _showErrorDialog();
   }); else _showErrorDialog();
}

const _getReqIDForDownloading = path => encodeURIComponent(path+Date.now()+Math.random());

async function downloadFile(element) {
   const paths = selectedPath.split("/"), file = paths[paths.length-1], reqid = _getReqIDForDownloading(selectedPath);
   const link = document.createElement("a"), securid = await apiman.rest(API_DOWNLOADFILE_GETSECURID, "GET", {path: selectedPath, reqid}, true, false);
   if (!securid.result) {_showErrorDialog(); return;}; const auth = apiman.getJWTToken(API_DOWNLOADFILE);
   link.download = file; link.href = `${API_DOWNLOADFILE}?path=${selectedPath}&reqid=${reqid}&securid=${securid.id}&auth=${auth}`; link.click(); 

   _showDownloadProgress(element, selectedPath, reqid);
}

function getDragAndDropDownloadURL(path, element) {
   const reqid = _getReqIDForDownloading(path), auth = apiman.getJWTToken(API_DOWNLOADFILE); element["data-reqid"] = reqid;
   const url = `${API_DOWNLOADFILE_DND}?path=${path}&reqid=${reqid}&auth=${auth}`;
   return url;
}

const showDownloadProgress = (path, element) => _showDownloadProgress(element, path, element["data-reqid"]);

function cut(_element) { selectedCut = selectedPath }

function copy(_element) { selectedCopy = selectedPath }

function paste(element) {
   const selectedPathToOperate = selectedCut?selectedCut:selectedCopy;
   const baseName = selectedPathToOperate.substring(selectedPathToOperate.lastIndexOf("/")+1);
   if (selectedCut) _performRename(selectedCut, `${selectedPath}/${baseName}`, element);
   else if (selectedCopy) _performCopy(selectedCopy, `${selectedPath}/${baseName}`, element);
   selectedCut = null; selectedCopy = null;
}

function _showDownloadProgress(element, path, reqid) {
   let interval, done = false;
   const updateProgress = async _ => {
      if (done) return;
      const fileDownloadStatus = await apiman.rest(`${API_DOWNLOADFILE_STATUS}`, "GET", {reqid}, true, false);
      if (fileDownloadStatus && fileDownloadStatus.result) {
         if (fileDownloadStatus.size!=-1) _showProgress(element, fileDownloadStatus.bytesSent, fileDownloadStatus.size, path, DOWNLOAD_ICON);
         if (fileDownloadStatus.size == fileDownloadStatus.bytesSent) {done = true; clearInterval(interval);}
      }
      else { 
         if (done) return; else done=true; 
         dialog().showMessage(await i18n.get("DownloadFailed"), "dialog"); clearInterval(interval); 
      }
   }
   interval = setInterval(updateProgress, DOWNLOADFILE_REFRESH_INTERVAL);
}

async function _showProgress(element, currentBlock, totalBlocks, fileName, icon) {
   if (filesAndPercents[fileName]?.cancelled) return; // already cancelled

   filesAndPercents[fileName] = {name: fileName, percent: Math.floor(currentBlock/totalBlocks*100), icon, cancellable:icon==UPLOAD_ICON?true:null}; 
   await _showNotification(element, PROGRESS_TEMPLATE);

   _reloadIfAllFilesUpOrDownloaded(element, filesAndPercents);
}

function _reloadIfAllFilesUpOrDownloaded(element, filesAndPercents) {
   for (const file of Object.keys(filesAndPercents)) if (filesAndPercents[file].percent != 100) return;
   file_manager.reload(file_manager.getHostElementID(element)); 
}

function renameFile(element) {
   const oldName = selectedPath?selectedPath.substring(selectedPath.lastIndexOf("/")+1):null;
   dialog().showDialog(`${DIALOGS_PATH}/renamefile.html`, true, true, {oldName}, "dialog", ["renamepath"], async result => {
      const subpaths = selectedPath.split("/"); subpaths.splice(subpaths.length-1, 1, result.renamepath);
      const newPath = subpaths.join("/");

      dialog().hideDialog("dialog"); _performRename(selectedPath, newPath, element); 
   });
}

async function shareFile() {
   const paths = selectedPath.split("/"), name = paths[paths.length-1];
   const resp = await apiman.rest(API_SHAREFILE, "GET", {path: selectedPath, expiry: shareDuration}, true);
   if (!resp || !resp.result) _showErrorDialog(); else dialog().showDialog( `${DIALOGS_PATH}/sharefile.html`, true, true, 
      {link: router.encodeURL(`${PAGE_DOWNLOADFILE_SHARED}?id=${resp.id}&name=${name}`), id: resp.id, shareDuration}, 
      "dialog", ["expiry"], async result => {
            dialog().hideDialog("dialog");
            if (result.expiry != shareDuration) apiman.rest(API_SHAREFILE, "GET", {id: resp.id, expiry: result.expiry}, true); 
      }, async _ => apiman.rest(API_SHAREFILE, "GET", {id: resp.id, expiry: 0}, true));
}

const _showErrorDialog = async hideAction => dialog().showMessage(await i18n.get("Error"), "dialog", hideAction);

async function _showNotification(element, dialogTemplateID) {
   showNotification = true;
   const templateData = {files:[]}; for (const file of Object.keys(filesAndPercents))
      templateData.files.unshift({name: file, ...filesAndPercents[file], cancelled: filesAndPercents[file].cancelled?true:null});
   const shadowRoot = file_manager.getShadowRootByContainedElement(element);

   let template = shadowRoot.querySelector(`template#${dialogTemplateID}`).innerHTML; 
   const matches = /<!--([\s\S]+)-->/g.exec(template);
   if (!matches) return; template = matches[1]; // can't show progress if the template is bad

   const rendered = await router.expandPageData(template, session.get($$.MONKSHU_CONSTANTS.PAGE_URL), templateData);
   const hostElement = shadowRoot.querySelector(`#${DIALOG_HOST_ELEMENT_ID}`), scrollElement = shadowRoot.querySelector(`#${DIALOG_SCROLL_ELEMENT_ID}`);
   hostElement.innerHTML = rendered; 
   if (!hostElement.classList.contains("visible")) hostElement.classList.add("visible"); 
   if (!scrollElement.classList.contains("visible")) scrollElement.classList.add("visible"); 
}

function hideNotification(element) {
   showNotification = false;
   const shadowRoot = file_manager.getShadowRootByContainedElement(element);
   const hostElement = shadowRoot.querySelector(`#${DIALOG_HOST_ELEMENT_ID}`), scrollElement = shadowRoot.querySelector(`#${DIALOG_SCROLL_ELEMENT_ID}`);
   while (hostElement && hostElement.firstChild) hostElement.removeChild(hostElement.firstChild);
   hostElement.classList.remove("visible"); scrollElement.classList.remove("visible"); 
}

function cancelFile(file, element) {
   filesAndPercents[file].cancelled = true; _showNotification(element, PROGRESS_TEMPLATE);  // updates the view
}

async function _performRename(oldPath, newPath, element) {
   const resp = await apiman.rest(API_RENAMEFILE, "GET", {old: oldPath, new: newPath}, true), hostID = file_manager.getHostElementID(element);
   if (!resp || !resp.result) _showErrorDialog(_=>file_manager.reload(hostID)); else file_manager.reload(hostID);
}

async function _performCopy(fromPath, toPath, element) {
   const resp = await apiman.rest(API_COPYFILE, "GET", {from: fromPath, to: toPath}, true), hostID = file_manager.getHostElementID(element)
   if (!resp || !resp.result) _showErrorDialog(_=>file_manager.reload(hostID)); else file_manager.reload(hostID);
}

export const file_manager = { trueWebComponentMode: true, elementConnected, elementRendered, handleClick, 
   showMenu, deleteFile, editFile, downloadFile, cut, copy, paste, upload, uploadFiles, create, shareFile, 
   renameFile, menuEventDispatcher, isMobile, getDragAndDropDownloadURL, showDownloadProgress, hideNotification,
   cancelFile }
monkshu_component.register("file-manager", `${APP_CONSTANTS.APP_PATH}/components/file-manager/file-manager.html`, file_manager);
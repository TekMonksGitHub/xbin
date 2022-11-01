/**
 * Filemanager component. Can be used only one instance per page for now, due to 
 * local variables inside the component.
 * 
 * Future versions may be multi-instance capable via using component memory instead
 * of local variables.
 *  
 * (C) 2020 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */
import {i18n} from "/framework/js/i18n.mjs";
import {util} from "/framework/js/util.mjs";
import {router} from "/framework/js/router.mjs";
import {blackboard} from "/framework/js/blackboard.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

let user, mouseX, mouseY, menuOpen, timer, selectedPath, selectedIsDirectory, selectedElement, filesAndPercents = {}, 
   selectedCutPath, selectedCopyPath, selectedCutCopyElement, shareDuration, showNotification;

const API_GETFILES = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/getfiles";
const API_COPYFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/copyfile";
const API_SHAREFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/sharefile";
const API_UPLOADFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/uploadfile";
const API_DELETEFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/deletefile";
const API_CREATEFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/createfile";
const API_RENAMEFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/renamefile";
const API_CHECKQUOTA = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/checkquota";
const API_OPERATEFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/operatefile";
const API_DOWNLOADFILE = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/downloadfile";
const COMPONENT_PATH = util.getModulePath(import.meta), DIALOGS_PATH = `${COMPONENT_PATH}/dialogs`;
const API_CHECKFILEEXISTS = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/checkfileexists";
const API_DOWNLOADFILE_GETSECURID = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/getsecurid";
const API_DOWNLOADFILE_STATUS = APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/getdownloadstatus";
const API_DOWNLOADFILE_DND = APP_CONSTANTS.FRONTEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/proxiedapis/downloaddnd";
let PAGE_DOWNLOADFILE_SHARED = `${APP_CONSTANTS.BACKEND+"/apps/"+APP_CONSTANTS.APP_NAME+"/downloadsharedfile"}`;

const DIALOG_SCROLL_ELEMENT_ID = "notificationscrollpositioner", DIALOG_HOST_ELEMENT_ID = "notification", PROGRESS_TEMPLATE="progressdialog", DEFAULT_SHARE_EXPIRY = 5;
const DOUBLE_CLICK_DELAY=400, DOWNLOADFILE_REFRESH_INTERVAL = 500, UPLOAD_ICON = "⇧", DOWNLOAD_ICON = "⇩";
const dialog = _ => monkshu_env.components['dialog-box'];
const isMobile = _ => $$.isMobile();

const IO_CHUNK_SIZE = 10485760;   // 10M read buffer

async function elementConnected(host) {
   menuOpen = false; user = host.getAttribute("user");

   const path = host.getAttribute("path") || (file_manager.getSessionMemory(host.id))["__lastPath"] || "/"; 
   selectedPath = path.replace(/[\/]+/g,"/"); selectedIsDirectory = true;
   const resp = await apiman.rest(API_GETFILES, "GET", {path}, true); if (!resp || !resp.result) return; 
   for (const entry of resp.entries) {if (entry.path.replace(/[\/]+/g,"/") == selectedCutPath) entry.cutimage = "_cutimage"; 
      entry.stats.name = entry.name; entry.stats.json = JSON.stringify(entry.stats);}
   
   // if a file or folder has been selected, show the paste button
   if (selectedCopyPath || selectedCutPath) resp.entries.unshift({name: await i18n.get("Paste"), path, stats:{paste: true}});

   resp.entries.unshift({name: await i18n.get("Create"), path, stats:{create: true}});
   resp.entries.unshift({name: await i18n.get("Upload"), path, stats:{upload: true}});

   if (!path.match(/^[\/]+$/g)) { // add in back and home buttons
      let parentPath = path.substring(0, path.lastIndexOf("/")); if (parentPath == "") parentPath = "/";
      resp.entries.unshift({name: await i18n.get("Back"), path:parentPath, stats:{back: true}});
      resp.entries.unshift({name: await i18n.get("Home"), path:"/", stats:{home: true}});
   }

   const data = {entries: resp.entries, COMPONENT_PATH: `${APP_CONSTANTS.COMPONENTS_PATH}/file-manager`};

   if (host.getAttribute("styleBody")) data.styleBody = `<style>${host.getAttribute("styleBody")}</style>`;
   shareDuration = host.getAttribute("defaultShareDuration") || DEFAULT_SHARE_EXPIRY; 
   
   file_manager.setData(host.id, data);

   if (host.getAttribute("downloadpage")) PAGE_DOWNLOADFILE_SHARED = host.getAttribute("downloadpage");
}

async function elementRendered(element) {
   const shadowRoot = file_manager.getShadowRootByHostId(element.getAttribute("id"));
   shadowRoot.addEventListener("mousemove", e => {mouseX = e.clientX; mouseY = e.clientY;});

   const container = shadowRoot.querySelector("div#filelistingscontainer");
   shadowRoot.addEventListener(isMobile()?"click":"contextmenu", e => { 
      e.stopPropagation(); e.preventDefault(); if (e.___handled) return; else e.___handled = true; 
      if (!menuOpen) showMenu(container, true); else hideMenu(container); });
   if (!isMobile()) shadowRoot.addEventListener("click", e => { e.stopPropagation(); if (menuOpen) hideMenu(container); });

   if (showNotification) _showNotification(container, PROGRESS_TEMPLATE);

   if (element.getAttribute("quotabarids")) _updateQuotaBars(element.getAttribute("quotabarids").split(","));
}

function handleClick(element, path, isDirectory, fromClickEvent, nomenu) {
   selectedPath = path?path.replace(/[\/]+/g,"/"):selectedPath; 
   selectedIsDirectory = (isDirectory!== undefined) ? util.parseBoolean(isDirectory) : selectedIsDirectory;
   selectedElement = element; const event = JSON.parse(element.dataset.stats||"{}");  // used below in eval
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

async function create(element) {
   const result = await dialog().showDialog(`${DIALOGS_PATH}/createfile.html`, true, true, {}, "dialog", ["createType", "path"]);
   const path = `${selectedPath}/${result.path}`, isDirectory = result.createType == "file" ? false: true
   if ((await apiman.rest(API_CHECKFILEEXISTS, "GET", {path}, true))?.result) {   // don't overwrite an existing file
      dialog().error("dialog", await i18n.get("FileAlreadyExists")); LOG.error(`Create failed as ${path} already exists.`); return;
   }
   const resp = await apiman.rest(API_CREATEFILE, "GET", {path, isDirectory}, true), hostID = file_manager.getHostElementID(element);
   if (resp.result) {dialog().hideDialog("dialog"); file_manager.reload(hostID);} else dialog().error("dialog", await i18n.get("Error"));
}

const uploadFiles = async (element, files) => {
   let uploadSize = 0; for (const file of files) uploadSize += file.size; if (!(await _checkQuotaAndReportError(uploadSize))) return;
   for (const file of files) {
      if (Object.keys(filesAndPercents).includes(file.name) && filesAndPercents[file.name].percent != 100 && 
         !filesAndPercents[file.name].cancelled) {LOG.info(`Skipped ${file.name}, already being uploaded.`); continue;}  // already being uploaded
      
      const checkFileExists = await apiman.rest(API_CHECKFILEEXISTS, "GET", {path: `${selectedPath}/${file.name}`}, true); 
      if (checkFileExists.result) {
         const cancelRenameRewrite = await dialog().showDialog(`${DIALOGS_PATH}/cancel_rename_overwrite.html`, true, false, 
            {fileexistswarning: await i18n.getRendered("FileExistsWarning", {name: file.name})}, "dialog", ["result"]);
         switch (cancelRenameRewrite.result) {
            case "cancel": {LOG.info(`User selected to skip existing file ${file.name}, skipping.`); continue;}
            case "rename": file.renameto = checkFileExists.suggestedNewName; break;
            case "overwrite": {
               const deleteResult = await apiman.rest(API_DELETEFILE, "GET", {path: `${selectedPath}/${file.name}`}, true);
               if (!deleteResult.result) {dialog().showMessage(`${await i18n.get("OverwriteFailed")}${file.name}`, "dialog"); continue;}
               else break;
            }
            default: {LOG.info(`Invalid choice so skipping existing file ${file.name}, skipping.`); continue;}
         }
      }

      _uploadAFile(element, file);
   }
}

async function _uploadAFile(element, file) {
   const totalChunks = file.size != 0 ? Math.ceil(file.size / IO_CHUNK_SIZE) : 1, lastChunkSize = file.size - (totalChunks-1)*IO_CHUNK_SIZE;
   const _getName = file => file.renameto || file.name;
   if (filesAndPercents[_getName(file)]?.cancelled) filesAndPercents[_getName(file)].cancelled = false; // being reuploaded
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
         const resp = await apiman.rest(API_UPLOADFILE, "POST", {data:dataToPost, path:`${savePath}/${_getName(fileToRead)}`, user}, true);
         if (!resp.result) _rejectReadPromises("Error writing to the server."); else {
            _showProgress(element, chunkNumber+1, totalChunks, _getName(fileToRead), UPLOAD_ICON);
            if (!filesAndPercents[_getName(fileToRead)]?.cancelled && (waitingReaders.length)) (waitingReaders.pop())();  // issue next chunk read if queued reads
            else if (filesAndPercents[_getName(fileToRead)]?.cancelled) await apiman.rest(API_DELETEFILE, "GET", {path: `${savePath}/${_getName(fileToRead)}`}, true);
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
   const startReaders = _ => {_showProgress(element, 0, totalChunks, _getName(file), UPLOAD_ICON); (waitingReaders.pop())();}
   startReaders();   // kicks off the first read in the queue, which then fires others 
   return Promise.all(readPromises);
}

function showMenu(element, documentMenuOnly) {
   const shadowRoot = file_manager.getShadowRootByContainedElement(element);

   if (documentMenuOnly) {
      shadowRoot.querySelector("div#contextmenu > span#upload").classList.remove("hidden");
      shadowRoot.querySelector("div#contextmenu > span#create").classList.remove("hidden");
      if (selectedCopyPath || selectedCutPath) shadowRoot.querySelector("div#contextmenu > span#paste").classList.remove("hidden"); 
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
      if (selectedCopyPath || selectedCutPath) shadowRoot.querySelector("div#contextmenu > span#paste").classList.remove("hidden"); 
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
      (file_manager.getSessionMemory(host.id))["__lastPath"] = selectedPath; file_manager.reload(host.id); return;
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

function editFileVisible() {
   const shadowRootDialog = dialog().getShadowRootByHostId("dialog");
   const elementTextArea = shadowRootDialog.querySelector("textarea#filecontents"); elementTextArea.focus();
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

function cut(element) { selectedCutPath = selectedPath; selectedCutCopyElement = selectedElement.cloneNode(); 
   file_manager.reload(file_manager.getHostElementID(element)); }

function copy(_element) { selectedCopyPath = selectedPath; selectedCutCopyElement = selectedElement.cloneNode(); }

async function paste(element) {
   const selectedPathToOperate = selectedCutPath?selectedCutPath:selectedCopyPath;
   const baseName = selectedPathToOperate.substring(selectedPathToOperate.lastIndexOf("/")+1);
   if (selectedCutPath) await _performRename(selectedCutPath, `${selectedPath}/${baseName}`, element);
   else if (selectedCopyPath) await _performCopy(selectedCopyPath, `${selectedPath}/${baseName}`, element);
   selectedCutPath = null; selectedCopyPath = null; selectedCutCopyElement = null;
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
      else if (!done) {
         done=true; clearInterval(interval); 
         dialog().showMessage(await i18n.get("DownloadFailed"), "dialog"); 
      }
   }
   interval = setInterval(updateProgress, DOWNLOADFILE_REFRESH_INTERVAL);
}

async function _showProgress(element, currentBlock, totalBlocks, fileName, icon) {
   if (filesAndPercents[fileName]?.cancelled) return; // already cancelled

   const percent = Math.floor(currentBlock/totalBlocks*100);
   filesAndPercents[fileName] = {name: fileName, percent, icon, cancellable: (icon==UPLOAD_ICON && percent != 100?true:null)}; 
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

const _showErrorDialog = async (hideAction, message) => dialog().showMessage(message||await i18n.get("Error"), "dialog", hideAction||undefined);

async function _showNotification(element, dialogTemplateID) {
   showNotification = true;
   const templateData = {files:[]}; for (const file of Object.keys(filesAndPercents))
      templateData.files.unshift({name: file, ...filesAndPercents[file], cancelled: filesAndPercents[file].cancelled?true:null});
   const shadowRoot = file_manager.getShadowRootByContainedElement(element);

   let template = shadowRoot.querySelector(`template#${dialogTemplateID}`).innerHTML; 
   const matches = /<!--([\s\S]+)-->/g.exec(template);
   if (!matches) return; template = matches[1]; // can't show progress if the template is bad

   const rendered = await router.expandPageData(template, router.getLastSessionURL(), templateData);
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
   const sizeOfCopy = JSON.parse(selectedCutCopyElement.dataset.stats).size; if (!(await _checkQuotaAndReportError(sizeOfCopy))) return;
   const resp = await apiman.rest(API_COPYFILE, "GET", {from: fromPath, to: toPath}, true), hostID = file_manager.getHostElementID(element)
   if (!resp || !resp.result) _showErrorDialog(_=>file_manager.reload(hostID)); else file_manager.reload(hostID);
}

const _roundToTwo = number => Math.round(number * 100)/100;

const _checkQuotaAndReportError = async uploadSize => {
   const uploadQuotaCheckResult = await apiman.rest(API_CHECKQUOTA, "GET", {bytestowrite: uploadSize}, true);
   if ((!uploadQuotaCheckResult) || (!uploadQuotaCheckResult.result)) { // stop upload if it will exceed the quota
      if (uploadQuotaCheckResult) LOG.error(`Upload size exceeds quota. User ID is ${user}, upload size ${uploadSize}, quota is ${uploadQuotaCheckResult.quota} and the current user disk size is ${uploadQuotaCheckResult.currentsize}.`); 
      else LOG.error("Check quota call failed, unable to upload for user "+user);
      _showErrorDialog(null, uploadQuotaCheckResult ? (await router.getMustache()).render((await i18n.get("UploadQuotaExceeded")), 
         {diskAvailableMB: _roundToTwo((uploadQuotaCheckResult.quota-uploadQuotaCheckResult.currentsize)/(1024*1024)), 
         diskMaxGB: _roundToTwo(uploadQuotaCheckResult.quota/(1024*1024*1024)), uploadSizeMB: _roundToTwo(uploadSize/(1024*1024))}) : undefined); 
      return false; 
   } else return true;
}

const _updateQuotaBars = async quotabarIDs => {
   const quotaStats = await apiman.rest(API_CHECKQUOTA, "GET", {bytestowrite: 0}, true); if (!quotaStats) return; // can't update
   const percentUsed = _roundToTwo(quotaStats.currentsize/quotaStats.quota), quotaGB = _roundToTwo(quotaStats.quota/(1024*1024*1024));
   const _setupUpdateWhenProgressBarLive = _ => {
      blackboard.registerListener(monkshu_component.BLACKBOARD_MESSAGE_COMPONENT_RENDERED, component => {
         for (const quotabarID of quotabarIDs) if (component == `progress-bar#${quotabarID}`) _updateQuotaBars([quotabarID]); });
   }
   const progress_bar = window.monkshu_env.components["progress-bar"]; if (!progress_bar) {_setupUpdateWhenProgressBarLive(); return;}  // nothing to do
   for (const quotabarID of quotabarIDs) progress_bar.setValue(quotabarID, {value: percentUsed, quotaGB});
}

export const file_manager = { trueWebComponentMode: true, elementConnected, elementRendered, handleClick, 
   showMenu, deleteFile, editFile, downloadFile, cut, copy, paste, upload, uploadFiles, create, shareFile, 
   renameFile, menuEventDispatcher, isMobile, getDragAndDropDownloadURL, showDownloadProgress, hideNotification,
   cancelFile, editFileVisible }
monkshu_component.register("file-manager", `${COMPONENT_PATH}/file-manager.html`, file_manager);
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

let user, mouseX, mouseY, menuOpen, timer, selectedPath, currentlyActiveFolder, selectedIsDirectory, selectedElement, 
   filesAndPercents = {}, selectedCutPath, selectedCopyPath, selectedCutCopyElement, shareDuration, showNotification, 
   currentWriteBufferSize;

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
const DOUBLE_CLICK_DELAY=400, DOWNLOADFILE_REFRESH_INTERVAL = 1000, UPLOAD_ICON = "⇧", DOWNLOAD_ICON = "⇩";
const dialog = _ => monkshu_env.components['dialog-box'];
const isMobile = _ => $$.isMobile();

const IO_CHUNK_SIZE = 10485760, INITIAL_UPLOAD_BUFFER_SIZE = 40960, MAX_UPLOAD_WAIT_TIME_SECONDS = 5, 
   MAX_UPLOAD_BUFFER_SIZE = 10485760;   // 10M read buffer, 40K initial write buffer, wait max 5 seconds to upload each chunk

async function elementConnected(host) {
   menuOpen = false; user = host.getAttribute("user");

   const path = host.getAttribute("path") || (file_manager.getSessionMemory(host.id))["__lastPath"] || "/"; 
   selectedPath = path.replace(/[\/]+/g,"/"); selectedIsDirectory = true; currentlyActiveFolder = selectedPath;
   const resp = await apiman.rest(API_GETFILES, "GET", {path}, true); if (!resp || !resp.result) return; 
   for (const entry of resp.entries) {
      if (entry.path.replace(/[\/]+/g,"/") == selectedCutPath) entry.cutimage = "_cutimage"; 
      entry.stats.name = entry.name; entry.stats.json = JSON.stringify(entry.stats);
   }
   
   // if a file or folder has been selected, show the paste button
   const folder_ops = [];
   if (selectedCopyPath || selectedCutPath) folder_ops.unshift({name: await i18n.get("Paste"), path, stats:{paste: true}});

   folder_ops.unshift({name: await i18n.get("Create"), path, stats:{create: true}});
   folder_ops.unshift({name: await i18n.get("Upload"), path, stats:{upload: true}});

   if (!path.match(/^[\/]+$/g)) { // add in back and home buttons
      let parentPath = path.substring(0, path.lastIndexOf("/")); if (parentPath == "") parentPath = "/";
      folder_ops.unshift({name: await i18n.get("Back"), path:parentPath, stats:{back: true}});
      folder_ops.unshift({name: await i18n.get("Home"), path:"/", stats:{home: true}});
   }

   const pathcrumbs = [{action:`monkshu_env.components['file-manager'].changeToPath('${host.id}','/')`, name: await i18n.get("Home")}];
   const pathSplits = path.split("/"); for (const [i, pathElement] of pathSplits.entries()) if (pathElement.trim()) pathcrumbs.push(
      {action: `monkshu_env.components['file-manager'].changeToPath('${host.id}','${pathSplits.slice(0, i+1).join("/")}')`, name: pathElement});

   const data = {operations: folder_ops, entries: resp.entries, 
      COMPONENT_PATH: `${APP_CONSTANTS.COMPONENTS_PATH}/file-manager`, pathcrumbs: JSON.stringify(pathcrumbs)};

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

   if (showNotification) _updateProgress(container, null, null, null, null, null, null, true);  // rerender progress

   if (element.getAttribute("quotabarids")) _updateQuotaBars(element.getAttribute("quotabarids").split(","));
}

function handleClick(element, path, isDirectory, fromClickEvent, nomenu) {
   selectedPath = path?path.replace(/[\/]+/g,"/"):selectedPath; 
   selectedIsDirectory = (isDirectory!== undefined) ? util.parseBoolean(isDirectory) : selectedIsDirectory;
   selectedElement = element; const event = JSON.parse(element.dataset.stats||"{}");  // used below in eval
   const hostElement = file_manager.getHostElement(element); if (hostElement.getAttribute("onselect")) eval(hostElement.getAttribute("onselect"));

   if (nomenu) return;
   
   if (timer) {clearTimeout(timer); if (fromClickEvent) editFile(element); timer=null;}
   else timer = setTimeout(_=> { timer=null; _fileListingEntrySelected(element, event);
      if ((fromClickEvent && isMobile())||!fromClickEvent) {if (!menuOpen) showMenu(element); else hideMenu(element); return;}
      if (fromClickEvent && menuOpen) hideMenu(element); // menu is open and user clicked anywhere, close it
   }, DOUBLE_CLICK_DELAY);
}

function _fileListingEntrySelected(containedElement, stats) {
   const informationbox = file_manager.getShadowRootByContainedElement(containedElement).querySelector("div#informationbox");
   if (stats.size) stats.sizeLocale = parseInt(stats.size).toLocaleString(); 
   if (stats.birthtime) stats.birthTimestampLocale = new Date(stats.birthtime).toLocaleString(); 
   if (stats.mtime) stats.modifiedTimestampLocale = new Date(stats.mtime).toLocaleString(); 
   const arrayForBreadcrumbs = selectedPath.trim().replace(/^\/+/, "").split("/").slice(0, -1); arrayForBreadcrumbs.unshift("Home");
   stats.path = selectedPath; stats.pathBreadcrumbs = arrayForBreadcrumbs.join(" > "); if (!stats.name) stats.name = containedElement.innerText;
   _renderTemplateOnElement("informationboxDivContents", stats, informationbox);
}

async function updateFileEntryCommentIfModified(path, oldComment, newComment) {
   const _getStringTrimmedValueOrNull = s => s ? s.trim() : null;

   if (_getStringTrimmedValueOrNull(oldComment) != _getStringTrimmedValueOrNull(newComment)) {
      selectedElement.dataset.stats = JSON.stringify({...JSON.parse(selectedElement.dataset.stats), comment: newComment});
      await apiman.rest(API_OPERATEFILE, "POST", {path, op: "updatecomment", comment: JSON.parse(selectedElement.dataset.stats).comment}, true);
   }
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
   if (resp?.result) {dialog().hideDialog("dialog"); file_manager.reload(hostID);} else dialog().error("dialog", await i18n.get("Error"));
}

const uploadFiles = async (element, files) => {
   let uploadSize = 0; for (const file of files) uploadSize += file.size; if (!(await _checkQuotaAndReportError(uploadSize))) return;
   for (const file of files) {
      const normalizedName = _notificationFriendlyName(`${currentlyActiveFolder}/${file.name}`); 
      if (Object.keys(filesAndPercents).includes(normalizedName) && (filesAndPercents[normalizedName].percent != 100) && 
         (!_isFileCancelledOrErrored(normalizedName))) { LOG.info(`Skipped ${file.name}, already being uploaded.`); continue; }  // already being uploaded
      
      const checkFileExists = await apiman.rest(API_CHECKFILEEXISTS, "GET", {path: normalizedName}, true); 
      if (checkFileExists.result) {
         const cancelRenameRewrite = await dialog().showDialog(`${DIALOGS_PATH}/cancel_rename_overwrite.html`, true, false, 
            {fileexistswarning: await i18n.getRendered("FileExistsWarning", {name: file.name})}, "dialog", ["result"]);
         switch (cancelRenameRewrite.result) {
            case "cancel": {LOG.info(`User selected to skip existing file ${file.name}, skipping.`); continue;}
            case "rename": file.renameto = checkFileExists.suggestedNewName; break;
            case "overwrite": {
               const deleteResult = await apiman.rest(API_DELETEFILE, "GET", {path: normalizedName}, true);
               if (!deleteResult.result) {dialog().showMessage(`${await i18n.get("OverwriteFailed")}${file.name}`, "dialog"); continue;}
               else break;
            }
            default: {LOG.info(`Invalid choice so skipping existing file ${file.name}, skipping.`); continue;}
         }
      }

      _uploadAFile(element, file).catch(error => LOG.info(`Upload failed for the file ${file.name} due to error ${error}.`));
   }
}

async function _uploadAFile(element, file) {
   const totalChunks = file.size != 0 ? Math.ceil(file.size / IO_CHUNK_SIZE) : 1, lastChunkSize = file.size - (totalChunks-1)*IO_CHUNK_SIZE;
   const _getSavePath = (path, file) => `${path}/${file.renameto || file.name}`;
   delete filesAndPercents[_notificationFriendlyName(_getSavePath(currentlyActiveFolder, file))];  // being reuploaded
   const waitingReadersForThisFile = [];  

   const queueReadFileChunk = (savePath, fileToRead, chunkNumber, resolve, reject) => {
      const _rejectReadPromises = error => {
         LOG.error(`Error reading ${fileToRead.name}, error is: ${error}, aborting all readers for this file.`); 
         while (waitingReadersForThisFile.length) (waitingReadersForThisFile.pop())(error);   // reject all waiting readers too
         reject(error);
      }

      const reader = new FileReader(), filePath = _getSavePath(savePath, fileToRead); 
      reader.onload = async loadResult => {
         const dataToPost = file.size != 0 ? loadResult.target.result : new ArrayBuffer(0);  // handle 0 byte files
         LOG.info(`Read chunk number ${chunkNumber} from local file ${fileToRead.name}, size is: ${dataToPost.byteLength} bytes. Sending to the server.`); 
         const resp = await _uploadChunkAtOptimumSpeed(dataToPost, filePath, chunkNumber, chunkNumber == totalChunks-1, file.size, element);   
         if (!resp.result) {
            LOG.info(`Failed to write chunk number ${chunkNumber} from local file ${fileToRead.name}, to the server at path ${filePath}.`); 
            if (!filesAndPercents[_notificationFriendlyName(filePath)]) filesAndPercents[_notificationFriendlyName(filePath)] = {}; 
            _updateProgress(element, chunkNumber, totalChunks, filePath, UPLOAD_ICON, true);
            apiman.rest(API_DELETEFILE, "GET", {path: filePath}, true); // delete remotely as it errored out
            _rejectReadPromises("Error writing to the server."); 
         } else {
            LOG.info(`Written chunk number ${chunkNumber} from local file ${fileToRead.name}, to the server at path ${filePath}.`); 
            if (!filesAndPercents[filePath]?.cancelled && (waitingReadersForThisFile.length)) (waitingReadersForThisFile.pop())();  // issue next chunk read if queued reads
            else if (filesAndPercents[filePath]?.cancelled) await apiman.rest(API_DELETEFILE, "GET", {path: filePath}, true); // has been cancelled, so delete remotely and also stop reading and transferring any more chunks
            resolve();
         }
      }
      reader.onerror = _ => _rejectReadPromises(reader.error);

      // queue reads if we are waiting for a chunk to be returned, so the writes are in correct order 
      const sizeToRead = chunkNumber == totalChunks-1 ? lastChunkSize : IO_CHUNK_SIZE;
      waitingReadersForThisFile.unshift(abortRead=>{
         if (!abortRead) {
            LOG.info(`Requesting read of file ${fileToRead.name}, chunk number ${chunkNumber}, size ${sizeToRead} bytes.`);
            reader.readAsArrayBuffer(fileToRead.slice(IO_CHUNK_SIZE*chunkNumber, IO_CHUNK_SIZE*chunkNumber+sizeToRead));
         } else reject(abortRead);
      });
   }

   let readPromises = []; 
   for (let i = 0; i < totalChunks; i++) readPromises.push(new Promise((resolve, reject) => queueReadFileChunk(currentlyActiveFolder, file, i, resolve, reject)));
   const startReaders = _ => {_updateProgress(element, 0, totalChunks, _getSavePath(currentlyActiveFolder, file), UPLOAD_ICON); (waitingReadersForThisFile.pop())();}
   startReaders();   // kicks off the first read in the queue, which then fires others 
   return Promise.all(readPromises);
}

async function _uploadChunkAtOptimumSpeed(data, remotePath, chunkNumber, isLastChunk, totalSize, element) {  // adjusts upload buffers dynamically based on network speed
   if (!currentWriteBufferSize) currentWriteBufferSize = INITIAL_UPLOAD_BUFFER_SIZE;

   const _bufferToBase64URL = buffer => "data:;base64,"+btoa(new Uint8Array(buffer).reduce((acc, i) => acc += String.fromCharCode.apply(null, [i]), ''));

   let bytesWritten = 0, lastResp, subchunknumber = 0; while (bytesWritten < data.byteLength) {
      const bytesToSend = bytesWritten + currentWriteBufferSize > data.byteLength ? data.byteLength - bytesWritten : currentWriteBufferSize;
      const dataToSend = data.slice(bytesWritten, bytesWritten+bytesToSend), isLastSubChunk = isLastChunk && 
         (bytesWritten+bytesToSend == data.byteLength), isFirstSubChunk = chunkNumber == 0 && bytesWritten == 0;
      const startTime = Date.now();
      LOG.info(`Starting upload of subchunk with length ${bytesToSend} of chunk ${chunkNumber}`);
      lastResp = await apiman.rest(API_UPLOADFILE, "POST", {data: _bufferToBase64URL(dataToSend), path: remotePath, user, 
         startOfFile: isFirstSubChunk, endOfFile: isLastSubChunk}, true);
      if (!lastResp.result) {
         LOG.error(`Upload of subchunk failed, sending back error, the response is ${JSON.stringify(lastResp)}.`);
         return lastResp;   // failed
      }
      const timeTakenToPost = Date.now() - startTime;
      bytesWritten += bytesToSend;
      LOG.info(`Ended upload of subchunk #${subchunknumber} with length ${bytesToSend} of chunk ${chunkNumber}, time taken = ${timeTakenToPost/1000} seconds.`);
      const netSpeedBytesPerSecond = bytesToSend / (timeTakenToPost/1000);
      currentWriteBufferSize = Math.min(MAX_UPLOAD_BUFFER_SIZE, Math.round(netSpeedBytesPerSecond * MAX_UPLOAD_WAIT_TIME_SECONDS));  // max wait should not execeed this
      LOG.info(`Current upload speed in Mbps is ${netSpeedBytesPerSecond/(1024*1024)}, adjusted upload buffer size in MB is ${currentWriteBufferSize/(1024*1024)} or ${currentWriteBufferSize} bytes.`);
      _updateProgress(element, (chunkNumber*IO_CHUNK_SIZE)+bytesWritten, totalSize, remotePath, UPLOAD_ICON);
   }
   return lastResp;
}

function showMenu(element, documentMenuOnly) {
   let shadowRoot; try {shadowRoot = file_manager.getShadowRootByContainedElement(element);} catch(err) {return;} // element clicked not part of the component

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
      shadowRoot.querySelector("div#contextmenu > span#getinfo").classList.add("hidden");
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
      shadowRoot.querySelector("div#contextmenu > span#getinfo").classList.add("hidden");
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
      shadowRoot.querySelector("div#contextmenu > span#getinfo").classList.remove("hidden");
   }

   const contextMenu = shadowRoot.querySelector("div#contextmenu");
   contextMenu.style.top = mouseY+"px"; contextMenu.style.left = mouseX+"px"; contextMenu.style.maxWidth = `calc(100vw - ${mouseX}px - 5px)`;
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

function showHideNotifications(hostID) {
   const shadowRoot = file_manager.getShadowRootByHostId(hostID), divFilemanager = shadowRoot.querySelector("div#filemanager"),
      notificationsShowing = shadowRoot.querySelector(`#${DIALOG_HOST_ELEMENT_ID}`).classList.contains("visible");
   if (!notificationsShowing) _updateProgress(divFilemanager, null, null, null, null, null, null, true);
   else hideNotification(divFilemanager);
}

async function deleteFile(element) {
   let resp = await apiman.rest(API_DELETEFILE, "GET", {path: selectedPath}, true);
   if (resp.result) file_manager.reload(file_manager.getHostElementID(element)); else _showErrorDialog();
}

function editFile(element) {
   if (selectedIsDirectory) {changeToPath(file_manager.getHostElement(element).id, selectedPath); return;}

   if (selectedElement.id == "upload") {upload(selectedElement); return;}

   if (selectedElement.id == "create") {create(selectedElement); return;}

   if (selectedElement.id == "paste") {paste(selectedElement); return;}

   editFileLoadData();  // now it can only be a file 
}

async function editFileLoadData() {
   const resp = await apiman.rest(API_OPERATEFILE, "POST", {path: selectedPath, op: "read"}, true);
   if (resp?.result) dialog().showDialog(`${DIALOGS_PATH}/editfile.html`, true, true, {fileContents: resp.data}, 
         "dialog", ["filecontents"], async result => {

      const resp = await apiman.rest(API_OPERATEFILE, "POST", {path: selectedPath, op: "write", data: result.filecontents}, true);
      dialog().hideDialog("dialog"); if (!resp.result) _showErrorDialog();
   }); else _showErrorDialog();
}

function editFileVisible() {
   const shadowRootDialog = dialog().getShadowRootByHostId("dialog");
   const elementTextArea = shadowRootDialog.querySelector("textarea#filecontents"); elementTextArea.focus();
}

function changeToPath(hostid, path) {
   const host = file_manager.getHostElementByID(hostid); host.setAttribute("path", path); 
   (file_manager.getSessionMemory(hostid))["__lastPath"] = path; file_manager.reload(host.id); return;
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

function copy(element) { selectedCopyPath = selectedPath; selectedCutCopyElement = selectedElement.cloneNode(); 
   file_manager.reload(file_manager.getHostElementID(element)); }

async function paste(element) {
   const _copyRequestedToItsOwnSubdirectory = (from, to) => {const pathSplits = to.split("/");
      for (const [i, _val] of pathSplits.entries()) if (pathSplits.slice(0, i).join("/")==from) return true; return false;}
   const _nullOutSelectedCutCopyPathsAndElements = (reload=true) => { selectedCutPath = null; selectedCopyPath = null; 
      selectedCutCopyElement = null; if (reload) file_manager.reload(file_manager.getHostElementID(element)); }

   const selectedPathToOperate = selectedCutPath?selectedCutPath:selectedCopyPath;
   const baseName = selectedPathToOperate.substring(selectedPathToOperate.lastIndexOf("/")+1);
   const from = _normalizedPath(selectedCutPath||selectedCopyPath); let to = _normalizedPath(`${currentlyActiveFolder}/${baseName}`);
   const _showErrorAndReset = async (errorKey="ErrorSameFiles") => {_showErrorDialog(null, await i18n.get(errorKey)); _nullOutSelectedCutCopyPathsAndElements();}
   const checkFileExists = await apiman.rest(API_CHECKFILEEXISTS, "GET", {path: to}, true); 

   
   if (checkFileExists.result) {
      const cancelRenameRewrite = await dialog().showDialog(`${DIALOGS_PATH}/cancel_rename_overwrite.html`, true, 
         false, {fileexistswarning: await i18n.getRendered("FileExistsWarning", {name: to})}, "dialog", ["result"]);
      switch (cancelRenameRewrite.result) {
         case "cancel": {LOG.info(`User selected to skip existing file ${to}, skipping.`); _nullOutSelectedCutCopyPathsAndElements(true); return;}
         case "rename": to = checkFileExists.suggestedRemotePath; break;
         case "overwrite": if (from==to) {_nullOutSelectedCutCopyPathsAndElements(true); return;} else break; // same files for copy/move, ignoring is equivalent to overwrite
         default: {_showErrorAndReset(); return;} 
      }
   } 
   if (_copyRequestedToItsOwnSubdirectory(from, to)) {_showErrorAndReset("ErrorCopyDirToItself"); return;}
   if (selectedCutPath) await _performRename(from, to, element);
   else if (selectedCopyPath) await _performCopy(from, to, element);
   _nullOutSelectedCutCopyPathsAndElements(false);
}

function _showDownloadProgress(element, path, reqid) {
   let interval, done = false;

   const updateProgress = async _ => {
      if (done) return;
      
      const markDoneAndClearInterval = _ => {done=true; clearInterval(interval);};

      const fileDownloadStatus = await apiman.rest(`${API_DOWNLOADFILE_STATUS}`, "GET", {reqid}, true, false);
      if (fileDownloadStatus && fileDownloadStatus.result) {
         if (fileDownloadStatus.downloadStarted) _updateProgress(element, fileDownloadStatus.bytesSent, fileDownloadStatus.size, path, DOWNLOAD_ICON);
         if ((fileDownloadStatus.finishedSuccessfully) || (fileDownloadStatus.size == fileDownloadStatus.bytesSent)) markDoneAndClearInterval();
      }
      else if (!done) {
         markDoneAndClearInterval();
         dialog().showMessage(await i18n.get("DownloadFailed"), "dialog"); 
      }
   }

   interval = setInterval(updateProgress, DOWNLOADFILE_REFRESH_INTERVAL);
}

const _normalizedPath = path => path.replace(/\\/g, "/").trim().replace(/\/+/g,"/").trim();

const _notificationFriendlyName = path => path.replace(/\/+/g, "/").trim().replace(/^\//g,"");

const _isFileCancelledOrErrored = path => filesAndPercents[_notificationFriendlyName(path)]?.cancelled || 
   filesAndPercents[_notificationFriendlyName(path)]?.lastoperror;

async function _updateProgress(element, currentBlock, totalBlocks, fileName, icon, hasError, wasCancelled, justRerender) {
   if (!justRerender) {
      if (_isFileCancelledOrErrored(fileName)) return; // already cancelled or error
      const normalizedName = _notificationFriendlyName(fileName);
      const percent = (hasError || wasCancelled) ? 0 : Math.floor(currentBlock/totalBlocks*100);
      filesAndPercents[normalizedName] = {name: normalizedName, percent, icon, 
         cancellable: (icon==UPLOAD_ICON) && (percent != 100) && (!hasError) && (!wasCancelled)?true:null,
         cancelled: wasCancelled?true:null, 
         lastoperror: hasError?true:null}; 
   }
   
   const templateData = {files:[]}; for (const file of Object.keys(filesAndPercents)) templateData.files.unshift({...filesAndPercents[file]});
   await _showNotification(element, PROGRESS_TEMPLATE, templateData);

   if (!justRerender) _reloadIfAllFilesUpOrDownloaded(element, filesAndPercents);
}

function _reloadIfAllFilesUpOrDownloaded(element, filesAndPercents) {
   for (const file of Object.keys(filesAndPercents)) if (filesAndPercents[file].percent != 100 && 
      (!_isFileCancelledOrErrored(file))) return;
   file_manager.reload(file_manager.getHostElementID(element)); 
}

function renameFile(element) {
   const oldName = selectedPath?selectedPath.substring(selectedPath.lastIndexOf("/")+1):null;
   dialog().showDialog(`${DIALOGS_PATH}/renamefile.html`, true, true, {oldName}, "dialog", ["renamepath"], async result => {
      const subpaths = selectedPath.split("/"); subpaths.splice(subpaths.length-1, 1, result.renamepath);
      const newPath = subpaths.join("/");
      dialog().hideDialog("dialog"); 
      if (_normalizedPath(selectedPath) == _normalizedPath(newPath)) {_showErrorDialog(null, await i18n.get("ErrorSameFiles")); return;}
      _performRename(selectedPath, newPath, element); 
   });
}

async function shareFile() {
   const paths = selectedPath.split("/"), name = paths[paths.length-1];
   const resp = await apiman.rest(API_SHAREFILE, "GET", {path: selectedPath, expiry: shareDuration}, true);
   if (!resp || !resp.result) _showErrorDialog(); else dialog().showDialog( `${DIALOGS_PATH}/sharefile.html`, true, true, 
      {link: router.encodeURL(`${PAGE_DOWNLOADFILE_SHARED}?id=${resp.id}&name=${name}`), id: resp.id, shareDuration, dialogpath: DIALOGS_PATH}, 
      "dialog", ["expiry"], async result => {
            dialog().hideDialog("dialog");
            if (result.expiry != shareDuration) apiman.rest(API_SHAREFILE, "GET", {id: resp.id, expiry: result.expiry}, true); 
      }, async _ => apiman.rest(API_SHAREFILE, "GET", {id: resp.id, expiry: 0}, true));
}

async function getInfoOnFile(containedElement) {
   const shadowRoot = file_manager.getShadowRootByContainedElement(containedElement);
   shadowRoot.querySelector("div#informationbox").classList.add("visible");
}

const _showErrorDialog = async (hideAction, message) => dialog().showMessage(message||await i18n.get("Error"), "dialog", hideAction||undefined);

async function _showNotification(element, dialogTemplateID, templateData) {
   showNotification = true;
   const shadowRoot = file_manager.getShadowRootByContainedElement(element);
   const hostElement = shadowRoot.querySelector(`#${DIALOG_HOST_ELEMENT_ID}`), scrollElement = shadowRoot.querySelector(`#${DIALOG_SCROLL_ELEMENT_ID}`);
   _renderTemplateOnElement(dialogTemplateID, templateData, hostElement);
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

async function _renderTemplateOnElement(templateID, data, element) {
   let template = file_manager.getShadowRootByContainedElement(element).querySelector(`template#${templateID}`).innerHTML; 
   const matches = /<!--([\s\S]+)-->/g.exec(template);
   if (!matches) return false; template = matches[1]; // can't show progress if the template is bad

   const rendered = await router.expandPageData(template, router.getLastSessionURL(), data);
   element.innerHTML = rendered; 
   return true;
}

const cancelFile = (file, element) => _updateProgress(element, 0, 0, file, UPLOAD_ICON, false, true);  // cancels and updates the view

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
   cancelFile, editFileVisible, showHideNotifications, getInfoOnFile, updateFileEntryCommentIfModified, changeToPath }
monkshu_component.register("file-manager", `${COMPONENT_PATH}/file-manager.html`, file_manager);
/** 
 * Check if given file exists, optionally returns a suggest name for 
 * the file if a new one by the same name need to be created. Also returns
 * stats for the file.
 * (C) 2020 TekMonks. All rights reserved.
 */
const path = require("path");
const fspromises = require("fs").promises;
const cms = require(`${API_CONSTANTS.LIB_DIR}/cms.js`);
const uploadfile = require(`${API_CONSTANTS.API_DIR}/uploadfile.js`);

exports.doService = async (jsonReq, _, headers) => {
    if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
    
    LOG.debug("Got checkfile request for path: " + jsonReq.path);

    const fullpath = path.resolve(`${await cms.getCMSRoot(headers)}/${jsonReq.path}`);
    if (!await cms.isSecure(headers, fullpath)) {LOG.error(`Path security validation failure: ${jsonReq.path}`); return CONSTANTS.FALSE_RESULT;}

    try {
        if (!(await uploadfile.isFileConsistentOnDisk(fullpath))) return CONSTANTS.FALSE_RESULT;
        const stats = await uploadfile.getFileStats(fullpath); return {result: true, ...stats, 
            suggestedNewName: path.basename(await _getIncrementedFileName(fullpath))};
    } catch (err) {return CONSTANTS.FALSE_RESULT;}
}

async function _getIncrementedFileName(fullpath) {
    const fullpathNoExtension = fullpath.substring(0, fullpath.length - path.extname(fullpath).length), ext = path.extname(fullpath);
    let intValue = 2, found = false; while ((!found) && (intValue < Number.MAX_SAFE_INTEGER)) {
        try {await fspromises.access(`${fullpathNoExtension}_${intValue}${ext}`); intValue++; found = false;} catch (err) {found = true; break;} };
    return `${fullpathNoExtension}_${intValue}${ext}`;
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path);

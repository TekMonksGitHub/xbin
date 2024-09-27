/** 
 * (C) 2015 TekMonks. All rights reserved.
 * License: See the enclosed LICENSE file.
 */

const path = require("path");

APP_ROOT = `${path.resolve(`${__dirname}/../`)}`;

exports.APP_ROOT = APP_ROOT;
exports.API_DIR = `${APP_ROOT}/apis`;
exports.CONF_DIR = `${APP_ROOT}/conf`;
exports.LIB_DIR = `${APP_ROOT}/lib`;
exports.DB_DIR = `${APP_ROOT}/db`;
exports.XBIN_TEMP_FILE_SUFFIX = "._____________xbin__________temp_file";
exports.MEM_KEY_UPLOADFILE = "__org_monkshu_xbin_uploadfile_memory";
exports.STATS_EXTENSION = "._____________xbin__________ignore_stats";
exports.XBIN_FILE = "file";
exports.XBIN_FOLDER = "directory";
exports.XBIN_IGNORE_PATH_SUFFIXES = [exports.XBIN_TEMP_FILE_SUFFIX, exports.STATS_EXTENSION];
exports.MEM_KEY_WRITE_STATUS = "__org_xbin_file_writer_req_statuses";

exports.ROLES = Object.freeze({ADMIN: "admin", USER: "user", GUEST: "guest"});

exports.XBINEVENT = "__org_monkshu_xbin_event";
exports.EVENTS = Object.freeze({FILE_CREATED: "file_created", FILE_DELETED: "file_deleted", 
    FILE_MODIFIED: "file_modified", FILE_RENAMED: "file_renamed"});

exports.isSubdirectory = (child, parent) => { // from: https://stackoverflow.com/questions/37521893/determine-if-a-path-is-subdirectory-of-another-in-node-js
    child = path.resolve(child); parent = path.resolve(parent);

    if (parent.toLowerCase() == child.toLowerCase()) return true;	// a directory is its own subdirectory (remember ./)

    const relative = path.relative(parent, child);
    const isSubdir = !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    if (isSubdir) return true;
    else return false;
}
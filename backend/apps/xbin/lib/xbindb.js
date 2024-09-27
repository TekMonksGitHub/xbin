/**
 * DB class for XBin only.
 * (C) 2020 TekMonks. All rights reserved.
 */

const path = require("path");
const DB_PATH = path.resolve(`${XBIN_CONSTANTS.DB_DIR}/xbin.db`);
const DB_CREATION_SQLS = require(`${XBIN_CONSTANTS.DB_DIR}/xbin_dbschema.json`);
const db = require(`${CONSTANTS.LIBDIR}/db.js`).getDBDriver("sqlite", DB_PATH, DB_CREATION_SQLS);

exports.getDB = _ => db;
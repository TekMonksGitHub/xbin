/**
 * DB class for XBin only.
 * (C) 2020 TekMonks. All rights reserved.
 */

const path = require("path");
const DB_PATH = path.resolve(`${APP_CONSTANTS.DB_DIR}/app.db`);
const DB_CREATION_SQLS = require(`${APP_CONSTANTS.DB_DIR}/dbschema.json`);
const db = require(`${CONSTANTS.LIBDIR}/db.js`).getDBDriver("sqlite", DB_PATH, DB_CREATION_SQLS);

exports.getDB = _ => db;
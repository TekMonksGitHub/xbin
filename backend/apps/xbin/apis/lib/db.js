/** 
 * db.js - DB layer. Auto creates the DB with the DDL if needed.
 * 
 * (C) 2020 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */
 const fs = require("fs");
 const util = require("util");
 const sqlite3 = require("sqlite3");
 const mkdirAsync = util.promisify(fs.mkdir);
 const accessAsync = util.promisify(fs.access);
 const DB_CREATION_SQLS = require(`${APP_CONSTANTS.DB_DIR}/loginappdbschema.json`);
 const DB_PATH = require("path").resolve(`${APP_CONSTANTS.DB_DIR}/app.db`);
 
 let dbInstance, dbRunAsync, dbAllAsync;
 
 /**
  * Runs the given SQL command e.g. insert, delete etc.
  * @param {string} cmd The command to run
  * @param {array} params The params for SQL
  * @return true on success, and false on error
  */
 exports.runCmd = async (cmd, params=[]) => {
     await _initDB(); params = Array.isArray(params)?params:[params];
     try {await dbRunAsync(cmd, params); return true}
     catch (err) {LOG.error(`DB error running, ${cmd}, with params ${params}, error: ${err}`); return false;}
 }
 
 /**
  * Runs the given query e.g. select and returns the rows from the result.
  * @param {string} cmd The command to run
  * @param {array} params The params for SQL
  * @return rows array on success, and false on error 
  */
 exports.getQuery = async(cmd, params=[]) => {
     await _initDB(); params = Array.isArray(params)?params:[params];
     try {return await dbAllAsync(cmd, params);}
     catch (err) {LOG.error(`DB error running, ${cmd}, with params ${params}, error: ${err}`); return false;}
 }
 
 async function _initDB() {
     if (!await _createDB()) return false;
     if (!await _openDB()) return false; else return true;
 }
 
 async function _createDB() {
     try {
         await accessAsync(DB_PATH, fs.constants.F_OK | fs.constants.W_OK); 
         return true;
     } catch (err) {  // db doesn't exist
         LOG.error("DB doesn't exist, creating and initializing");
         try{await mkdirAsync(APP_CONSTANTS.DB_DIR)} catch(err){if (err.code != "EEXIST") {LOG.error(`Error creating DB dir, ${err}`); return false;}}   
         if (!await _openDB()) return false; // creates the DB file
         
         for (const dbCreationSQL of DB_CREATION_SQLS) try{await dbRunAsync(dbCreationSQL, [])} catch(err) {
             LOG.error(`DB creation DDL failed on: ${dbCreationSQL}, due to ${err}`); 
             return false;
         }
         LOG.info("DB created successfully."); return true;
     }
 }
 
 function _openDB() {
     return new Promise(resolve => {
         if (!dbInstance) dbInstance = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE|sqlite3.OPEN_CREATE, err => {
             if (err) {LOG.error(`Error opening DB, ${err}`); dbInstance = null; resolve(false);} 
             else {
                 dbRunAsync = util.promisify(dbInstance.run.bind(dbInstance)); 
                 dbAllAsync = util.promisify(dbInstance.all.bind(dbInstance)); 
                 resolve(true);
             }
         }); else resolve(true);
     });
 }
/* 
 * (C) 2015 TekMonks. All rights reserved.
 * See enclosed LICENSE file.
 */

const path = require("path");

APP_ROOT = `${path.resolve(`${__dirname}/../../`)}`;

exports.APP_ROOT = APP_ROOT;
exports.CONF_DIR = `${APP_ROOT}/conf`;
exports.LIB_DIR = path.resolve(__dirname);
exports.API_DIR = path.resolve(`${__dirname}/../`);
exports.DB_DIR = `${APP_ROOT}/db`;
exports.ROLES = {ADMIN: "admin", USER: "user"};
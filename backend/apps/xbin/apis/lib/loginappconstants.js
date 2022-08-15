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

exports.ROOMSKEY = "__com_tekmonks_telemeet_rooms";
exports.IP_FW_MAPPINGS_KEY = "__com_tekmonks_telemeet_fw_ip_mappings";
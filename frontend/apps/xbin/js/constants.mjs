/* 
 * (C) 2015 TekMonks. All rights reserved.
 * License: See the enclosed LICENSE file.
 */
const FRONTEND = "https://{{{hostname}}}";
const BACKEND = "https://{{{hostname}}}:9090";
const APP_NAME = "xbin";
const APP_PATH = `${FRONTEND}/apps/${APP_NAME}`;
const API_PATH = `${BACKEND}/apps/${APP_NAME}`;
const COMPONENTS_PATH = `${FRONTEND}/apps/${APP_NAME}/components`;
const ALL_USER_ACCESS_PAGES = [`^${FRONTEND}$`, APP_PATH+"/download.html", APP_PATH+"/error.html", 
    APP_PATH+"/login.html", APP_PATH+"/loginresult.html", $$.MONKSHU_CONSTANTS.ERROR_HTML];

export const APP_CONSTANTS = {
    ENV: {},
    
    FRONTEND, BACKEND, APP_PATH, APP_NAME, COMPONENTS_PATH, API_PATH,
    MAIN_HTML: APP_PATH+"/main.html",
    LOGIN_HTML: APP_PATH+"/login.html",
    LOGINRESULT_HTML: APP_PATH+"/loginresult.html",
    INDEX_HTML: APP_PATH+"/index.html",
    ERROR_HTML: APP_PATH+"/error.html",
    DOWNLOAD_HTML: APP_PATH+"/download.html",

    CONF_PATH: APP_PATH+"/conf",

    SESSION_NOTE_ID: "com_monkshu_ts",

    APP_ABOUT_URL: "https://tekmonks.com/apps/tekmonks/index.html?.=aHR0cHM6Ly90ZWttb25rcy5jb20vYXBwcy90ZWttb25rcy9sYW5kaW5nLmh0bWw/cHJvZHVjdF9wYXRoPS4vcHJvZHVjdHMveGJpbi5tZCZtZW51X3BhdGg9Lm1lbnVzL2Vu",

    // Login constants
    TKMLOGIN_LIB: `${APP_PATH}/3p/tkmlogin.mjs`,
    USERID: "userid",
    PWPH: "pwph",
    TIMEOUT: 600000,
    USERNAME: "username",
    USERORG: "userorg",

    USER_ROLE: "user",
    GUEST_ROLE: "guest",
    ADMIN_ROLE: "admin",
    PERMISSIONS_MAP: {user: [...ALL_USER_ACCESS_PAGES, APP_PATH+"/main.html"], guest: [...ALL_USER_ACCESS_PAGES] },
    API_KEYS: {"*":"fheiwu98237hjief8923ydewjidw834284hwqdnejwr79389"},
    KEY_HEADER: "X-API-Key"
}
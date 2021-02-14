/* 
 * (C) 2015 TekMonks. All rights reserved.
 * License: MIT - see enclosed license.txt file.
 */
const FRONTEND = "http://localhost:8080";
const BACKEND = "http://localhost:9090";
const APP_NAME = "xbin";
const APP_PATH = `${FRONTEND}/apps/${APP_NAME}`;
const API_PATH = `${BACKEND}/apps/${APP_NAME}`;
const COMPONENTS_PATH = `${FRONTEND}/apps/${APP_NAME}/components`;

export const APP_CONSTANTS = {
    FRONTEND, BACKEND, APP_PATH, APP_NAME, COMPONENTS_PATH, API_PATH,
    MAIN_HTML: APP_PATH+"/main.html?path=/",
    LOGIN_HTML: APP_PATH+"/login.html",

    SESSION_NOTE_ID: "com_monkshu_ts",

    // Login constants
    MIN_PASS_LENGTH: 8,
    API_LOGIN: API_PATH+"/login",
    BCRYPT_SALT: "$2a$10$VFyiln/PpFyZc.ABoi4ppf",
    USERID: "id",
    USER_ROLE: "user",
    GUEST_ROLE: "guest",
    PERMISSIONS_MAP: {
        user:[APP_PATH+"/main.html", APP_PATH+"/login.html", $$.MONKSHU_CONSTANTS.ERROR_THTML], 
        guest:[APP_PATH+"/login.html", $$.MONKSHU_CONSTANTS.ERROR_THTML]
    },
    API_KEYS: {"*":"fheiwu98237hjief8923ydewjidw834284hwqdnejwr79389"},
    KEY_HEADER: "X-API-Key"
}
/**
 * Tekmonks Unified Login support file. 
 * (C) 2023 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */

const UNIFIED_LOGIN_BASE_URL = "https://login.tekmonks.com";

/**
 * Logs a user in
 * @param {string} appname The application name
 * @param {string} redirect The URL to redirect to, post login result (can be on success or failure, the URL must check that)
 * @param {string} otkapi The URL for the backend API to generate an OTK 
 * @param {string} bgcolor Optional: The background color for the login page
 * @param {string} unifiedloginbaseurl Optional: The URL to the Tekmonks Unified Login app
 * @returns Redirects to login app.
 */
async function login(appname, redirect, otkapi, bgcolor, unifiedloginbaseurl=UNIFIED_LOGIN_BASE_URL) {
    // get the OTK key from the backend as it is needed for verification later
    let callotkapi; try {callotkapi = await fetch(otkapi);} catch (err) {
        console.error(`OTK API failed for Tekmonks Unified Login, error was ${err}.`); return;}
    if (!callotkapi?.ok) {console.error(`OTK API failed for Tekmonks Unified Login. The status was ${callotkapi?.status}.`); return;}
    const onetimekey = (await callotkapi.json()).otk; if (!onetimekey) {
        console.error(`OTK API failed for Tekmonks Unified Login, error was undefined OTK.`); return; }

    // call tekmonks unified login
    const search = `an=${encodeURIComponent(appname)}&rdr=${encodeURIComponent(redirect)}&otk=${encodeURIComponent(onetimekey)}${bgcolor?`&bgc=${encodeURIComponent(bgcolor)}`:""}`;
    window.location.replace(`${unifiedloginbaseurl}?${search}`);
}

/**
 * Verifies a successful login via the Tekmonks Unified Login app.
 * @param {string} verifyapi The backend API which can verify the JWT token from Tekmonks Unified Login app
 * @param {string} resulturl The URL with the result - optional, if not provided then window.location is used
 * @returns The verification API's result as {url, response, headers} where response is the API response object and
 *          headers is the response's HTTP response headers and URL is the URL from which we got the response.
 * @throws {Error} On JWT missing error.
 */
async function verify(verifyapi, resulturl) {
    const jwt = new URL(resulturl||window.location).searchParams.get("jwt");
    if (!jwt) throw new Error("Missing JWT for verification.");

    const apiurl =  verifyapi + (new URL(verifyapi).search ? `&jwt=${jwt}` : `?jwt=${jwt})`);
    let verifiedResult; try {verifiedResult = await fetch(apiurl);} catch (err) {
        console.error(`JWT verification failed for Tekmonks Unified Login, error was ${err}.`); return false; }
    
    const _getHeaders = httpHeaders => {const headers = {}; for (const [key, value] of httpHeaders.entries()) 
        headers[key] = value; return headers;}
    if (verifiedResult.ok) try {return {url: verifyapi, response: await verifiedResult.json(), headers: _getHeaders(verifiedResult.headers)}} 
        catch (err) {console.error(`JWT verification failed for Tekmonks Unified Login, error was ${err}.`); return false; } 
    else return false;
}

export const tkmlogin = {login, verify};
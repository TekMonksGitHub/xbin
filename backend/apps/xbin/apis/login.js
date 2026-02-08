/**
 * Needs Tekmonks Unified Login to work.
 * 
 * Operations are
 *  op - getotk - Returns one time key which can be passed to Unified login 
 *  op - verify - Verifies the incoming JWT. This needs the following params
 *      op: "verify", jwt: "the JWT token from unified login"
 * 
 * A replacement login module must implement
 *  isValidLogin, getID, getRole, getOrg, getJWT, getToken, isAPIKeySecure
 * 
 * (C) 2023 TekMonks. All rights reserved.
 */

const serverutils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const httpClient = require(`${CONSTANTS.LIBDIR}/httpClient.js`);

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
    
    if (jsonReq.op == "getotk") return _getOTK(jsonReq);
    else if (jsonReq.op == "verify") return await _verifyJWT(jsonReq);
    else return CONSTANTS.FALSE_RESULT;
}

exports.isValidLogin = headers => APIREGISTRY.getExtension("JWTTokenManager").checkToken(exports.getToken(headers));
exports.getID = headers => APIREGISTRY.getExtension("JWTTokenManager").getClaims(headers).id;
exports.getRole = headers => APIREGISTRY.getExtension("JWTTokenManager").getClaims(headers).role;
exports.getOrg = headers => APIREGISTRY.getExtension("JWTTokenManager").getClaims(headers).org;
exports.getJWT = headers => APIREGISTRY.getExtension("JWTTokenManager").getToken(headers);
exports.getToken = headers => exports.getJWT(headers);

exports.isAPIKeySecure = async function(_headers, _org) {
	return true;    // we use the default key checker in Monkshu
}

function _getOTK(_jsonReq) {
    return {...CONSTANTS.TRUE_RESULT, otk: serverutils.generateUUID(false)};
}

async function _verifyJWT(jsonReq) {
    let tokenValidationResult; try {
        tokenValidationResult = await httpClient.fetch(`${XBIN_CONSTANTS.CONF.TEKMONKS_LOGIN_API}?jwt=${jsonReq.jwt}`);
    } catch (err) {
        LOG.error(`Network error validating JWT token ${jsonReq.jwt}, validation failed. Error is ${err}`);
        return CONSTANTS.FALSE_RESULT;
    }

	if (!tokenValidationResult.ok) {
        LOG.error(`Fetch error validating JWT token ${jsonReq.jwt}, validation failed.`);
        return CONSTANTS.FALSE_RESULT;
    }

    const responseJSON = await tokenValidationResult.json();
    if ((!responseJSON.result) || (responseJSON.jwt != jsonReq.jwt)) {
        LOG.error(`Validation error when validating JWT token ${jsonReq.jwt}.`);
        return CONSTANTS.FALSE_RESULT;
    }

    try {
        const _decodeBase64 = string => Buffer.from(string, "base64").toString("utf8");
        const jwtClaims = JSON.parse(_decodeBase64(jsonReq.jwt.split(".")[1]));
        const finalResult = {...jwtClaims , role: jwtClaims.role, ...CONSTANTS.TRUE_RESULT};
        return finalResult;
    } catch (err) {
        LOG.error(`Bad JWT token passwed for login ${jsonReq.jwt}, validation succeeded but decode failed. Error is ${err}`);
        return CONSTANTS.FALSE_RESULT;
    }
}

const validateRequest = jsonReq => jsonReq && ((jsonReq.op=="verify" && jsonReq.jwt) || jsonReq.op=="getotk");
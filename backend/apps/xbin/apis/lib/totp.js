/**
 * TOTP library - supports various algorithms, otp lengths, etc.
 * 
 * (c) 2020 TekMonks
 */
const crypto = require("crypto");
const base32 = require("./base32.js");

/**
 * Returns a BASE32 encoded secret string for TOTP.
 * 
 * @param {number} length   Length of secret in bytes, default is 20. Optional.
 */
const getSecret = (length=20) => base32.encode(crypto.randomBytes(length), "RFC4648");

/**
 * Returns a new OTP.
 * 
 * @param {number} secret       The secret key. Base 32 encoded. Required.
 * @param {number} duration     The selected TOTP duration, default is 30 seconds. Optional.
 * @param {string} algorithm    The TOTP algorithm. Refer to algorithms supported by Node.js crypto. Optional.
 * @param {number} digits       The TOTP digits. Default is 6. Optional.
 * @param {number} time0        Time 0. Default is 0. Optional.
 */
function getTOTP(secret, duration=30, algorithm="sha1", digits=6, time0=0) {
    let time = Math.floor((Date.now()/1000-time0)/duration);
    time = _leftPad(time.toString(16), 16, '0');

    const decodedKey = base32.decode(secret, "RFC4648"); 

    const hmac = crypto.createHmac(algorithm, decodedKey); hmac.update(Buffer.from(time, "hex")); 
    const digest = hmac.digest(); const offset = digest[digest.length-1] & 0x0f;
    const totpTruncated = digest.slice(offset, offset+4); totpTruncated[0] = totpTruncated[0] & 0x7F;
    const totp32bit = totpTruncated.readInt32BE(); const totpValue = totp32bit % Math.pow(10, digits);
    const totpFinal = _leftPad(totpValue.toString(), digits, '0');

    return totpFinal;
}

/**
 * Verifies the TOTP, returns true or false.
 * 
 * @param {string} secret               The TOTP secret key. Base 32 encoded. Required.
 * @param {number} token                The incoming token. Required.
 * @param {number} historicalWindows    Historical windows to look back, default is 1. Optional
 * @param {number} duration             The selected TOTP duration, default is 30 seconds. Optional.
 * @param {string} algorithm            The TOTP algorithm. Refer to algorithms supported by Node.js crypto. Optional.
 */
function verifyTOTP(secret, token='', historicalWindows=1, duration=30, algorithm="sha1") {
    const totpDigits = token.toString(10).length;
    for (let n = 0; n <= historicalWindows; n++) if (getTOTP(secret, duration, algorithm, totpDigits, n*duration) == token) 
        return true;

    return false;
}

/**
 * Returns the TOTP URL. 
 * 
 * @param {string} provider  The provider or service name. Required.
 * @param {string} secret    The TOTP secret. Base 32 encoded. Required.
 * @param {string} issuer    The issuer. Required.
 * @param {string} algorithm The algorithm. Default is SHA1. Optional.
 * @param {number} digits    The TOTP digits. Default is 6. Optional.
 * @param {number} duration  The TOTP duration. Default is 30, for 30 seconds. Optional.
 */
const getTOTPURL  = (provider, secret, issuer="TekMonks", algorithm="sha1", digits=6, duration=30) => 
    `otpauth://totp/${provider}?secret=${secret}&issuer=${issuer}&algorithm=${algorithm}&digits=${digits}&period=${duration}`;

function _leftPad(string, finalLength, paddingChar) {
    const padsNeeded = finalLength - string.length; let strRet = string;
    for (let i = 0; i < padsNeeded; i++) strRet = paddingChar + strRet;
    return strRet;
}

module.exports = {getSecret, getTOTP, verifyTOTP, getTOTPURL};
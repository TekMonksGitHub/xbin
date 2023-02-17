/**
 * XBin file ops tests
 */

require(`${__dirname}/../lib/app.js`).initSync();
require(`${__dirname}/../lib/xbin_init.js`).initSync("xbin");

const CONF = require(`${API_CONSTANTS.CONF_DIR}/xbin.json`);
const uploadfile = require(`${API_CONSTANTS.API_DIR}/uploadfile.js`);


async function readUTF8DiskFileToConsole(fullpath) {
    let readStream = fs.createReadStream(fullpath, {highWaterMark: CONF.DOWNLOAD_READ_BUFFER_SIZE||DEFAULT_READ_BUFFER_SIZE, 
        flags:"r", autoClose:true});

    if (CONF.DISK_SECURED) readStream = readStream.pipe(crypt.getDecipher(CONF.SECURED_KEY)); // decrypt the file before sending if it is encrypted
    if (uploadfile.isZippable(fullpath)) readStream = readStream.pipe(zlib.createGunzip());	
    const writable = readStream.pipe(process.stdout, {end:true});
    writable.on("error", error => console.error(error));
}

exports.testMain = function(argv) { // xforge entry point for Monkshu test runs.
    readUTF8DiskFileToConsole(argv[1]);
}

if (require.main === module) exports.testMain(process.argv);
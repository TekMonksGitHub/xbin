/**
 * Addable read stream, with data chunks which can be added in Base64 or buffer object format.
 */

const {Readable} = require("stream"); 

class AddableReadstream extends Readable {
    #dataArrayOfBytes; #ended; #error; #timeout; #DEFAULT_TIMEOUT = 120000; #timeouttime = this.#DEFAULT_TIMEOUT;

    constructor(options) {
        super(options);
        this.#ended = false; this.#dataArrayOfBytes = [];
    }

    _read(size) {
        if (this.#error) {this.emit("error", this.#error); this.push(null); return;}
        if (this.#ended && this.#dataArrayOfBytes.length == 0) {this.push(null); return;}

        if (this.#dataArrayOfBytes.length != 0) {
            const chunk = this.#dataArrayOfBytes.length > size ? this.#dataArrayOfBytes.splice(0, size) : this.#dataArrayOfBytes.splice(0);
            this.push(Buffer.from(chunk));
        }

        if (this.#dataArrayOfBytes.length == 0) this.emit("read_drained");
    }

    _createNewTimeout() {
        this._stopTimeout();
        this.#timeout = setTimeout(_=>{this.error("Timeout"); this.#timeout = undefined;}, this.#timeouttime);
    }

    _stopTimeout = _ => {if (this.#timeout) clearTimeout(this.#timeout); this.#timeout = undefined}

    _hasTimeout = _ => this.#timeout ? true : false;

    /**
     * Adds given data to the stream.
     * @param {object} base64OrBuffer Data in Base64 format, or a Buffer of bytes object. Call with null
     *                                to indicate the stream should end.
     */
    addData(base64OrBuffer) {
        if (!base64OrBuffer) {this.end(); return;}
        if (this._hasTimeout) this._createNewTimeout();   // new data was added so restart the timeout

        const bufferToAdd = Buffer.isBuffer(base64OrBuffer) ? base64OrBuffer : Buffer.from(base64OrBuffer, "base64");
        const arrayOfBytes = [...bufferToAdd];
        this.#dataArrayOfBytes.push(...arrayOfBytes);
    }

    /** Ends the stream */
    end = _ => {this.cleartimeout(); if (!this.#ended) this.#ended = true;}

    /** Ends the stream with an error */
    error = msg => this.#error = msg;

    /** 
     * If no data is added within this time, the steam ends with a timeout error. 
     * @param {number} time The time after which timeout, default is 2 minutes.
     */
    settimeout = (time=this.#DEFAULT_TIMEOUT) => {this.#timeouttime = time; this._createNewTimeout();}

    /** If a timeout has been set previously, then clears it. */
    cleartimeout = _ => this._stopTimeout();
}

/**
 * Returns a new AddableReadstream object.
 * @returns A new AddableReadstream object.
 */
exports.getAddableReadstream = timeouttime => {
    const stream = new AddableReadstream();
    if (timeouttime) stream.settimeout(timeouttime);
    return stream;
}

if (require.main === module) {  // test 
    const addablestream = exports.getAddableReadstream();
    addablestream.addData(Buffer.from("\nThis is a test.\n")); addablestream.addData(Buffer.from("Also a test.\n\n"));
    addablestream.end(); addablestream.pipe(process.stdout); 
    
    addablestream.on("end", _=>process.exit(0)); process.stdin.resume(); // keep the process running till stream drained.
}
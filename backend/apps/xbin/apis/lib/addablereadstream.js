/**
 * Addable read stream, with data chunks which can be 
 * added in Base64 or buffer object format.
 * 
 * (C) 2022 TekMonks. All rights reserved.
 */

const {Readable} = require("stream"); 

class AddableReadstream extends Readable {
    #dataArrayOfBytes; #ended; #error; #timeout; #DEFAULT_TIMEOUT = 120000; #timeouttime = this.#DEFAULT_TIMEOUT;
    #REMAINING_READ_SIZE; #IS_FACING_FRONT_PRESSURE = false; #bytesAdded = 0;  #bytesSent = 0; #id = Date.now();

    constructor(options) {
        super(options);
        this.#ended = false; this.#dataArrayOfBytes = [];
    }

    _read(size) {
        if (this.#error) {
            this.emit("error", this.#error); this.push(null); this.end(); 
            LOG.debug(`Addable stream with ID ${this.#id} had error ${this.#error}, bytes added were ${this.#bytesAdded} bytes and bytes read were ${this.#bytesSent} bytes.`);
            return;
        }
        
        if (this.#dataArrayOfBytes.length == 0) {
            this.emit("read_drained");  // the last push drained us
            LOG.debug(`Addable stream with ID ${this.#id} drained, sent read_drain event, having sent ${this.#bytesSent} total bytes so far.`);
            if (this.#ended) {
                this.push(null); // ended
                LOG.debug(`Addable stream with ID ${this.#id} ended, bytes added were ${this.#bytesAdded} bytes and bytes read were ${this.#bytesSent} bytes.`);
            } else this.#IS_FACING_FRONT_PRESSURE = true;     // we didn't push so no more reads will be called till next push
        } else {
            const chunk = this.#dataArrayOfBytes.length > size ? this.#dataArrayOfBytes.splice(0, size) : this.#dataArrayOfBytes.splice(0);
            this.push(Buffer.from(chunk)); this.#REMAINING_READ_SIZE = this.#dataArrayOfBytes.length > size ? 0 : size - this.#dataArrayOfBytes.length;
            this.#bytesSent += chunk.length; 
            LOG.debug(`Addable stream with ID ${this.#id}, _read call read ${chunk.length} bytes of data, internal buffer size now is ${this.#dataArrayOfBytes.length} bytes. Total bytes read so far = ${this.#bytesSent}.`);
        }
    }

    _createNewTimeout() {
        this._stopTimeout();
        this.#timeout = setTimeout(_=>{
            this.error(`Timeout after ${this.#timeouttime} milliseconds.`); 
            this.#timeout = undefined;
        }, this.#timeouttime);
    }

    _stopTimeout = _ => {if (this.#timeout) clearTimeout(this.#timeout); this.#timeout = undefined}

    _hasTimeout = _ => this.#timeout ? true : false;

    /**
     * Adds given data to the stream.
     * @param {object} base64OrBuffer Data in Base64 format, or a Buffer of bytes object. Call with null
     *                                to indicate the stream should end.
     */
    addData(base64OrBuffer) {
        if (this.#ended) throw "Can't add data to a stream which has ended.";
        if (!base64OrBuffer) {this.end(); return;}
        if (this._hasTimeout) this._createNewTimeout();   // new data was added so restart the timeout

        const bufferToAdd = Buffer.isBuffer(base64OrBuffer) ? base64OrBuffer : Buffer.from(base64OrBuffer, "base64");
        this.#dataArrayOfBytes = this.#dataArrayOfBytes.concat(Array.from(bufferToAdd)); 
        if (this.#IS_FACING_FRONT_PRESSURE) this._read(this.#REMAINING_READ_SIZE);  // unfreeze the reads
        this.#bytesAdded += bufferToAdd.length; 
        LOG.debug(`Addable stream with ID ${this.#id}, added ${bufferToAdd.length} new bytes, total bytes added so far = ${this.#bytesAdded}, current buffer size is ${this.#dataArrayOfBytes.length} bytes.`);
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

    /** @return The stream ID */
    getID = _ => this.#id;
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
    global.LOG = console;

    const addablestream = exports.getAddableReadstream();
    addablestream.addData(Buffer.from("\nThis is a test.\n")); addablestream.addData(Buffer.from("Also a test.\n\n"));
    addablestream.end(); addablestream.pipe(process.stdout); 
    
    addablestream.on("end", _=>process.exit(0)); process.stdin.resume(); // keep the process running till stream drained.
}
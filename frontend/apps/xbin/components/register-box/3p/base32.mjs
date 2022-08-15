/**
 * MIT License
 * Copyright (C) 2016-2017 Linus Unnebäck
 * (C) 2020 TekMonks
 * 
 * Base 32 encoder/decoder modified for web. Takes in buffer and outputs BASE32 encoded
 * text or inverse.
 * 
 * Original code and license at
 * https://github.com/LinusU/base32-encode and https://github.com/LinusU/base32-decode
 */
const RFC4648 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const RFC4648_HEX = "0123456789ABCDEFGHIJKLMNOPQRSTUV";

function encode(buffer, variant, options) {
    options = options || {};
    let alphabet, defaultPadding;
    
    switch (variant) {
        case "RFC3548": case "RFC4648":
            alphabet = RFC4648;
            defaultPadding = true;
            break;
        case "RFC4648-HEX":
            alphabet = RFC4648_HEX;
            defaultPadding = true;
            break;
        case "Crockford":
            alphabet = CROCKFORD;
            defaultPadding = false;
            break;
        default:
            throw new Error(`Unknown base32 variant: ${variant}`);
    }
    
    const padding = (options.padding !== undefined ? options.padding : defaultPadding);
    const length = buffer.byteLength;
    const view = buffer;
    
    let bits = 0, value = 0, output = "";
    for (let i = 0; i < length; i++) {
        value = (value << 8) | view[i];
        bits += 8;
        
        while (bits >= 5) {
            output += alphabet[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    
    if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
    if (padding) while ((output.length % 8) !== 0) output += "=";
    return output;
}

function readChar (alphabet, char) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) throw new Error(`Invalid character found: ${char}`);
    return idx;
}
  
function decode(input, variant) {
    let alphabet;
    switch (variant) {
        case "RFC3548": case "RFC4648":
            alphabet = RFC4648
            input = input.replace(/=+$/, "")
            break
      case "RFC4648-HEX":
            alphabet = RFC4648_HEX;
            input = input.replace(/=+$/, "");
            break;
      case "Crockford":
            alphabet = CROCKFORD;
            input = input.toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1");
            break;
      default:
        throw new Error(`Unknown base32 variant: ${variant}`);
    }
  
    const length = input.length;
    let bits = 0, value = 0, index = 0;
    const output = new Uint8Array((length * 5 / 8) | 0);
  
    for (let i = 0; i < length; i++) {
        value = (value << 5) | readChar(alphabet, input[i]);
        bits += 5;

        if (bits >= 8) {
            output[index++] = (value >>> (bits - 8)) & 255;
            bits -= 8;
        }
    }
  
    return output;
}

export const base32 = {encode, decode};
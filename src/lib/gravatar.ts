/**
 * UTF-8 encode a string into an array of byte values.
 */
function utf8ToBytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    } else {
      // Surrogate pair
      i++;
      const low = str.charCodeAt(i);
      const fullCode = 0x10000 + (((code & 0x3ff) << 10) | (low & 0x3ff));
      bytes.push(
        0xf0 | (fullCode >> 18),
        0x80 | ((fullCode >> 12) & 0x3f),
        0x80 | ((fullCode >> 6) & 0x3f),
        0x80 | (fullCode & 0x3f)
      );
    }
  }
  return bytes;
}

/**
 * Convert a 4-byte little-endian word array to a hex string.
 */
function wordsToHex(words: number[]): string {
  const hex = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < words.length * 4; i++) {
    result += hex.charAt((words[i >> 2] >> ((i % 4) * 8 + 4)) & 0xf);
    result += hex.charAt((words[i >> 2] >> ((i % 4) * 8)) & 0xf);
  }
  return result;
}

/**
 * MD5 hash a string. Returns a 32-char hex string.
 */
function md5(str: string): string {
  const bytes = utf8ToBytes(str);

  // Convert byte array to 32-bit word array
  const msg: number[] = [];
  const len = bytes.length;
  for (let i = 0; i < len; i++) {
    msg[i >> 2] |= bytes[i] << ((i % 4) * 8);
  }

  // Append padding and length
  msg[len >> 2] |= 0x80 << ((len % 4) * 8);
  const paddedLen = (((len + 64) >> 9) << 4) + 14;
  msg[paddedLen] = len * 8;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  const add = (x: number, y: number) => {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xffff);
  };

  const f1 = (x: number, y: number, z: number) => (x & y) | (~x & z);
  const f2 = (x: number, y: number, z: number) => (x & z) | (y & ~z);
  const f3 = (x: number, y: number, z: number) => x ^ y ^ z;
  const f4 = (x: number, y: number, z: number) => y ^ (x | ~z);

  const round = (
    fn: (x: number, y: number, z: number) => number,
    aRef: number,
    bRef: number,
    cRef: number,
    dRef: number,
    idx: number,
    s: number,
    t: number
  ) => {
    return add(rotl(add(add(aRef, fn(bRef, cRef, dRef)), add(msg[idx], t)), s), bRef);
  };

  for (let i = 0; i < msg.length; i += 16) {
    const olda = a;
    const oldb = b;
    const oldc = c;
    const oldd = d;

    a = round(f1, a, b, c, d, i + 0, 7, -680876936);
    d = round(f1, d, a, b, c, i + 1, 12, -389564586);
    c = round(f1, c, d, a, b, i + 2, 17, 606105819);
    b = round(f1, b, c, d, a, i + 3, 22, -1044525330);
    a = round(f1, a, b, c, d, i + 4, 7, -176418897);
    d = round(f1, d, a, b, c, i + 5, 12, 1200080426);
    c = round(f1, c, d, a, b, i + 6, 17, -1473231341);
    b = round(f1, b, c, d, a, i + 7, 22, -45705983);
    a = round(f1, a, b, c, d, i + 8, 7, 1770035416);
    d = round(f1, d, a, b, c, i + 9, 12, -1958414417);
    c = round(f1, c, d, a, b, i + 10, 17, -42063);
    b = round(f1, b, c, d, a, i + 11, 22, -1990404162);
    a = round(f1, a, b, c, d, i + 12, 7, 1804603682);
    d = round(f1, d, a, b, c, i + 13, 12, -40341101);
    c = round(f1, c, d, a, b, i + 14, 17, -1502002290);
    b = round(f1, b, c, d, a, i + 15, 22, 1236535329);

    a = round(f2, a, b, c, d, i + 1, 5, -165796510);
    d = round(f2, d, a, b, c, i + 6, 9, -1069501632);
    c = round(f2, c, d, a, b, i + 11, 14, 643717713);
    b = round(f2, b, c, d, a, i + 0, 20, -373897302);
    a = round(f2, a, b, c, d, i + 5, 5, -701558691);
    d = round(f2, d, a, b, c, i + 10, 9, 38016083);
    c = round(f2, c, d, a, b, i + 15, 14, -660478335);
    b = round(f2, b, c, d, a, i + 4, 20, -405537848);
    a = round(f2, a, b, c, d, i + 9, 5, 568446438);
    d = round(f2, d, a, b, c, i + 14, 9, -1019803690);
    c = round(f2, c, d, a, b, i + 3, 14, -187363961);
    b = round(f2, b, c, d, a, i + 8, 20, 1163531501);
    a = round(f2, a, b, c, d, i + 13, 5, -1444681467);
    d = round(f2, d, a, b, c, i + 2, 9, -51403784);
    c = round(f2, c, d, a, b, i + 7, 14, 1735328473);
    b = round(f2, b, c, d, a, i + 12, 20, -1926607734);

    a = round(f3, a, b, c, d, i + 5, 4, -378558);
    d = round(f3, d, a, b, c, i + 8, 11, -2022574463);
    c = round(f3, c, d, a, b, i + 11, 16, 1839030562);
    b = round(f3, b, c, d, a, i + 14, 23, -35309556);
    a = round(f3, a, b, c, d, i + 1, 4, -1530992060);
    d = round(f3, d, a, b, c, i + 4, 11, 1272893353);
    c = round(f3, c, d, a, b, i + 7, 16, -155497632);
    b = round(f3, b, c, d, a, i + 10, 23, -1094730640);
    a = round(f3, a, b, c, d, i + 13, 4, 681279174);
    d = round(f3, d, a, b, c, i + 0, 11, -358537222);
    c = round(f3, c, d, a, b, i + 3, 16, -722521979);
    b = round(f3, b, c, d, a, i + 6, 23, 76029189);
    a = round(f3, a, b, c, d, i + 9, 4, -640364487);
    d = round(f3, d, a, b, c, i + 12, 11, -421815835);
    c = round(f3, c, d, a, b, i + 15, 16, 530742520);
    b = round(f3, b, c, d, a, i + 2, 23, -995338651);

    a = round(f4, a, b, c, d, i + 0, 6, -198630844);
    d = round(f4, d, a, b, c, i + 7, 10, 1126891415);
    c = round(f4, c, d, a, b, i + 14, 15, -1416354905);
    b = round(f4, b, c, d, a, i + 5, 21, -57434055);
    a = round(f4, a, b, c, d, i + 12, 6, 1700485571);
    d = round(f4, d, a, b, c, i + 3, 10, -1894986606);
    c = round(f4, c, d, a, b, i + 10, 15, -1051523);
    b = round(f4, b, c, d, a, i + 1, 21, -2054922799);
    a = round(f4, a, b, c, d, i + 8, 6, 1873313359);
    d = round(f4, d, a, b, c, i + 15, 10, -30611744);
    c = round(f4, c, d, a, b, i + 6, 15, -1560198380);
    b = round(f4, b, c, d, a, i + 13, 21, 1309151649);
    a = round(f4, a, b, c, d, i + 4, 6, -145523070);
    d = round(f4, d, a, b, c, i + 11, 10, -1120210379);
    c = round(f4, c, d, a, b, i + 2, 15, 718787259);
    b = round(f4, b, c, d, a, i + 9, 21, -343485551);

    a = add(a, olda);
    b = add(b, oldb);
    c = add(c, oldc);
    d = add(d, oldd);
  }

  return wordsToHex([a, b, c, d]);
}

/**
 * Build a Gravatar URL from an email address.
 * @param email - User email
 * @param size - Desired image size (default 256)
 * @param fallback - Fallback image style: 'identicon' | 'monsterid' | 'wavatar' | 'retro' | 'robohash' | 'blank' (default 'identicon')
 */
export function getGravatarUrl(
  email: string,
  size = 256,
  fallback: string = 'identicon'
): string {
  const hash = md5(email.toLowerCase().trim());
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=${fallback}&r=g`;
}
const maxInt = 2147483647; // 2^31-1
const base = 36;
const tMin = 1;
const tMax = 26;
const skew = 38;
const damp = 700;
const initialBias = 72;
const initialN = 128;
const delimiter = "-";
const adaptD = base - tMin; // 35
const adaptL = (adaptD * tMax) >>> 1; // 455

const ERR = {
  OVERFLOW: "Overflow: input needs wider integers",
  INVALID: "Invalid Punycode input",
} as const;

const error = (t: string) => {
  throw new RangeError(t);
};

const floor = Math.floor;

const basicToDigit = (cp: number) => {
  if (cp >= 0x30 && cp < 0x3a) return cp - 22;
  if (cp >= 0x41 && cp < 0x5b) return cp - 0x41;
  if (cp >= 0x61 && cp < 0x7b) return cp - 0x61;
  return base;
};

const adapt = (delta: number, numPoints: number, firstTime: boolean) => {
  delta = firstTime ? floor(delta / damp) : delta >>> 1;
  delta += floor(delta / numPoints);
  let k = 0;
  for (; delta > adaptL; k += base) delta = floor(delta / adaptD);
  return k + floor(((adaptD + 1) * delta) / (delta + skew));
};

/**
 * Decodes Punycode (RFC 3492)
 * npm package "punycode" is too large. We just need a simple and robust one.
 * Punycode is case-insensitive; decodePunycode handle labels individually without dot split
 */
export const decodePunycode = (input: string) => {
  input = input.toLowerCase();
  input = input.startsWith("xn--") ? input.slice(4) : input;
  if (!input) error(ERR.INVALID);
  const output: number[] = [];
  const len = input.length;
  let i = 0;
  let n = initialN;
  let bias = initialBias;

  const k = input.lastIndexOf(delimiter);

  let j = 0;
  for (; j < k; ++j) {
    const cp = input.codePointAt(j)!;
    if (cp >= 0x80) error(ERR.INVALID);
    output.push(cp);
  }

  if (j > 0) j++;

  if (j >= len) error(ERR.INVALID);

  while (j < len) {
    const oldi = i;
    let w = 1;

    for (let k = base; ; k += base) {
      if (j >= len) error(ERR.INVALID);
      const digit = basicToDigit(input.charCodeAt(j++));
      if (digit >= base || digit > floor((maxInt - i) / w)) error(ERR.OVERFLOW);

      i += digit * w;

      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;

      if (digit < t) break;

      const baseMinusT = base - t;
      if (w > floor(maxInt / baseMinusT)) error(ERR.OVERFLOW);
      w *= baseMinusT;
    }

    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi === 0);
    if (floor(i / out) > maxInt - n) error(ERR.OVERFLOW);
    n += floor(i / out);
    i %= out;

    output.splice(i++, 0, n);
  }

  return String.fromCodePoint(...output);
};

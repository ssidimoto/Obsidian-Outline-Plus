// hdiff.ts -- histogram diff
// Copyright 2025 Ray Gardner
// License: 0BSD

/**
 * Ported from C to TypeScript.
 * Maintains exact logic and structure of the original hdiff.c
 */

const INT_MAX = 2147483647;

function minof(a: number, b: number): number {
  return a < b ? a : b;
}

function maxof(a: number, b: number): number {
  return a > b ? a : b;
}

function error_exit(s: string): never {
  throw new Error(s);
}

function xzallocInt32(n: number): Int32Array {
  return new Int32Array(n);
}

function xreallocInt32(p: Int32Array, n: number): Int32Array {
  const newArr = new Int32Array(n);
  newArr.set(p.subarray(0, Math.min(p.length, n)));
  return newArr;
}

function read_input_string(input: string): { buf: Buffer; len: number } {
  const raw = Buffer.from(input, 'utf8');
  if (raw.length >= INT_MAX) {
    error_exit("input too large");
  }
  const buf = Buffer.alloc(raw.length + 1);
  raw.copy(buf, 0, 0, raw.length);
  buf[raw.length] = 0;
  return { buf, len: raw.length };
}

function eqln(a: Buffer, aOff: number, alen: number, b: Buffer, bOff: number, blen: number): boolean {
  if (alen !== blen) return false;
  for (let i = 0; i < alen; i++) {
    if (a[aOff + i] !== b[bOff + i]) return false;
  }
  return true;
}

function fill_offset_vec(v: Int32Array | null, dat: Buffer, len: number): number {
  let k = 1;
  let b = 0;
  
  while (b < len) {
    const p = dat.indexOf(10, b); // 10 is '\n'
    if (p === -1 || p >= len) break;
    
    const nextLineStart = p + 1;
    b = nextLineStart;
    k++; // one more than num of newlines seen
    if (v) v[k] = b; // v[2] == offset to line 2 etc.
  }
  
  const remaining = len - b;
  if (remaining > 0) {
    if (v) {
      v[++k] = b + remaining;
    } else {
      k++;
    }
  }
  return k - 1;
}

function isspace(c: number): boolean {
  // \t, \n, \v, \f, \r, space
  return (c >= 9 && c <= 13) || c === 32;
}

function tolower(c: number): number {
  if (c >= 65 && c <= 90) return c + 32;
  return c;
}

function hash(s: Buffer, start: number, len: number): number {
  let h = 5381; // djb2a hash
  let i = 0;
  while (i < len) {
    const c = s[start + i];
    if (isspace(c)) {
      i++;
    } else {
      // Unsigned 32-bit arithmetic: (h * 33) ^ lower
      h = ((h * 33) ^ tolower(c)) >>> 0;
      i++;
    }
  }
  return h;
}

function hash_find(s: Buffer, sOff: number, len: number, 
                   hashtbl: Int32Array, hmask: number, dat: Buffer, offs: Int32Array): number {
  let k: number;
  const h0 = hash(s, sOff, len);
  let h = h0 & hmask;
  let shiftH0 = h0;

  while ((k = hashtbl[h]) !== 0 && !eqln(s, sOff, len, dat, offs[k], offs[k + 1] - offs[k])) {
    shiftH0 >>>= 5;
    h = (h * 5 + 1 + shiftH0) & hmask;
  }
  // Now hashtbl[h] is 0 or it's a hit
  return h;
}

interface StackRef {
  stk: Int32Array;
  max: number;
  cnt: number;
}

function push_quad(stack: StackRef, a: number, b: number, c: number, d: number): void {
  if (stack.cnt + 4 > stack.max) {
    stack.max = Math.floor(stack.max * 8 / 5);
    stack.stk = xreallocInt32(stack.stk, stack.max);
  }
  stack.stk[stack.cnt++] = a;
  stack.stk[stack.cnt++] = b;
  stack.stk[stack.cnt++] = c;
  stack.stk[stack.cnt++] = d;
}

function pop_quad(stack: StackRef): [number, number, number, number] {
  if (stack.cnt < 4) error_exit("stack underflow");
  const d = stack.stk[--stack.cnt];
  const c = stack.stk[--stack.cnt];
  const b = stack.stk[--stack.cnt];
  const a = stack.stk[--stack.cnt];
  return [a, b, c, d];
}

// Formats time in ISO format ("yyyy-mm-dd hh:mm:ss.nnnnnnnnn -hhmm").
function fmt_iso_time(mtime: Date, nsec: number): string {
  const pad = (n: number, l: number = 2) => n.toString().padStart(l, '0');
  
  const y = mtime.getFullYear();
  const m = pad(mtime.getMonth() + 1);
  const d = pad(mtime.getDate());
  const hh = pad(mtime.getHours());
  const mm = pad(mtime.getMinutes());
  const ss = pad(mtime.getSeconds());
  
  const ns = nsec.toString().padStart(9, '0');
  
  const tzOff = -mtime.getTimezoneOffset();
  const absOff = Math.abs(tzOff);
  const tzH = pad(Math.floor(absOff / 60));
  const tzM = pad(absOff % 60);
  const tzSign = tzOff >= 0 ? '+' : '-';
  
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}.${ns} ${tzSign}${tzH}${tzM}`;
}

function printhdr(write: (s: string) => void, prefix: string, label: string, mtime?: Date): void {
  const mtim = mtime ?? new Date();
  const nsec = mtim.getMilliseconds() * 1000000;
  write(`${prefix} ${label}\t${fmt_iso_time(mtim, nsec)}\n`);
}

function slider(d: Int32Array, j: number, k: number, offs: Int32Array, dat: Buffer, nrecs: number): void {
  let lenlo: number, lenhi: number, n: number;
  while (d[k + 1] < nrecs && d[k + 1] < d[k + 4]) {
    lenlo = offs[d[k] + 1] - offs[d[k]];
    lenhi = offs[d[k + 1] + 1] - offs[d[k + 1]];
    if (!eqln(dat, offs[d[k]], lenlo, dat, offs[d[k + 1]], lenhi)) break;
    for (n = j; n < j + 4; n++) d[n]++;
  }
}

function print_line(write: (s: string) => void, flg: string, dat: Buffer, offs: Int32Array, i: number): void {
  const start = offs[i];
  const end = offs[i + 1];
  const line = dat.subarray(start, end).toString('utf8');
  write(`${flg} ${line}`);
}

function print_diff(write: (s: string) => void, kind: string, adat: Buffer, aoffs: Int32Array,
                    bdat: Buffer, boffs: Int32Array, alo: number, ahi: number, blo: number, bhi: number): void {
  let dbuf: string, abuf: string;
  const a_hi_adj = ahi - 1;
  const b_hi_adj = bhi - 1;

  if (alo >= a_hi_adj) dbuf = `${a_hi_adj}`;
  else dbuf = `${alo},${a_hi_adj}`;

  if (blo >= b_hi_adj) abuf = `${b_hi_adj}`;
  else abuf = `${blo},${b_hi_adj}`;

  write(`${dbuf}${kind}${abuf}\n`);
  
  let curA = alo;
  while (curA <= a_hi_adj)
    print_line(write, '<', adat, aoffs, curA++);
  
  if (kind === 'c') write("---\n");
  
  let curB = blo;
  while (curB <= b_hi_adj)
    print_line(write, '>', bdat, boffs, curB++);
}

function print_diffs_default(write: (s: string) => void, d: Int32Array, diffscnt: number,
                             adat: Buffer, aoffs: Int32Array, arecs: number, 
                             bdat: Buffer, boffs: Int32Array, brecs: number): void {
  let j: number;
  for (j = 4; j < diffscnt - 4; j += 4) {
    if (d[j] === d[j + 1]) slider(d, j, j + 2, boffs, bdat, brecs);
    if (d[j + 2] === d[j + 3]) slider(d, j, j, aoffs, adat, arecs);
  }
  for (j = 4; j < diffscnt - 4; j += 4) {
    if (d[j] < d[j + 1]) {
      if (d[j + 2] < d[j + 3])
        print_diff(write, "c", adat, aoffs, bdat, boffs, d[j], d[j + 1], d[j + 2], d[j + 3]);
      else
        print_diff(write, "d", adat, aoffs, bdat, boffs, d[j], d[j + 1], d[j + 2], d[j + 3]);
    } else if (d[j + 2] < d[j + 3]) {
      print_diff(write, "a", adat, aoffs, bdat, boffs, d[j], d[j + 1], d[j + 2], d[j + 3]);
    } else {
      write(`NO DATA IN CHANGE? ${d[j]} ${d[j + 1]} ${d[j + 2]} ${d[j + 3]}\n`);
    }
  }
}

function print_line_u(write: (s: string) => void, prefix: string, i: number, dat: Buffer, offs: Int32Array): void {
  const start = offs[i];
  const end = offs[i + 1];
  const line = dat.subarray(start, end).toString('utf8');
  write(`${prefix}${line}`);
}

function print_diffs_unified(write: (s: string) => void, d: Int32Array, diffscnt: number,
                             alabel: string, adat: Buffer, aoffs: Int32Array, arecs: number,
                             blabel: string, bdat: Buffer, boffs: Int32Array, brecs: number, nctx: number): void {
  let i = 4, j: number, k: number, n: number, calo: number, cahi: number, cblo: number, cbhi: number;
  if (diffscnt < 12) return;
  printhdr(write, "---", alabel);
  printhdr(write, "+++", blabel);

  for (j = 4; j < diffscnt - 4; j += 4) {
    if (d[j] === d[j + 1]) slider(d, j, j + 2, boffs, bdat, brecs);
    if (d[j + 2] === d[j + 3]) slider(d, j, j, aoffs, adat, arecs);
  }
  
  while (i < diffscnt - 4) {
    // Find chunks separated by <= 2 * nctx
    for (j = i + 4; j < diffscnt - 4 && d[j] - d[j - 3] <= 2 * nctx; j += 4)
      ;
    calo = maxof(d[i] - nctx, 1);
    cahi = minof(d[j - 3] + nctx, d[j]);
    cblo = maxof(d[i + 2] - nctx, 1);
    cbhi = minof(d[j - 1] + nctx, d[j + 3]);

    // Adjust begin line numbers if count is zero
    write(`@@ -${(cahi - calo) ? calo : calo - 1}`);
    if (cahi - calo !== 1) write(`,${cahi - calo}`);

    write(` +${(cbhi - cblo) ? cblo : cblo - 1}`);
    if (cbhi - cblo !== 1) write(`,${cbhi - cblo}`);
    write(" @@\n");

    for (k = i; k < j; k += 4) {
      for (n = (k > i ? d[k - 3] : maxof(1, d[k] - nctx)); n < d[k]; n++)
        print_line_u(write, " ", n, adat, aoffs);
      for (n = d[k]; n < d[k + 1]; n++) print_line_u(write, "-", n, adat, aoffs);
      for (n = d[k + 2]; n < d[k + 3]; n++) print_line_u(write, "+", n, bdat, boffs);
    }
    for (n = d[j - 3]; n < minof(d[j - 3] + nctx, d[j]); n++)
      print_line_u(write, " ", n, adat, aoffs);
    i = j;
  }
}

function print_diffs(write: (s: string) => void, d: Int32Array, diffscnt: number,
                     alabel: string, adat: Buffer, aoffs: Int32Array, arecs: number,
                     blabel: string, bdat: Buffer, boffs: Int32Array, brecs: number, dtype: string, nctx: number): void {
  if (dtype === 'u') {
    print_diffs_unified(write, d, diffscnt, alabel, adat, aoffs, arecs, blabel, bdat, boffs, brecs, nctx);
  } else {
    print_diffs_default(write, d, diffscnt, adat, aoffs, arecs, bdat, boffs, brecs);
  }
}

function getcnt(ap: number, acnt: Int32Array): number {
  return acnt[ap] >= 0 ? acnt[ap] : acnt[-acnt[ap]];
}

function beqa(ap: number, acnt: Int32Array, bp: number, bref: Int32Array): boolean {
  return bref[bp] === (acnt[ap] >= 0 ? ap : -acnt[ap]);
}

const INITLOWCNT = 512; // jgit uses 65

function find_best_matching_region(acnt: Int32Array, anext: Int32Array, bref: Int32Array,
                                   alo: number, ahi: number, blo: number, bhi: number,
                                   k_out: { kalo: number, kahi: number, kblo: number, kbhi: number }): boolean {
  let i: number, j: number, lowcnt: number, rgnlowcnt: number, cnt: number, nextj: number, nexti: number, nalo: number, nahi: number, nblo: number, nbhi: number;
  k_out.kalo = 0;
  if (alo === ahi || blo === bhi) return false;
  lowcnt = INITLOWCNT;
  
  for (i = blo; i < bhi; i = nexti) {
    nexti = i + 1;
    if (!(j = bref[i])) continue;
    if (j >= ahi || !acnt[j] || acnt[j] > lowcnt) continue;
    
    // try to find j inside A range
    while (j < alo && anext[j]) j = anext[j];
    if (j < alo || j >= ahi) continue;
    
    while (true) {
      nextj = anext[j];
      // alo <= j < ahi and a[j] matches b[i]
      // set current match, then expand it
      nalo = j; nahi = j + 1; nblo = i; nbhi = i + 1;
      rgnlowcnt = getcnt(nalo, acnt);
      
      while (alo < nalo && blo < nblo && beqa(nalo - 1, acnt, nblo - 1, bref)) {
        nalo--; nblo--;
        cnt = getcnt(nalo, acnt);
        if (cnt < rgnlowcnt) rgnlowcnt = cnt;
      }
      while (nahi < ahi && nbhi < bhi && beqa(nahi, acnt, nbhi, bref)) {
        cnt = getcnt(nahi, acnt);
        if (cnt < rgnlowcnt) rgnlowcnt = cnt;
        nahi++; nbhi++;
      }
      
      if (!k_out.kalo || (nahi - nalo > k_out.kahi - k_out.kalo) || rgnlowcnt < lowcnt) {
        k_out.kalo = nalo; k_out.kahi = nahi; k_out.kblo = nblo; k_out.kbhi = nbhi;
        lowcnt = rgnlowcnt;
      }
      
      if (nexti < nbhi) nexti = nbhi;
      while (nextj && nextj < nahi) nextj = anext[nextj];
      if (!nextj || nextj >= ahi) break;
      j = nextj;
    }
  }
  return k_out.kalo !== 0;
}

function diff_buffers(adat: Buffer, alen: number, bdat: Buffer, blen: number,
                      alabel: string, blabel: string, dtype: string, nctx: number,
                      write: (s: string) => void): number {
  let arecs: number, brecs: number;
  let aoffs: Int32Array, boffs: Int32Array;
  let alo: number, ahi: number, blo: number, bhi: number;
  const k_res = { kalo: 0, kahi: 0, kblo: 0, kbhi: 0 };
  let anext: Int32Array, bref: Int32Array, acnt: Int32Array;
  let hashtbl: Int32Array, hashtblsize: number, hx: number;
  
  const rstackRef: StackRef = {
    stk: xzallocInt32(100),
    max: 100,
    cnt: 0
  };
  
  const diffsRef: StackRef = {
    stk: xzallocInt32(100),
    max: 100,
    cnt: 0
  };

  let i: number, j: number, k: number;

  // count lines
  arecs = fill_offset_vec(null, adat, alen);
  brecs = fill_offset_vec(null, bdat, blen);

  // alloc vectors
  aoffs = xzallocInt32(arecs + 2);
  boffs = xzallocInt32(brecs + 2);
  anext = xzallocInt32(arecs + 1);
  bref = xzallocInt32(brecs + 1);
  acnt = xzallocInt32(arecs + 1);
  
  hashtblsize = 128;
  while (hashtblsize < arecs / 4 * 5) {
    hashtblsize *= 2;
  }
  hashtbl = xzallocInt32(hashtblsize);

  // fill offset vectors
  arecs = fill_offset_vec(aoffs, adat, alen);
  brecs = fill_offset_vec(boffs, bdat, blen);

  // fill anext and bref
  for (k = arecs; k > 0; k--) {
    hx = hash_find(adat, aoffs[k], aoffs[k+1] - aoffs[k], hashtbl, hashtblsize - 1, adat, aoffs);
    if (hashtbl[hx]) anext[k] = hashtbl[hx];
    hashtbl[hx] = k;
  }
  for (k = 1; k <= brecs; k++) {
    hx = hash_find(bdat, boffs[k], boffs[k+1] - boffs[k], hashtbl, hashtblsize - 1, adat, aoffs);
    bref[k] = hashtbl[hx];
  }

  // Fill count
  for (i = 1; i <= arecs; i++) {
    if (!acnt[i]) {
      acnt[i] = 1;
      let currJ = anext[i];
      while (currJ) {
        acnt[i]++;
        acnt[currJ] = -i;
        currJ = anext[currJ];
      }
    }
  }

  push_quad(diffsRef, 1, 1, 1, 1);
  if (arecs || brecs)
    push_quad(rstackRef, 1, arecs + 1, 1, brecs + 1);

  while (rstackRef.cnt) {
    [alo, ahi, blo, bhi] = pop_quad(rstackRef);
    
    for (i = blo; i < bhi; i++)
      if (bref[i]) acnt[bref[i]] = 0;
    
    for (i = alo; i < ahi; i++) {
      if (acnt[i] < 0) acnt[-acnt[i]] = 0;
      else acnt[i] = 0;
    }
    
    for (i = alo; i < ahi; i++) {
      if (acnt[i] < 0) acnt[-acnt[i]]++;
      else if (!acnt[i]) acnt[i]++;
      else error_exit("refill error");
    }

    if (find_best_matching_region(acnt, anext, bref, alo, ahi, blo, bhi, k_res)) {
      if (k_res.kahi < ahi || k_res.kbhi < bhi)
        push_quad(rstackRef, k_res.kahi, ahi, k_res.kbhi, bhi);
      if (alo < k_res.kalo || blo < k_res.kblo)
        push_quad(rstackRef, alo, k_res.kalo, blo, k_res.kblo);
    } else {
      push_quad(diffsRef, alo, ahi, blo, bhi);
    }
  }

  push_quad(diffsRef, arecs + 1, arecs + 1, brecs + 1, brecs + 1);
  print_diffs(write, diffsRef.stk, diffsRef.cnt, alabel, adat, aoffs, arecs, blabel, bdat, boffs, brecs, dtype, nctx);

  return diffsRef.cnt > 8 ? 1 : 0;
}

export type HistogramDiffFormat = 'd' | 'u';

export interface HistogramDiffOptions {
  format?: HistogramDiffFormat;
  context?: number;
  labelA?: string;
  labelB?: string;
}

export interface HistogramDiffResult {
  output: string;
  hasChanges: boolean;
}

export function histogramDiff(doc1: string, doc2: string, options: HistogramDiffOptions = {}): HistogramDiffResult {
  const dtype = options.format ?? 'd';
  const nctx = options.context ?? 3;
  const labelA = options.labelA ?? 'doc1';
  const labelB = options.labelB ?? 'doc2';

  const { buf: adat, len: alen } = read_input_string(doc1);
  const { buf: bdat, len: blen } = read_input_string(doc2);

  const outputParts: string[] = [];
  const write = (s: string) => outputParts.push(s);
  const ret = diff_buffers(adat, alen, bdat, blen, labelA, labelB, dtype, nctx, write);

  return {
    output: outputParts.join(''),
    hasChanges: ret !== 0,
  };
}

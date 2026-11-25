// File contents: a private Vercel Blob store online, the data/ folder locally.
import fs from 'node:fs';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  BlobNotFoundError, del, get, head, issueSignedToken, parseStoreIdFromDelegationToken, presignUrl,
} from '@vercel/blob';
import { DATA_DIR, ON_VERCEL, USE_BLOB } from './config.js';
import { UserError } from './errors.js';

const access = 'private';
const UPLOAD_MINUTES = 15;

const blobStorage = {
  // A short-lived link that lets the browser send exactly this one file to Blob.
  async uploadTarget({ pathname, maxBytes, contentType }) {
    const limits = {
      pathname,
      validUntil: Date.now() + UPLOAD_MINUTES * 60_000,
      maximumSizeInBytes: maxBytes,
      allowedContentTypes: [contentType],
    };
    const token = await issueSignedToken({ ...limits, operations: ['put'] });
    const { presignedUrl } = await presignUrl(token, {
      ...limits, operation: 'put', access, allowOverwrite: false, addRandomSuffix: false,
    });
    // The same headers @vercel/blob's own browser client sends.
    return {
      url: presignedUrl,
      headers: {
        'x-api-version': '13',
        'x-vercel-blob-access': access,
        'x-vercel-blob-store-id': parseStoreIdFromDelegationToken(token.delegationToken),
        'x-content-type': contentType,
      },
    };
  },
  async inspect(pathname) {
    try {
      const { size } = await head(pathname);
      const result = await get(pathname, { access });
      if (!result?.stream) return null;
      const reader = result.stream.getReader();
      const { value } = await reader.read();
      await reader.cancel();
      return { size, start: Buffer.from(value ?? []).subarray(0, 512) };
    } catch (err) {
      if (err instanceof BlobNotFoundError) return null;
      throw err;
    }
  },
  async open(pathname) {
    const result = await get(pathname, { access });
    return result?.stream ? Readable.fromWeb(result.stream) : null;
  },
  remove: (pathname) => del(pathname),
};

const local = (pathname) => path.join(DATA_DIR, pathname);

const diskStorage = {
  async uploadTarget({ id }) {
    return { url: `/api/uploads/${id}/content`, headers: {} };
  },
  async write(pathname, stream, maxBytes) {
    const target = local(pathname);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    let total = 0;
    const limit = new Transform({
      transform(chunk, encoding, done) {
        total += chunk.length;
        if (total > maxBytes) done(new UserError('Файл тым үлкен.'));
        else done(null, chunk);
      },
    });
    try {
      await pipeline(stream, limit, fs.createWriteStream(target, { flags: 'wx' }));
    } catch (err) {
      if (err.code === 'EEXIST') throw new UserError('Файл бұрын жүктелген.');
      fs.rmSync(target, { force: true });
      throw err;
    }
  },
  async inspect(pathname) {
    if (!fs.existsSync(local(pathname))) return null;
    const { size } = fs.statSync(local(pathname));
    const start = Buffer.alloc(Math.min(512, size));
    const fd = fs.openSync(local(pathname), 'r');
    fs.readSync(fd, start, 0, start.length, 0);
    fs.closeSync(fd);
    return { size, start };
  },
  async open(pathname) {
    return fs.existsSync(local(pathname)) ? fs.createReadStream(local(pathname)) : null;
  },
  async remove(pathname) {
    fs.rmSync(local(pathname), { force: true });
  },
};

if (ON_VERCEL && !USE_BLOB) console.error('Blob is missing: connect a private Blob store to this Vercel project.');

export const usesDisk = !USE_BLOB && !ON_VERCEL;
export const storage = usesDisk ? diskStorage : blobStorage;

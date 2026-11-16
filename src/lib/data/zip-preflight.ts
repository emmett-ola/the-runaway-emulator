import { EXPORT_LIMITS, refuse, validateExportPath } from './validation';

export interface ZipEntry {
  path: string;
  method: number;
  bytes: number;
  crc: number;
  start: number;
  end: number;
}

/** A format-1 header gate, not a ZIP decoder. fflate owns DEFLATE decoding. */
export const preflightZip = (bytes: Uint8Array): ZipEntry[] => {
  if (bytes.byteLength > EXPORT_LIMITS.compressed) refuse('compressed-limit', 'Import exceeds 64 MiB compressed.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fits = (offset: number, size: number): void => {
    if (offset < 0 || size < 0 || offset + size > bytes.byteLength) refuse('zip', 'Truncated or overlapping ZIP headers.');
  };
  const u16 = (offset: number): number => { fits(offset, 2); return view.getUint16(offset, true); };
  const u32 = (offset: number): number => { fits(offset, 4); return view.getUint32(offset, true); };
  if (bytes.byteLength < 22 || u32(0) !== 0x04034b50) refuse('zip', 'Import requires a format-1 ZIP archive.');
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= Math.max(0, bytes.byteLength - 65557); offset--) {
    if (u32(offset) === 0x06054b50 && offset + 22 + u16(offset + 20) === bytes.byteLength) {
      if (eocd !== -1) refuse('zip', 'Ambiguous ZIP end headers.');
      eocd = offset;
    }
  }
  if (eocd === -1) refuse('zip', 'ZIP end header is missing.');
  if (eocd >= 20 && u32(eocd - 20) === 0x07064b50) refuse('zip64', 'ZIP64 archives are unsupported.');
  const count = u16(eocd + 10), directorySize = u32(eocd + 12), directory = u32(eocd + 16);
  if (count === 0xffff || directorySize === 0xffffffff || directory === 0xffffffff) refuse('zip64', 'ZIP64 archives are unsupported.');
  if (u16(eocd + 4) || u16(eocd + 6) || u16(eocd + 8) !== count) refuse('zip', 'Split ZIP archives are unsupported.');
  if (count > EXPORT_LIMITS.entries) refuse('entry-limit', 'Import exceeds 10000 ZIP entries including manifest.');
  if (!count || directory + directorySize !== eocd) refuse('zip', 'ZIP central directory is inconsistent.');
  fits(directory, directorySize);
  const entries: ZipEntry[] = [];
  let central = directory, local = 0, total = 0;
  const rawName = (offset: number, size: number): string => {
    if (size > EXPORT_LIMITS.path) refuse('path-limit', 'Import path exceeds 4096 ASCII bytes.');
    fits(offset, size);
    let name = '';
    for (let index = offset; index < offset + size; index++) {
      if (bytes[index] < 0x21 || bytes[index] > 0x7e) refuse('path', 'ZIP names must be raw printable ASCII.');
      name += String.fromCharCode(bytes[index]);
    }
    // Recovery names are recognized here solely so normal import can diagnose kind later.
    validateExportPath(name, true);
    return name;
  };
  for (let index = 0; index < count; index++) {
    fits(central, 46);
    if (central + 46 > eocd || u32(central) !== 0x02014b50) refuse('zip', 'Invalid ZIP central header.');
    const version = u16(central + 6), flags = u16(central + 8), method = u16(central + 10);
    const crc = u32(central + 16), compressed = u32(central + 20), size = u32(central + 24);
    const nameLength = u16(central + 28), extraLength = u16(central + 30), commentLength = u16(central + 32);
    const attributes = u32(central + 38), offset = u32(central + 42);
    if (compressed === 0xffffffff || size === 0xffffffff || offset === 0xffffffff || version >= 45) refuse('zip64', 'ZIP64 archives are unsupported.');
    if (version !== 10 && version !== 20) refuse('zip', 'Unsupported ZIP extraction version.');
    if (flags & 0x2041) refuse('encryption', 'Encrypted ZIP archives are unsupported.');
    if (flags & ~0x080e || (method === 0 && (flags & 6))) refuse('encoding', 'Unsupported ZIP flags or filename encoding.');
    if (method !== 0 && method !== 8) refuse('compression', 'Only STORE and DEFLATE ZIP entries are supported.');
    // No override/Unicode/ZIP64 extra field can change the authoritative raw names or sizes.
    if (extraLength) refuse('zip-extra', 'ZIP extra fields are unsupported in format-1 imports.');
    const mode = (attributes >>> 16) & 0xf000;
    if (mode === 0xa000) refuse('symlink', 'ZIP symbolic links are unsupported.');
    if ((mode && mode !== 0x8000) || (attributes & 0x10) || u16(central + 34)) refuse('zip', 'ZIP entries must be ordinary files on one disk.');
    const cap = index === 0 ? EXPORT_LIMITS.manifest : EXPORT_LIMITS.payload;
    if (size > cap) refuse(index === 0 ? 'manifest-limit' : 'payload-limit', index === 0 ? 'Import manifest exceeds 4 MiB.' : 'Import payload exceeds 16 MiB.');
    total += size;
    if (total > EXPORT_LIMITS.total) refuse('total-limit', 'Import exceeds 256 MiB uncompressed including manifest.');
    const nextCentral = central + 46 + nameLength + extraLength + commentLength;
    if (nextCentral > eocd) refuse('zip', 'ZIP central entry exceeds its directory.');
    const path = rawName(central + 46, nameLength);
    if ((index === 0 && path !== 'manifest.json') || (index > 0 && (path === 'manifest.json' || (index > 1 && path <= entries[index - 1].path)))) {
      refuse('membership', 'ZIP requires manifest first and unique ASCII-sorted payload paths.');
    }
    if (offset !== local) refuse('zip', 'ZIP local entries overlap, have gaps, or disagree with directory order.');
    fits(local, 30);
    if (local + 30 > directory || u32(local) !== 0x04034b50) refuse('zip', 'ZIP local header is missing.');
    const localNameLength = u16(local + 26), localExtra = u16(local + 28);
    if (localExtra) refuse('zip-extra', 'ZIP extra fields are unsupported in format-1 imports.');
    if (u16(local + 4) !== version || u16(local + 6) !== flags || u16(local + 8) !== method ||
      u32(local + 10) !== u32(central + 12) || localNameLength !== nameLength || rawName(local + 30, localNameLength) !== path) {
      refuse('zip', 'ZIP local and central headers disagree.');
    }
    const localCrc = u32(local + 14), localCompressed = u32(local + 18), localSize = u32(local + 22);
    if (flags & 8) {
      if ((localCrc !== 0 && localCrc !== crc) || (localCompressed !== 0 && localCompressed !== compressed) || (localSize !== 0 && localSize !== size)) {
        refuse('zip', 'ZIP streaming local sizes or CRC disagree with directory.');
      }
    } else if (localCrc !== crc || localCompressed !== compressed || localSize !== size) refuse('zip', 'ZIP local sizes or CRC disagree with directory.');
    const start = local + 30 + localNameLength, end = start + compressed;
    if (end > directory || (method === 0 && compressed !== size)) refuse('zip', 'ZIP payload span or STORE sizes are inconsistent.');
    local = end;
    if (flags & 8) {
      const signed = u32(local) === 0x08074b50;
      const descriptor = local + (signed ? 4 : 0);
      if (descriptor + 12 > directory || u32(descriptor) !== crc || u32(descriptor + 4) !== compressed || u32(descriptor + 8) !== size) {
        refuse('zip', 'ZIP data descriptor disagrees with directory.');
      }
      local = descriptor + 12;
    }
    entries.push({ path, method, bytes: size, crc, start, end });
    central = nextCentral;
  }
  if (central !== eocd || local !== directory) refuse('zip', 'ZIP contains unlisted entries or trailing directory data.');
  return entries;
};

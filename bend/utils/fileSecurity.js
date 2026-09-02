const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const EICAR_MARKER = "EICAR-STANDARD-ANTIVIRUS-TEST-FILE";

function startsWith(buffer, bytes) {
  return bytes.every((value, index) => buffer[index] === value);
}

function ascii(buffer, start, length) {
  return buffer.subarray(start, start + length).toString("ascii");
}

function validImage(buffer, mime) {
  if (mime === "image/jpeg") return startsWith(buffer, [0xff, 0xd8, 0xff]);
  if (mime === "image/png") return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mime === "image/gif") return ascii(buffer, 0, 6) === "GIF87a" || ascii(buffer, 0, 6) === "GIF89a";
  if (mime === "image/webp") return ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 4) === "WEBP";
  return false;
}

function validSupportFile(buffer, file) {
  if (file.mimetype.startsWith("image/")) return validImage(buffer, file.mimetype);
  if (file.mimetype === "application/pdf") return ascii(buffer, 0, 5) === "%PDF-";
  if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]);
  }
  if (file.mimetype === "text/plain") return !buffer.includes(0) && !startsWith(buffer, [0x4d, 0x5a]);
  return false;
}

function validFont(buffer, file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ext === ".woff") return ascii(buffer, 0, 4) === "wOFF";
  if (ext === ".woff2") return ascii(buffer, 0, 4) === "wOF2";
  if (ext === ".otf") return ascii(buffer, 0, 4) === "OTTO";
  if (ext === ".ttf") return startsWith(buffer, [0x00, 0x01, 0x00, 0x00]) || ascii(buffer, 0, 4) === "true";
  return false;
}

function hasVariableFontTable(buffer) {
  const signature = ascii(buffer, 0, 4);
  const isSfnt = signature === "OTTO" || signature === "true" || startsWith(buffer, [0x00, 0x01, 0x00, 0x00]);
  if (isSfnt) {
    const tableCount = buffer.length >= 6 ? buffer.readUInt16BE(4) : 0;
    for (let index = 0; index < tableCount; index += 1) {
      const offset = 12 + (index * 16);
      if (ascii(buffer, offset, 4) === "fvar") return true;
    }
    return false;
  }

  if (signature === "wOFF") {
    const tableCount = buffer.length >= 14 ? buffer.readUInt16BE(12) : 0;
    for (let index = 0; index < tableCount; index += 1) {
      const offset = 44 + (index * 20);
      if (ascii(buffer, offset, 4) === "fvar") return true;
    }
  }
  return false;
}

async function detectVariableFont(file) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (extension === ".woff2") return false;
  try {
    const buffer = await fs.promises.readFile(file.path);
    return hasVariableFontTable(buffer);
  } catch (_error) {
    return false;
  }
}

async function removeFiles(files) {
  await Promise.all(files.map((file) => fs.promises.unlink(file.path).catch(() => {})));
}

async function validateUploadedFiles(files, kind) {
  const list = (Array.isArray(files) ? files : [files]).filter(Boolean);
  for (const file of list) {
    const handle = await fs.promises.open(file.path, "r");
    const buffer = Buffer.alloc(32);
    try {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      const header = buffer.subarray(0, bytesRead);
      const valid = kind === "image" ? validImage(header, file.mimetype)
        : kind === "font" ? validFont(header, file)
          : validSupportFile(header, file);
      if (!valid) {
        await removeFiles(list);
        return false;
      }
    } finally {
      await handle.close();
    }
  }
  return true;
}

async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

async function containsEicarMarker(filePath) {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(128 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString("latin1").includes(EICAR_MARKER);
  } finally {
    await handle.close();
  }
}

async function scanFileForMalware(filePath, options = {}) {
  if (await containsEicarMarker(filePath)) return { clean: false, scanner: "builtin-eicar", detail: "malware test signature detected" };
  const mode = String(options.mode || process.env.MALWARE_SCANNER_MODE || "disabled").toLowerCase();
  if (mode === "disabled") {
    return process.env.NODE_ENV === "production"
      ? { clean: false, unavailable: true, scanner: "disabled", detail: "production malware scanner is not configured" }
      : { clean: true, scanner: "development-bypass", detail: "scanner disabled outside production" };
  }
  if (!new Set(["clamav", "clamscan", "clamdscan"]).has(mode)) {
    return { clean: false, unavailable: true, scanner: mode.slice(0, 80), detail: "unsupported malware scanner mode" };
  }
  const executable = mode === "clamdscan" ? "clamdscan" : "clamscan";
  try {
    await (options.executor || execFileAsync)(executable, ["--no-summary", "--infected", path.resolve(filePath)], {
      timeout: Math.min(120000, Math.max(1000, Number(process.env.MALWARE_SCAN_TIMEOUT_MS) || 30000)),
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    return { clean: true, scanner: executable, detail: "clean" };
  } catch (error) {
    if (Number(error?.code) === 1) return { clean: false, scanner: executable, detail: "malware detected" };
    return { clean: false, unavailable: true, scanner: executable, detail: String(error?.code || "scanner_error").slice(0, 120) };
  }
}

async function scanUploadedFiles(files, options = {}) {
  const list = (Array.isArray(files) ? files : [files]).filter(Boolean);
  const results = [];
  for (const file of list) {
    const result = await scanFileForMalware(file.path, options);
    results.push({ file, ...result, sha256: await sha256File(file.path) });
    if (!result.clean) {
      await removeFiles(list);
      return { clean: false, unavailable: Boolean(result.unavailable), results };
    }
  }
  return { clean: true, results };
}

module.exports = { containsEicarMarker, detectVariableFont, scanFileForMalware, scanUploadedFiles, sha256File, validFont, validImage, validSupportFile, validateUploadedFiles };

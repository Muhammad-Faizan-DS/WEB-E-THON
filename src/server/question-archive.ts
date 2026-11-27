import { fromBufferPromise, type ZipFile } from "yauzl";
import type { z } from "zod";
import type { questionImport } from "@/lib/contracts/operations";
import { ApiError, fail } from "./errors";
import { previewQuestions } from "./imports";

export const maxArchiveBytes = 2_000_000;
const maxEntryBytes = 600_000;
const maxFiles = 30;
const formats: Record<string, z.infer<typeof questionImport>["format"]> = {
  csv: "csv", json: "json", xml: "moodle-xml", gift: "gift", txt: "text",
};

export async function previewArchive(buffer: Buffer) {
  const valid: Array<ReturnType<typeof previewQuestions>["valid"][number] & { source: string }> = [];
  const errors: Array<{ row: number; source: string; message: string }> = [];
  let archive: ZipFile | undefined;
  let decodedBytes = 0;
  let seen = 0;
  try {
    archive = await fromBufferPromise(buffer, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true });
    if (archive.entryCount > maxFiles) fail(400, "IMPORT_LIMIT", "Include at most 30 entries in the ZIP archive.");
    for await (const entry of archive.eachEntry()) {
      const source = entry.fileName;
      if (source.endsWith("/") || source.startsWith("__MACOSX/") || source.split("/").at(-1)?.startsWith(".")) continue;
      const format = formats[source.split(".").at(-1)?.toLowerCase() ?? ""];
      if (!format) {
        errors.push({ row: 0, source, message: "Supported entries are CSV, JSON, Moodle XML, GIFT, and TXT." });
        continue;
      }
      if (entry.uncompressedSize > maxEntryBytes || decodedBytes + entry.uncompressedSize > maxArchiveBytes) {
        fail(400, "IMPORT_LIMIT", "Use files under 600 KB and keep the expanded question files under 2 MB.");
      }
      const pieces: Buffer[] = [];
      const stream = await archive.openReadStreamPromise(entry);
      for await (const chunk of stream) {
        const part = Buffer.from(chunk);
        decodedBytes += part.byteLength;
        if (decodedBytes > maxArchiveBytes) fail(400, "IMPORT_LIMIT", "Expanded question files exceed 2 MB.");
        pieces.push(part);
      }
      let content: string;
      try {
        content = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(pieces));
      } catch {
        errors.push({ row: 0, source, message: "Save the question file as UTF-8." });
        continue;
      }
      try {
        const result = previewQuestions({ format, content });
        const rowNumbers = new Set([...result.valid, ...result.errors].map(({ row }) => row));
        seen += rowNumbers.size;
        if (seen > 500) fail(400, "ARCHIVE_ROW_LIMIT", "Import at most 500 question rows per archive.");
        valid.push(...result.valid.map((item) => ({ ...item, source })));
        errors.push(...result.errors.map((item) => ({ ...item, source })));
      } catch (error) {
        if (!(error instanceof ApiError) || error.code === "ARCHIVE_ROW_LIMIT") throw error;
        errors.push({ row: 0, source, message: error.message });
      }
    }
    if (!valid.length && !errors.length) fail(400, "EMPTY_ARCHIVE", "The ZIP archive contains no question files.");
    return { valid, errors };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    fail(400, "INVALID_ARCHIVE", "Use a valid ZIP with safe file names and unencrypted question files.");
  } finally { archive?.close(); }
}

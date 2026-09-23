import "fake-indexeddb/auto";
import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import { webcrypto } from "node:crypto";

if (typeof globalThis.crypto?.randomUUID !== "function") {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}

// happy-dom's Blob cannot be structured-cloned, so blobs stored in fake-indexeddb would lose their
// methods. Node's Blob/File survive structuredClone like real browser blobs do.
Object.defineProperty(globalThis, "Blob", { value: NodeBlob, configurable: true, writable: true });
Object.defineProperty(globalThis, "File", { value: NodeFile, configurable: true, writable: true });

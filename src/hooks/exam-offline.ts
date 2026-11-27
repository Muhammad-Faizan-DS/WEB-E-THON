import type { AnswerResponse } from "@/lib/contracts/core";

export type Change = { qid: string; response: AnswerResponse; seq: number };
type Draft = Change & { key: string; scope: string };

let connection: Promise<IDBDatabase> | undefined;
function database() {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("secureexam-answers-v1");
    request.onupgradeneeded = () => {
      request.result.createObjectStore("answers", { keyPath: "key" }).createIndex("scope", "scope");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return connection;
}

function complete(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function readDrafts(scope: string): Promise<Draft[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction("answers").objectStore("answers").index("scope").getAll(scope);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putDraft(scope: string, change: Change) {
  const db = await database();
  const tx = db.transaction("answers", "readwrite");
  tx.objectStore("answers").put({ ...change, scope, key: scope + "/" + change.qid });
  await complete(tx);
}

export async function clearAcknowledged(scope: string, changes: Array<{ qid: string; seq: number }>) {
  const db = await database();
  const tx = db.transaction("answers", "readwrite");
  const store = tx.objectStore("answers");
  for (const { qid, seq } of changes) {
    const key = scope + "/" + qid;
    const current = store.get(key);
    current.onsuccess = () => { if (current.result?.seq === seq) store.delete(key); };
  }
  await complete(tx);
}

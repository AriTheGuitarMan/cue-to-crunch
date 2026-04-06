const DB_NAME = "toneforge_guest_audio";
const STORE_NAME = "files";
const DB_VERSION = 1;

const objectUrlCache = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open guest audio DB"));
  });
}

function encodeFileName(name: string) {
  return encodeURIComponent(name.replace(/[\\/]/g, "_"));
}

function decodeFileName(name: string | null) {
  if (!name) return "audio.wav";
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

export function isGuestAudioRef(value: string | null | undefined) {
  return !!value && value.startsWith("guest-audio://");
}

export function parseGuestAudioRef(ref: string) {
  if (!isGuestAudioRef(ref)) return null;
  const withoutScheme = ref.replace("guest-audio://", "");
  const [id, query] = withoutScheme.split("?");
  const params = new URLSearchParams(query ?? "");
  return {
    id,
    fileName: decodeFileName(params.get("name")),
    mimeType: decodeURIComponent(params.get("mime") || "audio/wav"),
  };
}

export function getGuestAudioDisplayName(value: string) {
  const parsed = parseGuestAudioRef(value);
  if (!parsed) return null;
  return parsed.fileName;
}

export async function saveGuestAudioBlob(blob: Blob, fileName: string) {
  const db = await openDb();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to write guest audio blob"));
  });
  const safeName = encodeFileName(fileName || "audio.wav");
  const safeMime = encodeURIComponent(blob.type || "audio/wav");
  return `guest-audio://${id}?name=${safeName}&mime=${safeMime}`;
}

export async function loadGuestAudioBlob(ref: string) {
  const parsed = parseGuestAudioRef(ref);
  if (!parsed) return null;
  const db = await openDb();

  return new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(parsed.id);
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Failed to read guest audio blob"));
  });
}

export async function resolveGuestAudioSrc(ref: string) {
  if (!isGuestAudioRef(ref)) return ref;
  const cached = objectUrlCache.get(ref);
  if (cached) return cached;
  const blob = await loadGuestAudioBlob(ref);
  if (!blob) return null;
  const src = URL.createObjectURL(blob);
  objectUrlCache.set(ref, src);
  return src;
}

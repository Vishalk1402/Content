const DB_NAME = "qa-video-generator";
const DB_VERSION = 1;
const STORE_NAME = "templates";
export const MAX_TEMPLATES = 3;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("slot", "slot", { unique: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open template storage."));
  });
}

export async function getSavedTemplates() {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => {
      resolve(
        request.result
          .sort((a, b) => a.slot - b.slot)
          .map((template) => ({
            ...template,
            file: new File([template.blob], template.name, { type: template.type })
          }))
      );
    };

    request.onerror = () => reject(request.error || new Error("Could not load saved templates."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

export async function saveTemplate(file) {
  if (!file) throw new Error("No template selected.");

  const existing = await getSavedTemplates();

  if (existing.length >= MAX_TEMPLATES) {
    throw new Error("You can save a maximum of 3 templates.");
  }

  const usedSlots = new Set(existing.map((template) => template.slot));
  let slot = 1;
  while (usedSlots.has(slot)) slot += 1;

  const template = {
    id: crypto.randomUUID(),
    slot,
    name: file.name,
    type: file.type,
    size: file.size,
    blob: new Blob([file], { type: file.type }),
    createdAt: Date.now()
  };

  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).add(template);

    request.onsuccess = () => resolve({ ...template, file });
    request.onerror = () => reject(request.error || new Error("Could not save template."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

export async function deleteTemplate(id) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Could not delete template."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

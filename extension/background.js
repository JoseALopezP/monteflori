// extension/background.js
// Service Worker de la extensión Monteflori
// - Mensajería interna (popup ↔ content script): scraping bajo demanda.
// - Mensajería externa (dashboard ↔ extensión) vía externally_connectable:
//   ping, último resultado de sincronización, limpieza.

const STORAGE_KEY = "scrapeData";

// ── Mensajería interna (popup, mismo contexto de extensión) ─

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SGAI_REQUEST_SCRAPE") {
    manejarRequestScrape(sendResponse);
    return true; // canal async abierto
  }
});

async function manejarRequestScrape(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      sendResponse({ ok: false, error: "No hay pestaña activa" });
      return;
    }
    if (!tab.url?.includes(".edu")) {
      sendResponse({ ok: false, error: "Navegá al portal de tu universidad primero" });
      return;
    }

    const respuesta = await chrome.tabs.sendMessage(tab.id, { type: "SGAI_SCRAPE_GUARANI" });

    if (!respuesta?.ok) {
      sendResponse({ ok: false, error: respuesta?.error ?? "Error desconocido al sincronizar" });
      return;
    }

    await chrome.storage.local.set({
      [STORAGE_KEY]: { ...respuesta.datos, sincronizadoEn: new Date().toISOString() },
    });

    sendResponse({ ok: true, datos: respuesta.datos });
  } catch (err) {
    sendResponse({ ok: false, error: String(err?.message ?? err) });
  }
}

// ── Mensajería externa (dashboard de Monteflori) ─────────────

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === "SGAI_PING") {
    sendResponse({ installed: true, version: chrome.runtime.getManifest().version });
    return true;
  }

  if (message.type === "SGAI_GET_LAST_SYNC") {
    chrome.storage.local.get(STORAGE_KEY, (res) => {
      sendResponse({ ok: true, datos: res[STORAGE_KEY] ?? null });
    });
    return true;
  }

  if (message.type === "SGAI_CLEAR_LAST_SYNC") {
    chrome.storage.local.remove(STORAGE_KEY, () => sendResponse({ ok: true }));
    return true;
  }

  return false;
});

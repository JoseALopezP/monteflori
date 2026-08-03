// extension/popup.js
// Lógica del popup de la extensión Monteflori

const APP_URL = "http://localhost:3000"; // Cambiar en producción

const btnSync = document.getElementById("btn-sync");
const btnOpen = document.getElementById("btn-open");
const msg = document.getElementById("msg");
const dotPortal = document.getElementById("dot-portal");
const dotApp = document.getElementById("dot-app");
const txtPortal = document.getElementById("txt-portal");
const txtApp = document.getElementById("txt-app");

// ── Verificar pestaña activa ───────────────────────────────

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  const url = tab?.url ?? "";

  if (url.includes(".edu")) {
    dotPortal.className = "dot ok";
    txtPortal.textContent = new URL(url).hostname;
    txtPortal.style.color = "#84a98c";
    btnSync.disabled = false;
    msg.textContent = "Portal universitario detectado. ¡Listo para sincronizar!";
    msg.className = "ok";
  } else if (url.includes(APP_URL) || url.includes("monteflori")) {
    dotPortal.className = "dot warn";
    txtPortal.textContent = "Ir al portal universitario";
    msg.textContent = "Navegá al portal de tu universidad para sincronizar.";
    dotApp.className = "dot ok";
    txtApp.textContent = "Conectado";
    txtApp.style.color = "#84a98c";
  } else {
    dotPortal.className = "dot error";
    txtPortal.textContent = "No detectado";
    txtPortal.style.color = "#e07a5f";
    msg.textContent = "Abrí el portal de tu universidad en una pestaña.";
  }
});

// ── Botón: Sincronizar ─────────────────────────────────────

btnSync.addEventListener("click", async () => {
  btnSync.disabled = true;
  btnSync.textContent = "⏳ Sincronizando...";
  msg.textContent = "Recorriendo tus carreras y materias — puede tardar uno o dos minutos, no cierres esta ventana.";
  msg.className = "";

  try {
    // Enviar mensaje al service worker para ejecutar el scraping
    const response = await chrome.runtime.sendMessage({ type: "SGAI_REQUEST_SCRAPE" });

    if (response?.ok && response.datos) {
      const totalMaterias = (response.datos.carreras ?? []).reduce((acc, c) => acc + c.materias.length, 0);
      const totalCarreras = (response.datos.carreras ?? []).length;
      msg.textContent = `✓ ${totalMaterias} materias en ${totalCarreras} carrera${totalCarreras !== 1 ? "s" : ""}. Abriendo Monteflori...`;
      msg.className = "ok";

      // El background ya guardó los datos en chrome.storage.local.
      // El dashboard los pide directamente vía mensajería externa (externally_connectable).
      chrome.tabs.create({ url: `${APP_URL}/materias/importar?sync=1` });
    } else {
      msg.textContent = response?.error ?? "Error al sincronizar. Intentá de nuevo.";
      msg.className = "error";
    }
  } catch (err) {
    msg.textContent = "Error de comunicación con la extensión.";
    msg.className = "error";
  } finally {
    btnSync.disabled = false;
    btnSync.textContent = "🔄 Sincronizar ahora";
  }
});

// ── Botón: Abrir Monteflori ────────────────────────────────

btnOpen.addEventListener("click", () => {
  chrome.tabs.create({ url: APP_URL });
});

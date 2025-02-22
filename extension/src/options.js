function saveSettings(e) {
  e.preventDefault();
  browser.storage.sync.set({
    apiKey: document.querySelector("#api-key").value,
    apiUrl: document.querySelector("#api-url").value,
  });
}

async function restore() {
  const { apiKey, apiUrl } = await browser.storage.sync.get(["apiKey", "apiUrl"]);
  if (apiKey !== undefined) {
    document.querySelector("#api-key").value = apiKey;
  }

  if (apiUrl !== undefined) {
    document.querySelector("#api-url").value = apiUrl;
  }
}

document.addEventListener("DOMContentLoaded", restore);
document.querySelector("form").addEventListener("submit", saveSettings);

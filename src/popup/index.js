import { loadApiKey, storeApiKey } from "../libs/apiKeysStore.js";

onLoad(main);

async function main() {
  const input = document.querySelector("#input-apiKey");
  const btnSave = document.querySelector("#btn-save");
  const btnGenerate = document.querySelector("#btn-generate");

  let prevApiKey = await loadApiKey();
  input.value = prevApiKey;
  updateSaveButton(prevApiKey);

  function updateSaveButton(apiKey) {
    const updated = (prevApiKey !== apiKey);  
    btnSave.disabled = !updated;
  }
  input.addEventListener("input", async (ev) => {
    updateSaveButton(ev.target.value);
  });
  btnSave.addEventListener("click", async (ev) => {
    const apiKey = input.value;
    await storeApiKey(apiKey);
    prevApiKey = apiKey;
    updateSaveButton(apiKey);
  });
  btnGenerate.addEventListener("click", async (ev) => {
    const apiKey = Math.random().toString(36).slice(2);
    input.value = apiKey;
    updateSaveButton(apiKey);
  });  
}

async function onLoad(action) {
  if (document.loaded) {
    return Promise.resolve().then(action);
  } else {
    return new Promise((resolve, reject) => {
      document.addEventListener("DOMContentLoaded", async (ev) => {
        try {
          resolve(await action());
        } catch (e) {
          reject(e);
        }
      });
    });
  }
}

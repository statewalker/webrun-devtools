import { loadSecret, storeSecret } from "../libs/secretsStore.js";

onLoad(main);

async function main() {
  const input = document.querySelector("#input-secret");
  const btnSave = document.querySelector("#btn-save");
  const btnGenerate = document.querySelector("#btn-generate");

  let prevSecret = await loadSecret();
  input.value = prevSecret;
  updateSaveButton(prevSecret);

  function updateSaveButton(secret) {
    const updated = (prevSecret !== secret);  
    btnSave.disabled = !updated;
  }
  input.addEventListener("input", async (ev) => {
    updateSaveButton(ev.target.value);
  });
  btnSave.addEventListener("click", async (ev) => {
    const secret = input.value;
    await storeSecret(secret);
    prevSecret = secret;
    updateSaveButton(secret);
  });
  btnGenerate.addEventListener("click", async (ev) => {
    const secret = Math.random().toString(36).slice(2);
    input.value = secret;
    updateSaveButton(secret);
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

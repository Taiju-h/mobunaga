"use strict";
const folderForm = document.getElementById("folder-upload");
folderForm?.addEventListener("submit", async event => {
  event.preventDefault();
  const status = document.getElementById("upload-progress");
  const files = [...folderForm.elements.folder.files].filter(f => /\.jpe?g$/i.test(f.name));
  if (!files.length) { status.textContent = "JPG画像を含むフォルダを選んでください。"; return; }
  const button = folderForm.querySelector("button"); button.disabled = true;
  let added = 0, errors = 0;
  try {
    for (let i = 0; i < files.length; i++) {
      status.textContent = `${i + 1} / ${files.length} 枚を照合中。画面を閉じずにお待ちください。`;
      const body = new FormData();
      body.set("csrf", folderForm.elements.csrf.value);
      body.set("mode", "images"); body.set("response", "json"); body.set("image", files[i]);
      const response = await fetch(location.pathname, { method: "POST", body, credentials: "same-origin" });
      if (response.status === 403 || response.redirected) throw new Error("ログイン状態を確認して画面を読み直してください。途中までの登録は保存されています。");
      const result = await response.json();
      if (result.ok) added += result.receipt.attached_images;
      else errors++;
    }
    status.textContent = `照合完了：新しく追加 ${added} 枚、照合失敗 ${errors} 枚。登録済み画像は追加していません。`;
  } catch (error) {
    status.textContent = `送信が止まりました：${error.message}。再実行で未登録分を続けられます。`;
  } finally { button.disabled = false; }
});

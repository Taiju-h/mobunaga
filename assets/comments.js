"use strict";
(() => {
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const season = () => window.MobunagaSeason?.current?.() || Number(localStorage.getItem("mobunagaSeason") || 1) || 1;
  let current = null;
  let mountQueued = false;

  function installDetailFixes(){
    if(!document.querySelector('#mobunaga-detail-fixes')){
      const style=document.createElement('style');
      style.id='mobunaga-detail-fixes';
      style.textContent=`
        .ability-chart{max-width:270px!important;margin:4px auto 8px!important}
        .ability-radar{max-width:270px!important}
        .radar-label{font-size:16px!important;font-weight:700!important}
        .radar-number{font-size:18px!important;font-weight:700!important}
        .game-profile-header h2{font-size:28px!important}
        .general-profile{max-width:340px!important}
        .general-card-image img.general-full-image{display:block;width:100%;height:auto;max-height:520px;object-fit:contain;background:#eee8d8}
        @media(max-width:760px){.ability-chart,.ability-radar{max-width:245px!important}.radar-label{font-size:15px!important}.radar-number{font-size:17px!important}}
      `;
      document.head.appendChild(style);
    }
    document.querySelectorAll('img.general-full-image').forEach((img)=>{
      if(img.dataset.fallbackReady)return;
      img.dataset.fallbackReady='1';
      img.addEventListener('error',()=>{
        if(img.dataset.fallbackUsed)return;
        img.dataset.fallbackUsed='1';
        try{
          const name=document.querySelector('#detail-title')?.textContent?.trim();
          const general=(typeof db!=='undefined'&&db?.generals||[]).find((g)=>g.name===name);
          if(general?.portrait){
            img.src=typeof versioned==='function'?versioned(general.portrait):general.portrait;
            img.alt=`${name||'武将'}の顔画像`;
            const caption=img.closest('figure')?.querySelector('figcaption');
            if(caption)caption.textContent='武将カード画像を読み込めなかったため、顔画像を表示しています';
          }
        }catch(_){ }
      });
      if(img.complete&&img.naturalWidth===0)img.dispatchEvent(new Event('error'));
    });
  }

  async function load(type,id){
    const box=document.querySelector("#content-comments"); if(!box)return;
    const list=box.querySelector(".comments-list"), heading=box.querySelector("h3");
    try{
      const s=season();
      const r=await fetch(`/api/comments.php?entity_type=${encodeURIComponent(type)}&entity_id=${encodeURIComponent(id)}&season=${encodeURIComponent(s)}`,{credentials:"same-origin"});
      const d=await r.json();
      if(!r.ok||!d.ok)throw new Error(d.error||"読込失敗");
      list.hidden=heading.hidden=!d.comments.length;
      list.innerHTML=d.comments.length?d.comments.map(c=>`<article class="comment-row"><header><strong>${esc(c.poster_name)}</strong><time>S${esc(c.season_no)} ／ ${esc(c.created_at)}</time></header><p>${esc(c.comment_text).replace(/\n/g,"<br>")}</p></article>`).join(""):'';
    }catch(e){list.hidden=false;list.innerHTML=`<p class="comments-muted">${esc(e.message)}</p>`;}
  }
  function mount(type,id){
    const host=document.querySelector("#detail-content"); if(!host||!type||!id)return;
    current={type,id};
    document.querySelector("#entity-share")?.remove();
    document.querySelector("#content-comments")?.remove();
    installDetailFixes();
    const sec=document.createElement("section"); sec.id="content-comments"; sec.className="detail-section content-comments";
    sec.innerHTML=`<h3 hidden>コメント <small>S${season()}まで表示</small></h3><div class="comments-list" hidden></div><details><summary>コメントする</summary><form class="comment-form"><input type="hidden" name="entity_type" value="${esc(type)}"><input type="hidden" name="entity_id" value="${esc(id)}"><input type="hidden" name="season" value="${season()}"><input class="hp" name="website" tabindex="-1" autocomplete="off"><label>名前<input name="poster_name" maxlength="80" placeholder="匿名でも可"></label><label>コメント<textarea name="comment_text" maxlength="1500" required></textarea></label><button type="submit">S${season()}のコメントとして承認待ちで投稿</button><p class="comment-result" aria-live="polite"></p></form></details>`;
    host.appendChild(sec); load(type,id);
    installDetailFixes();
    sec.querySelector("form").addEventListener("submit",async(e)=>{e.preventDefault();const f=e.currentTarget,res=f.querySelector(".comment-result");f.querySelector('[name="season"]').value=String(season());res.textContent="送信中…";try{const r=await fetch("/api/comments.php",{method:"POST",body:new FormData(f),credentials:"same-origin"});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"送信失敗");res.textContent=d.message;f.querySelector("textarea").value="";}catch(err){res.textContent=err.message;}});
  }
  function queueMount(){if(!current||mountQueued)return;mountQueued=true;setTimeout(()=>{mountQueued=false;if(current)mount(current.type,current.id);},0);}
  document.addEventListener("click",(e)=>{const t=e.target.closest("[data-open]");if(!t)return;const k=t.dataset.open,id=t.dataset.id;if(!id||!['generals','formations','tactics'].includes(k))return;current={type:k==='generals'?'general':k==='formations'?'formation':'tactic',id};queueMount();});
  document.addEventListener("mobunaga:detailopen", (event) => {
    const {type,id} = event.detail;
    current={type:{generals:"general",tactics:"tactic",formations:"formation"}[type],id};
    queueMount();
  });
  document.addEventListener("mobunaga:seasonchange",()=>{if(current)queueMount();});
  const detail=document.querySelector("#detail-content");
  if(detail)new MutationObserver(()=>{installDetailFixes();if(current&&!document.querySelector("#content-comments"))queueMount();}).observe(detail,{childList:true,subtree:true});
  installDetailFixes();
})();

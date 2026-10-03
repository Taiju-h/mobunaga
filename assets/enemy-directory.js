"use strict";
(() => {
 const form=document.querySelector('[data-enemy-search]'),results=document.querySelector('[data-enemy-results]');
 if(!form||!results)return;
 const error=document.querySelector('.directory-error');let timer=null,controller=null,request=0;
 const urlFor=page=>{const url=new URL(location.href);url.search='';new FormData(form).forEach((v,k)=>{if(v)url.searchParams.set(k,String(v));});if(page>1)url.searchParams.set('page',String(page));return url;};
 async function search(page=1){
  clearTimeout(timer);controller?.abort();controller=new AbortController();const serial=++request,url=urlFor(page),fetchUrl=new URL(url);fetchUrl.searchParams.set('format','directory');results.setAttribute('aria-busy','true');
  try{
   const response=await fetch(fetchUrl,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal}),data=await response.json();
   if(serial!==request)return;
   if(!response.ok)throw Error(data.error||'敵情報を読み込めませんでした。');
   if(typeof data.html!=='string')throw Error('検索結果の形式を確認できません。');
   results.innerHTML=data.html;error.hidden=!data.warning;error.textContent=data.warning||'';history.replaceState(null,'',url);
  }catch(ex){if(serial!==request||ex.name==='AbortError')return;error.hidden=false;error.textContent=ex.message==='Failed to fetch'?'通信を確認して、もう一度検索してください。':ex.message;}
  finally{if(serial===request)results.removeAttribute('aria-busy');}
 }
 form.addEventListener('submit',event=>{event.preventDefault();search();});
 form.querySelector('input[name=q]').addEventListener('input',()=>{clearTimeout(timer);controller?.abort();++request;timer=setTimeout(()=>search(),180);});
 form.querySelector('select[name=watch]').addEventListener('change',()=>search());
 results.addEventListener('click',event=>{const link=event.target.closest('[data-directory-page]');if(!link)return;event.preventDefault();search(Number(link.dataset.directoryPage));});
})();

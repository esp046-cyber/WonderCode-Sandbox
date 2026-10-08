// Mobile drawers and overflow menu for the editor shell.
(function(){const b=document.body,$=s=>document.querySelector(s),close=()=>{b.classList.remove('dl','dr');$('#acts').classList.remove('open');$('#more').setAttribute('aria-expanded','false')};
$('#menuL').onclick=()=>{const o=b.classList.contains('dl');close();if(!o)b.classList.add('dl')};
$('#menuR').onclick=()=>{const o=b.classList.contains('dr');close();if(!o)b.classList.add('dr')};
$('#more').onclick=()=>{const o=$('#acts').classList.toggle('open');b.classList.remove('dl','dr');$('#more').setAttribute('aria-expanded',o)};
$('#scrim').onclick=close;$('#tpl').addEventListener('click',e=>{if(e.target.closest('button'))close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});})();

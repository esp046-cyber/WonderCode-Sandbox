// Registers the service worker and shows an "Update Now" banner when a new version is waiting.
(function(){
  if(!('serviceWorker'in navigator))return;
  const hadController=!!navigator.serviceWorker.controller;let reloading=false;
  const banner=reg=>{if(document.getElementById('updBanner'))return;const b=document.createElement('div');b.id='updBanner';b.setAttribute('role','status');
    b.innerHTML='<span>A new version of WonderCode is available!</span><button>Update Now</button>';
    b.querySelector('button').onclick=()=>reg.waiting?reg.waiting.postMessage('SKIP_WAITING'):location.reload();document.body.prepend(b)};
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!hadController||reloading)return;reloading=true;location.reload()});
  addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js').then(reg=>{
    if(reg.waiting&&navigator.serviceWorker.controller)banner(reg);
    reg.addEventListener('updatefound',()=>{const w=reg.installing;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)banner(reg)})});
    setInterval(()=>reg.update(),36e5)}));
})();

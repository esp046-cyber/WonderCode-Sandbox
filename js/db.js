const DB={get(k,d){try{return JSON.parse(localStorage.getItem('wcs:'+k))??d}catch{return d}},
set(k,v){try{localStorage.setItem('wcs:'+k,JSON.stringify(v))}catch(e){console.warn(e)}}};

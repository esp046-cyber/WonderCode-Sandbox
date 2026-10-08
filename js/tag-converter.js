const TagTools={
  extract(code){const s=new Set(),r=/\b(?:Me\.)?[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+\b|\b[A-Z]{2,5}_\d{2,4}\w*\b/g;let m;
    const t=code.replace(/"[^"]*"|\/\/.*|\{[^}]*\}/g,' ');while(m=r.exec(t))s.add(m[0]);return [...s]},
  toSP(code){return code.replace(/(^|[^\w."])([A-Z]{2,5}_\d{2,4}\w*(?:\.\w+)?)/g,'$1Me.$2')},
  toInTouch(code){return code.replace(/\bMe\./g,'')}
};

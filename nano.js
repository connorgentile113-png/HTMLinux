window.Nano = (() => {
  const ov = $('editor');
  const ta = $('ed-ta');
  const gut= $('ed-gutter');
  const fnEl=$('ed-fname');
  const modEl=$('ed-mod');
  const posEl=$('ed-pos');
  let file=null, orig='', mod=false, cutBuf=[], onClose=null;

  function gutUpdate() {
    const lines = ta.value.split('\n');
    gut.textContent = lines.map((_,i)=>i+1).join('\n');
    gut.scrollTop = ta.scrollTop;
  }
  function posUpdate() {
    const before = ta.value.slice(0,ta.selectionStart);
    const lines = before.split('\n');
    posEl.textContent = `Row ${lines.length}, Col ${lines[lines.length-1].length+1}`;
  }
  function setMod(v) {
    mod=v;
    modEl.textContent = v ? ' [Modified]' : '';
  }
  function doSave() {
    if (!file) { file = prompt('File Name to Write:','untitled.txt'); if(!file)return; file=VFS.norm(file,ENV.cwd); }
    VFS.writeFile(file, ta.value);
    orig=ta.value; setMod(false);
    TERM.writeln(`\x1b[1mWrote ${ta.value.split('\n').length} lines to "${file}"\x1b[0m`);
  }
  function doClose() {
    if (mod && !confirm('Save modified buffer?')) { doSave(); }
    ov.classList.remove('on');
    TERM.unlock(); TERM.updatePrompt(); TERM.focus();
    if (onClose) onClose();
  }
  function doReplace() {
    const from = prompt('Replace:'); if(!from) return;
    const to = prompt('With:','');
    const count = (ta.value.match(new RegExp(from,'g'))||[]).length;
    if (count === 0) { alert('Not found.'); return; }
    ta.value = ta.value.split(from).join(to);
    setMod(ta.value !== orig);
    gutUpdate();
  }
  return {
    open(fp, cb) {
      onClose=cb||null;
      file = fp ? VFS.norm(fp, ENV.cwd) : null;
      const c = fp ? (VFS.readFile(fp,ENV.cwd)||'') : '';
      ta.value=c; orig=c; setMod(false); cutBuf=[];
      fnEl.textContent = file || 'New Buffer';
      ov.classList.add('on');
      TERM.lock();
      gutUpdate();
      ta.focus();
      ta.setSelectionRange(0,0);
    },
    handleKey(e) {
      if (!ov.classList.contains('on')) return false;
      if (e.ctrlKey) {
        switch(e.key.toLowerCase()) {
          case 'o': e.preventDefault(); doSave(); return true;
          case 'x': e.preventDefault(); doClose(); return true;
          case 'k': {
            e.preventDefault();
            const pos=ta.selectionStart, val=ta.value;
            const ls=val.lastIndexOf('\n',pos-1)+1;
            let le=val.indexOf('\n',pos); if(le===-1)le=val.length; else le++;
            cutBuf.push(val.slice(ls,le));
            ta.value=val.slice(0,ls)+val.slice(le);
            ta.setSelectionRange(ls,ls);
            setMod(ta.value!==orig); gutUpdate(); return true;
          }
          case 'u': {
            e.preventDefault();
            if (!cutBuf.length) return true;
            const paste=cutBuf.join(''), pos=ta.selectionStart, val=ta.value;
            ta.value=val.slice(0,pos)+paste+val.slice(pos);
            ta.setSelectionRange(pos+paste.length,pos+paste.length);
            setMod(true); cutBuf=[]; gutUpdate(); return true;
          }
          case 'w': {
            e.preventDefault();
            const q=prompt('Search:'); if(!q)return true;
            const idx=ta.value.indexOf(q,ta.selectionStart+1);
            if(idx!==-1){ta.setSelectionRange(idx,idx+q.length);}
            else{const idx2=ta.value.indexOf(q); if(idx2!==-1)ta.setSelectionRange(idx2,idx2+q.length); else TERM.writeln('\x1b[1mNot found\x1b[0m');}
            ta.focus(); return true;
          }
          case '\\': e.preventDefault(); doReplace(); return true;
          case 'a': {
            e.preventDefault();
            const pos=ta.selectionStart, val=ta.value;
            const ls=val.lastIndexOf('\n',pos-1)+1;
            ta.setSelectionRange(ls,ls); return true;
          }
          case 'e': {
            e.preventDefault();
            const pos=ta.selectionStart, val=ta.value;
            let le=val.indexOf('\n',pos); if(le===-1)le=val.length;
            ta.setSelectionRange(le,le); return true;
          }
          case 'c': {
            e.preventDefault();
            posUpdate();
            return true;
          }
          case 'g': {
            e.preventDefault();
            TERM.writeln('nano: ^G=Help ^O=Write ^R=Read ^X=Exit ^K=Cut ^U=Paste ^W=Search ^\\ =Replace ^A=Home ^E=End');
            return true;
          }
          case 'r': {
            e.preventDefault();
            const fp=prompt('File to insert:'); if(!fp)return true;
            const c=VFS.readFile(fp,ENV.cwd);
            if(c===null){alert('File not found.');return true;}
            const pos=ta.selectionStart, val=ta.value;
            ta.value=val.slice(0,pos)+c+val.slice(pos);
            setMod(true); gutUpdate(); return true;
          }
          case 't': e.preventDefault(); TERM.writeln('nano: spell check not available'); return true;
        }
      }
      return false;
    },
    onInput() { setMod(ta.value!==orig); gutUpdate(); posUpdate(); },
    onScroll() { gut.scrollTop=ta.scrollTop; },
    isActive:()=>ov.classList.contains('on'),
  };
})();

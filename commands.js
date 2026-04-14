'use strict';
window.CMDS = {

  // ── Navigation ──────────────────────────────────────────────────
  cd(args) {
    const t=args[0]||ENV.v.HOME;
    let abs;
    if(t==='-'){abs=ENV.v.OLDPWD||ENV.cwd;}
    else abs=VFS.norm(t,ENV.cwd);
    const n=VFS.stat(abs);
    if(!n)return `cd: ${t}: No such file or directory`;
    if(n.t!=='d')return `cd: ${t}: Not a directory`;
    ENV.v.OLDPWD=ENV.cwd; ENV.cwd=abs; ENV.v.PWD=abs;
    return '';
  },
  pwd(args){ return ENV.cwd; },

  // ── Listing ─────────────────────────────────────────────────────
  ls(args) {
    let showAll = false, showAlmostAll = false, longFmt = false, humanReadable = false;
    let sortByTime = false, sortBySize = false, reverseSort = false, appendMarks = false;
    let recursive = false, onePerLine = false, noColor = false;
    let listPaths = [];
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('-') && !arg.startsWith('--')) {
        if (arg.includes('a')) showAll = true;
        if (arg.includes('A')) showAlmostAll = true;
        if (arg.includes('l')) longFmt = true;
        if (arg.includes('h')) humanReadable = true;
        if (arg.includes('t')) sortByTime = true;
        if (arg.includes('S')) sortBySize = true;
        if (arg.includes('r')) reverseSort = true;
        if (arg.includes('F')) appendMarks = true;
        if (arg.includes('R')) recursive = true;
        if (arg.includes('1')) onePerLine = true;
        if (arg.includes('n')) noColor = true;
      } else {
        listPaths.push(arg);
      }
    }
    
    if (listPaths.length === 0) {
      listPaths.push('.');
    }
    
    function formatColor(entry, useColor) {
      let name = entry.name;
      let suffix = '';
      if (appendMarks) {
        if (entry.t === 'd') suffix = '/';
        else if (entry.t === 'l') suffix = '@';
      }
      if (!useColor) return name + suffix;
      
      if (entry.t === 'd') return '\x1b[1;34m' + name + suffix + '\x1b[0m';
      if (entry.t === 'l') return '\x1b[1;36m' + name + suffix + '\x1b[0m';
      if (entry.m && (entry.m & 0o111)) return '\x1b[1;32m' + name + suffix + '\x1b[0m';
      return name + suffix;
    }
    
    function listDirectory(dirPath, prefix) {
      let entries = VFS.readdir(dirPath, ENV.cwd) || [];
      
      if (!showAll && !showAlmostAll) {
        entries = entries.filter(e => !e.name.startsWith('.'));
      }
      
      if (showAlmostAll && !showAll) {
        entries = entries.filter(e => e.name !== '.' && e.name !== '..');
      }
      
      if (sortByTime) {
        entries.sort((x, y) => (y.mt || 0) - (x.mt || 0));
      } else if (sortBySize) {
        entries.sort((x, y) => VFS.size(y.path) - VFS.size(x.path));
      } else {
        entries.sort((x, y) => x.name.localeCompare(y.name));
      }
      
      if (reverseSort) {
        entries.reverse();
      }
      
      let output = '';
      if (prefix) output += prefix + ':\n';
      
      if (longFmt) {
        let total = entries.reduce((sum, e) => sum + Math.ceil(VFS.size(e.path) / 512), 0);
        output += 'total ' + total + '\n';
        
        let lines = entries.map(e => {
          let perm = VFS.fmtMode(e.m || 0o644, e.t);
          let size = humanReadable ? humanSize(VFS.size(e.path)).padStart(6) : String(VFS.size(e.path)).padStart(9);
          let d = new Date(e.mt || 0);
          let mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
          let dt = mo + ' ' + String(d.getDate()).padStart(2) + ' ' + 
                   d.getHours().toString().padStart(2, '0') + ':' + 
                   d.getMinutes().toString().padStart(2, '0');
          let link = (e.t === 'l') ? ' -> ' + e.target : '';
          let colored = formatColor(e, !noColor);
          return perm + ' 1 ' + String(e.u || 1000).padEnd(8) + ' ' + String(e.g || 1000).padEnd(8) + 
                 ' ' + size + ' ' + dt + ' ' + colored + link;
        });
        output += lines.join('\n');
      } else if (onePerLine) {
        output += entries.map(e => formatColor(e, !noColor)).join('\n');
      } else {
        output += entries.map(e => formatColor(e, !noColor)).join('  ');
      }
      
      return output;
    }
    
    let results = [];
    for (let i = 0; i < listPaths.length; i++) {
      let p = listPaths[i];
      let node = VFS.stat(p, ENV.cwd);
      if (!node) {
        results.push('ls: cannot access \'' + p + '\': No such file or directory');
        continue;
      }
      
      if (node.t === 'd') {
        results.push(listDirectory(p, listPaths.length > 1 ? p : ''));
        if (recursive) {
          let dirEntries = VFS.readdir(p, ENV.cwd) || [];
          for (let j = 0; j < dirEntries.length; j++) {
            if (dirEntries[j].t === 'd') {
              results.push('\n' + listDirectory(dirEntries[j].path, dirEntries[j].path));
            }
          }
        }
      } else {
        results.push(formatColor(node, !noColor));
      }
    }
    
    return results.join('\n');
  },

  // ── File ops ────────────────────────────────────────────────────
  cat(args){
    let n=false,b=false,A2=false;
    const ps=[];
    for(const x of args){if(x==='-n')n=true;else if(x==='-b')b=true;else if(x==='-A')A2=true;else ps.push(x);}
    if(!ps.length)return 'cat: no file specified';
    return ps.map(p=>{
      const c=VFS.readFile(p,ENV.cwd);
      if(c===null)return `cat: ${p}: No such file or directory`;
      if(n||b){let ln=1;return c.split('\n').map(line=>{if(b&&!line.trim())return `       \t${line}`;return `\x1b[2m${String(ln++).padStart(6)}\x1b[0m\t${line}`;}).join('\n');}
      return A2?c.replace(/\t/g,'^I').replace(/\r/g,'$'):c;
    }).join('\n');
  },
  head(args){
    let n=10;const ps=[];
    for(let i=0;i<args.length;i++){if((args[i]==='-n'||args[i]==='--lines')&&args[i+1])n=parseInt(args[++i]);else if(/^-\d+$/.test(args[i]))n=parseInt(args[i].slice(1));else ps.push(args[i]);}
    if(!ps.length)return 'head: missing file';
    return ps.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `head: ${p}: No such file`;return(ps.length>1?`==> ${p} <==\n`:'')+c.split('\n').slice(0,n).join('\n');}).join('\n');
  },
  tail(args){
    let n=10,follow=false;const ps=[];
    for(let i=0;i<args.length;i++){if((args[i]==='-n')&&args[i+1])n=parseInt(args[++i]);else if(/^-\d+$/.test(args[i]))n=parseInt(args[i].slice(1));else if(args[i]==='-f')follow=true;else ps.push(args[i]);}
    if(!ps.length)return 'tail: missing file';
    return ps.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `tail: ${p}: No such file`;return(ps.length>1?`==> ${p} <==\n`:'')+c.split('\n').slice(-n).join('\n');}).join('\n');
  },
  tac(args){if(!args.length)return 'tac: missing file';return args.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `tac: ${p}: No such file`;return c.split('\n').reverse().join('\n');}).join('\n');},
  rev(args){if(!args.length)return 'rev: missing file';return args.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `rev: ${p}: No such file`;return c.split('\n').map(l=>[...l].reverse().join('')).join('\n');}).join('\n');},
  nl(args){if(!args.length)return 'nl: missing file';return args.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `nl: ${p}: No such file`;let n=1;return c.split('\n').map(l=>l.trim()?`${String(n++).padStart(6)}\t${l}`:l).join('\n');}).join('\n');},
  fold(args){
    let w=80;const ps=[];
    for(let i=0;i<args.length;i++){if((args[i]==='-w')&&args[i+1])w=parseInt(args[++i]);else ps.push(args[i]);}
    if(!ps.length)return 'fold: missing file';
    return ps.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `fold: ${p}: No such file`;return c.split('\n').map(l=>{const r=[];for(let i=0;i<l.length;i+=w)r.push(l.slice(i,i+w));return r.join('\n');}).join('\n');}).join('\n');
  },
  column(args){
    const ps=args.filter(a=>!a.startsWith('-'));
    if(!ps.length)return 'column: no input';
    const content=ps.map(p=>VFS.readFile(p,ENV.cwd)||'').join('\n');
    const lines=content.split('\n').filter(Boolean);
    const maxLen=Math.max(...lines.map(l=>l.length));
    const cols=Math.max(1,Math.floor(80/(maxLen+2)));
    const rows=[];
    for(let i=0;i<lines.length;i+=cols)rows.push(lines.slice(i,i+cols).map(s=>s.padEnd(maxLen+2)).join(''));
    return rows.join('\n');
  },
  touch(args){
    if(!args.length)return 'touch: missing operand';
    for(const a of args){const abs=VFS.norm(a,ENV.cwd);if(!VFS.exists(abs))VFS.writeFile(abs,'');else{const n=VFS._raw()[abs];if(n)n.mt=Date.now();VFS.save();}}
    return '';
  },
  mkdir(args){
    let p2=false;const ps=[];
    for(const a of args){if(a==='-p'||a==='--parents')p2=true;else ps.push(a);}
    if(!ps.length)return 'mkdir: missing operand';
    for(const p of ps){
      if(p2){const abs=VFS.norm(p,ENV.cwd);const parts=abs.split('/').filter(Boolean);let cur='';for(const pt of parts){cur+='/'+pt;if(!VFS.exists(cur))VFS.mkdir(cur);}}
      else if(!VFS.mkdir(p,ENV.cwd))TERM.writeln(`mkdir: cannot create directory '${p}': File exists`);
    }
    return '';
  },
  rmdir(args){if(!args.length)return 'rmdir: missing operand';for(const a of args)if(!VFS.rmdir(a,false,ENV.cwd))TERM.writeln(`rmdir: failed to remove '${a}': Directory not empty`);return '';},
  rm(args){
    let rf=false,f=false;const ps=[];
    for(const a of args){if(a==='-r'||a==='-R'||a==='--recursive')rf=true;else if(a==='-f')f=true;else if(a==='-rf'||a==='-fr'||a==='-Rf')rf=f=true;else ps.push(a);}
    if(!ps.length)return f?'':'rm: missing operand';
    for(const p of ps){
      const n=VFS.stat(p,ENV.cwd);
      if(!n){if(!f)TERM.writeln(`rm: cannot remove '${p}': No such file or directory`);continue;}
      if(n.t==='d'){if(!rf){TERM.writeln(`rm: cannot remove '${p}': Is a directory`);continue;}VFS.rmdir(p,true,ENV.cwd);}
      else VFS.unlink(VFS.norm(p,ENV.cwd));
    }
    return '';
  },
  cp(args){
    let r=false;const ps=[];
    for(const a of args){if(a==='-r'||a==='-R')r=true;else ps.push(a);}
    if(ps.length<2)return 'cp: missing destination';
    const [src,dst]=[ps[0],ps[ps.length-1]];
    const sn=VFS.stat(src,ENV.cwd);
    if(!sn)return `cp: cannot stat '${src}': No such file`;
    if(sn.t==='d'&&!r)return `cp: -r not specified; omitting directory '${src}'`;
    if(!VFS.copyFile(src,dst,ENV.cwd))return `cp: cannot copy '${src}'`;
    return '';
  },
  mv(args){
    if(args.length<2)return 'mv: missing destination';
    const [src,dst]=[args[0],args[1]];
    if(!VFS.exists(src,ENV.cwd))return `mv: cannot stat '${src}': No such file`;
    const dn=VFS.stat(dst,ENV.cwd);
    if(dn&&dn.t==='d'){VFS.rename(src,VFS.norm(src.split('/').pop(),VFS.norm(dst,ENV.cwd)),ENV.cwd);}
    else VFS.rename(src,dst,ENV.cwd);
    return '';
  },
  chmod(args){
    if(args.length<2)return 'chmod: missing operand';
    let mode=0,sym=false;
    const ms=args[0];
    if(/^[ugoa]/.test(ms)){sym=true;}
    else mode=parseInt(ms,8);
    for(const p of args.slice(1)){
      if(sym){
        const n=VFS.lstat(p,ENV.cwd);if(!n)continue;
        let m=n.m;
        const rx=/([ugoa]*)([\+\-\=])([rwx]+)/g;let match;
        while((match=rx.exec(ms))!==null){
          const[,who,op,perms]=match;
          const bits=perms.replace(/r/g,'4').replace(/w/g,'2').replace(/x/g,'1').split('').reduce((s,x)=>s+parseInt(x),0);
          const apply=(shift)=>{if(op==='+')m|=bits<<shift;else if(op==='-')m&=~(bits<<shift);else{m&=~(7<<shift);m|=bits<<shift;}};
          if(!who||who.includes('u')||who.includes('a'))apply(6);
          if(!who||who.includes('g')||who.includes('a'))apply(3);
          if(!who||who.includes('o')||who.includes('a'))apply(0);
        }
        VFS.chmod(p,m,ENV.cwd);
      } else VFS.chmod(p,mode,ENV.cwd);
    }
    return '';
  },
  chown(args){return '';},
  ln(args){
    let s=false;const ps=[];
    for(const a of args){if(a==='-s')s=true;else ps.push(a);}
    if(ps.length<2)return 'ln: missing destination';
    if(s)VFS.symlink(ps[0],ps[1],ENV.cwd);else VFS.copyFile(ps[0],ps[1],ENV.cwd);
    return '';
  },
  readlink(args){
    const p=args[0];if(!p)return 'readlink: missing operand';
    const n=VFS.lstat(p,ENV.cwd);
    if(!n)return `readlink: ${p}: No such file or directory`;
    if(n.t!=='l')return `readlink: ${p}: not a symlink`;
    return n.target;
  },
  stat(args){
    const p=args[0];if(!p)return 'stat: missing operand';
    const n=VFS.lstat(p,ENV.cwd);
    if(!n)return `stat: cannot stat '${p}': No such file or directory`;
    const sz=VFS.size(p,ENV.cwd);
    const d=new Date(n.mt||0).toString();
    return `  File: ${p}\n  Size: ${sz}\t\tBlocks: ${Math.ceil(sz/512)}\t IO Block: 4096   ${n.t==='d'?'directory':n.t==='l'?'symbolic link':'regular file'}\nDevice: 0h/0d\tInode: ${Math.abs(p.split('').reduce((a,c)=>a+c.charCodeAt(0),0))%99999}\tLinks: 1\nAccess: (${n.m?.toString(8)?.padStart(4,'0')}/${VFS.fmtMode(n.m||0o644,n.t)})\tUid: (${n.u||1000}/user)\tGid: (${n.g||1000}/user)\nModify: ${d}\nChange: ${d}`;
  },
  file(args){
    if(!args.length)return 'file: missing operand';
    return args.map(p=>{
      const n=VFS.lstat(p,ENV.cwd);
      if(!n)return `${p}: cannot open: No such file`;
      if(n.t==='d')return `${p}: directory`;
      if(n.t==='l')return `${p}: symbolic link to ${n.target}`;
      const c=VFS.readFile(p,ENV.cwd)||'';
      if(c.startsWith('#!/bin/bash')||c.startsWith('#!/bin/sh'))return `${p}: Bourne-Again shell script, ASCII text executable`;
      if(c.startsWith('#!/usr/bin/env python'))return `${p}: Python script, ASCII text executable`;
      if(c.startsWith('{')&&c.trim().endsWith('}'))return `${p}: JSON data`;
      if(c.startsWith('<?xml'))return `${p}: XML document`;
      if(c.startsWith('<!DOCTYPE html')||c.startsWith('<html'))return `${p}: HTML document`;
      if(/^[^\x00-\x08\x0b\x0c\x0e-\x1f]*$/.test(c))return `${p}: ASCII text`;
      return `${p}: binary data`;
    }).join('\n');
  },
  realpath(args){if(!args.length)return 'realpath: missing operand';return args.map(p=>VFS.norm(p,ENV.cwd)).join('\n');},
  basename(args){if(!args.length)return 'basename: missing operand';let name=args[0].split('/').pop();if(args[1]&&name.endsWith(args[1]))name=name.slice(0,-args[1].length);return name;},
  dirname(args){if(!args.length)return 'dirname: missing operand';const p=args[0].replace(/\/+$/,'');return p.includes('/')?p.slice(0,p.lastIndexOf('/'))||'/':'.';},
  mktemp(args){
    const tmpdir=ENV.v.TMPDIR||'/tmp';
    const name=args.find(a=>a.includes('XXX'))||'tmp.XXXXXX';
    const n=name.replace(/X+$/,m=>Math.random().toString(36).slice(2,2+m.length));
    const p=`${tmpdir}/${n}`;
    if(args.includes('-d'))VFS.mkdir(p);else VFS.writeFile(p,'');
    return p;
  },
  install(args){
    const files=args.filter(a=>!a.startsWith('-'));
    if(files.length<2)return 'install: missing destination';
    const dst=files[files.length-1];
    for(const f of files.slice(0,-1)){
      const content=VFS.readFile(f,ENV.cwd);
      if(content===null)return `install: cannot stat '${f}': No such file`;
      VFS.writeFile(VFS.norm(f.split('/').pop(),VFS.norm(dst,ENV.cwd)),content,ENV.cwd);
    }
    return '';
  },

  // ── Text processing ─────────────────────────────────────────────
  echo(args){
    let n=false,e2=false;const ps=[];
    for(const a of args){if(a==='-n')n=true;else if(a==='-e')e2=true;else ps.push(a);}
    let out=ps.map(p=>ENV.expand(p)).join(' ');
    if(e2)out=out.replace(/\\n/g,'\n').replace(/\\t/g,'\t').replace(/\\033\[/g,'\x1b[').replace(/\\e/g,'\x1b').replace(/\\\\/g,'\\');
    return out+(n?'':'');
  },
  printf(args){
    if(!args.length)return '';
    let fmt=args[0].replace(/\\n/g,'\n').replace(/\\t/g,'\t');
    const rest=args.slice(1);let i=0;
    return fmt.replace(/%[sd%dfox]/g,m=>{
      if(m==='%%')return '%';
      const v=rest[i++]||'';
      if(m==='%s')return v;
      if(m==='%d'||m==='%i')return String(parseInt(v)||0);
      if(m==='%f')return String(parseFloat(v)||0);
      if(m==='%o')return (parseInt(v)||0).toString(8);
      if(m==='%x')return (parseInt(v)||0).toString(16);
      return m;
    });
  },
  grep(args){
    let i2=false,v2=false,n2=false,r=false,c2=false,l=false,o=false,F2=false,E=false,w=false;
    let pat='';const ps=[];
    for(let i=0;i<args.length;i++){
      if(args[i].startsWith('-')&&!args[i].startsWith('--')){
        if(args[i].includes('i'))i2=true; if(args[i].includes('v'))v2=true;
        if(args[i].includes('n'))n2=true; if(args[i].includes('r')||args[i].includes('R'))r=true;
        if(args[i].includes('c'))c2=true; if(args[i].includes('l'))l=true;
        if(args[i].includes('o'))o=true; if(args[i].includes('F'))F2=true;
        if(args[i].includes('E'))E=true; if(args[i].includes('w'))w=true;
        if(args[i].includes('e')&&args[i+1])pat=args[++i];
      } else if(!pat)pat=args[i]; else ps.push(args[i]);
    }
    if(!pat)return 'grep: missing pattern';
    if(F2)pat=pat.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if(w)pat=`\\b${pat}\\b`;
    const flags=i2?'gi':'g';
    let re;try{re=new RegExp(pat,flags);}catch{return `grep: invalid regex: ${pat}`;}
    const search=(p,prefix='')=>{
      const content=VFS.readFile(p,ENV.cwd);
      if(content===null)return `grep: ${p}: No such file`;
      const lines=content.split('\n');
      if(c2){const n=lines.filter(x=>{const m=re.test(x);re.lastIndex=0;return v2?!m:m;}).length;return prefix?`${prefix}:${n}`:String(n);}
      if(l){const found=lines.some(x=>{const m=re.test(x);re.lastIndex=0;return v2?!m:m;});return found?p:'';}
      const results=[];
      lines.forEach((line,idx)=>{
        const match=re.test(line);re.lastIndex=0;
        if(v2?!match:match){
          let out2=prefix?`\x1b[35m${prefix}\x1b[0m:`:'';
          if(n2)out2+=`\x1b[2m${idx+1}\x1b[0m:`;
          if(o){const m2=line.match(re);if(m2)results.push(out2+'\x1b[1m'+m2[0]+'\x1b[0m');re.lastIndex=0;}
          else{out2+=line.replace(re,m2=>`\x1b[1m${m2}\x1b[0m`);re.lastIndex=0;results.push(out2);}
        }
      });
      return results.join('\n');
    };
    if(!ps.length)return 'grep: no input files';
    return ps.map(p=>{
      const node=VFS.stat(p,ENV.cwd);
      if(node&&node.t==='d'&&r){const e=VFS.readdir(p,ENV.cwd)||[];return e.filter(x=>x.t==='f').map(x=>search(x.path,x.path)).filter(Boolean).join('\n');}
      return search(p,ps.length>1?p:'');
    }).filter(Boolean).join('\n');
  },
  sed(args){
    const expr=args.find(a=>!a.startsWith('-')&&(!VFS.exists(a,ENV.cwd)||a.startsWith('s')||a.startsWith('/')||a.startsWith('d')||a.startsWith('p')||a.startsWith('q')));
    const ps=args.filter(a=>!a.startsWith('-')&&a!==expr&&VFS.exists(a,ENV.cwd));
    if(!expr)return 'sed: no expression';
    const process=(content)=>{
      const lines2=content.split('\n');
      const out2=[];
      for(let i=0;i<lines2.length;i++){
        let line=lines2[i];
        if(expr.startsWith('s')){
          const sep=expr[1];
          const parts=expr.slice(2).split(sep);
          const re2=new RegExp(parts[0],parts[2]?.includes('g')?'g':'');
          line=line.replace(re2,parts[1]||'');
          out2.push(line);
        } else if(/^\d+d$/.test(expr)){
          if(i!==parseInt(expr)-1)out2.push(line);
        } else if(expr===`${i+1}p`){out2.push(line);out2.push(line);}
        else if(expr==='p'){out2.push(line);out2.push(line);}
        else out2.push(line);
      }
      return out2.join('\n');
    };
    if(!ps.length)return 'sed: no input files';
    return ps.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `sed: ${p}: No such file`;return process(c);}).join('\n');
  },
  awk(args){
    let prog='{print}',FS2=' ';const ps=[];
    for(let i=0;i<args.length;i++){
      if(args[i]==='-F'&&args[i+1])FS2=args[++i];
      else if(args[i]==='-v'&&args[i+1]){i++;}
      else if(!args[i].startsWith('-')&&!VFS.exists(args[i],ENV.cwd)&&i===0)prog=args[i];
      else if(!args[i].startsWith('-'))ps.push(args[i]);
    }
    if(args[0]&&!args[0].startsWith('-'))prog=args[0];
    const procLine=(line)=>{
      const fields=FS2===' '?line.trim().split(/\s+/):line.split(FS2);
      const NF=fields.length;
      const get=(e)=>{
        if(e==='$0')return line;
        if(e.startsWith('$')){const n2=parseInt(e.slice(1));return fields[n2-1]??'';}
        if(e==='NF')return NF;
        return e.replace(/^["']|["']$/g,'');
      };
      const m=prog.match(/\{print\s+(.*?)\}/s);
      if(m){
        const exprs=m[1].split(',').map(x=>x.trim());
        return exprs.map(get).join(FS2===' '?' ':FS2);
      }
      return line;
    };
    if(!ps.length)return 'awk: no input';
    return ps.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `awk: ${p}: No such file`;return c.split('\n').map(procLine).join('\n');}).join('\n');
  },
  sort(args){
    let r=false,u=false,n2=false,f=false;let field=0;const ps=[];
    for(let i=0;i<args.length;i++){
      if(args[i]==='-r')r=true;else if(args[i]==='-u')u=true;
      else if(args[i]==='-n')n2=true;else if(args[i]==='-f')f=true;
      else if((args[i]==='-k'||args[i]==='--key')&&args[i+1])field=parseInt(args[++i])-1;
      else ps.push(args[i]);
    }
    if(!ps.length)return 'sort: no input';
    let lines=ps.map(p=>VFS.readFile(p,ENV.cwd)||'').join('\n').split('\n');
    if(u)lines=[...new Set(lines)];
    lines.sort((a,b)=>{let av=field?a.split(/\s+/)[field]||a:a;let bv=field?b.split(/\s+/)[field]||b:b;if(f){av=av.toLowerCase();bv=bv.toLowerCase();}return n2?parseFloat(av)-parseFloat(bv):av.localeCompare(bv);});
    if(r)lines.reverse();
    return lines.join('\n');
  },
  uniq(args){
    let c=false,d2=false,i2=false;const ps=[];
    for(const a of args){if(a==='-c')c=true;else if(a==='-d')d2=true;else if(a==='-i')i2=true;else ps.push(a);}
    if(!ps.length)return 'uniq: no input';
    const lines=ps.map(p=>VFS.readFile(p,ENV.cwd)||'').join('\n').split('\n');
    const res=[];let i=0;
    while(i<lines.length){
      let j=i;
      const key=i2?lines[i].toLowerCase():lines[i];
      while(j<lines.length&&(i2?lines[j].toLowerCase():lines[j])===key)j++;
      const n2=j-i;
      if(!d2||n2>1)res.push(c?`${String(n2).padStart(7)} ${lines[i]}`:lines[i]);
      i=j;
    }
    return res.join('\n');
  },
  wc(args){
    let L=false,w2=false,c2=false,m=false;let all=true;const ps=[];
    for(const a of args){if(a==='-l'){L=true;all=false;}else if(a==='-w'){w2=true;all=false;}else if(a==='-c'){c2=true;all=false;}else if(a==='-m'){m=true;all=false;}else ps.push(a);}
    if(!ps.length)return 'wc: no input';
    let tL=0,tW=0,tB=0;
    const rows=ps.map(p=>{
      const c=VFS.readFile(p,ENV.cwd);if(c===null)return `wc: ${p}: No such file`;
      const lc=(c.match(/\n/g)||[]).length,wc2=c.trim()?c.trim().split(/\s+/).length:0,bc=new TextEncoder().encode(c).length;
      tL+=lc;tW+=wc2;tB+=bc;
      let out='';if(all||L)out+=String(lc).padStart(8);if(all||w2)out+=String(wc2).padStart(8);if(all||c2||m)out+=String(bc).padStart(8);
      return out+' '+p;
    });
    if(ps.length>1){let t='';if(all||L)t+=String(tL).padStart(8);if(all||w2)t+=String(tW).padStart(8);if(all||c2||m)t+=String(tB).padStart(8);rows.push(t+' total');}
    return rows.join('\n');
  },
  tr(args){
    let d2=false,squeeze=false;const op=[];
    for(const a of args){if(a==='-d')d2=true;else if(a==='-s')squeeze=true;else op.push(a);}
    const expand=s=>s.replace(/(.)-(.)/g,(_,a,b)=>{let o='';for(let c=a.charCodeAt(0);c<=b.charCodeAt(0);c++)o+=String.fromCharCode(c);return o;});
    const s1=expand(op[0]||''),s2=op[1]?expand(op[1]):'';
    return args.filter(a=>!a.startsWith('-')&&VFS.exists(a,ENV.cwd)).map(p=>{
      const c=VFS.readFile(p,ENV.cwd);if(!c)return '';
      return [...c].map(ch=>{const i=s1.indexOf(ch);if(i===-1)return ch;if(d2)return '';return s2?s2[Math.min(i,s2.length-1)]:'';}).join('');
    }).join('\n');
  },
  cut(args){
    let delim='\t';let fields=null,chars=null;const ps=[];
    for(let i=0;i<args.length;i++){if((args[i]==='-d')&&args[i+1])delim=args[++i];else if((args[i]==='-f')&&args[i+1])fields=args[++i];else if((args[i]==='-c')&&args[i+1])chars=args[++i];else ps.push(args[i]);}
    const parseRange=r=>{const s=new Set();for(const p of r.split(',')){if(p.includes('-')){const[a,b]=p.split('-');for(let i=parseInt(a||1);i<=(b?parseInt(b):999);i++)s.add(i-1);}else s.add(parseInt(p)-1);}return s;};
    return ps.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(!c)return `cut: ${p}: No such file`;return c.split('\n').map(line=>{if(fields){const f=parseRange(fields);return line.split(delim).filter((_,i)=>f.has(i)).join(delim);}if(chars){const c2=parseRange(chars);return[...line].filter((_,i)=>c2.has(i)).join('');}return line;}).join('\n');}).join('\n');
  },
  paste(args){
    if(args.length<2)return 'paste: needs 2+ files';
    const cols=args.map(p=>VFS.readFile(p,ENV.cwd)||'').map(c=>c.split('\n'));
    const max=Math.max(...cols.map(c=>c.length));
    return Array.from({length:max},(_,i)=>cols.map(c=>c[i]??'').join('\t')).join('\n');
  },
  join(args){
    if(args.length<2)return 'join: needs 2 files';
    const [a,b]=[VFS.readFile(args[0],ENV.cwd)||'',VFS.readFile(args[1],ENV.cwd)||''];
    const al=a.split('\n').map(l=>l.split(' ')),bl=b.split('\n').map(l=>l.split(' '));
    const bmap=Object.fromEntries(bl.map(r=>[r[0],r.slice(1)]));
    return al.map(r=>{const k=r[0];return bmap[k]?[k,...r.slice(1),...bmap[k]].join(' '):null;}).filter(Boolean).join('\n');
  },
  comm(args){
    let s1=false,s2=false,s3=false;const ps=[];
    for(const a of args){if(a==='-1')s1=true;else if(a==='-2')s2=true;else if(a==='-3')s3=true;else ps.push(a);}
    if(ps.length<2)return 'comm: needs 2 files';
    const [a,b]=[VFS.readFile(ps[0],ENV.cwd)||'',VFS.readFile(ps[1],ENV.cwd)||''];
    const al=new Set(a.split('\n')),bl=new Set(b.split('\n'));
    const r=[];
    for(const x of al){if(!bl.has(x)&&!s1)r.push(x);}
    for(const x of bl){if(!al.has(x)&&!s2)r.push('\t'+x);}
    for(const x of al){if(bl.has(x)&&!s3)r.push('\t\t'+x);}
    return r.join('\n');
  },
  diff(args){
    let u=false;const ps=[];
    for(const a of args){if(a==='-u')u=true;else ps.push(a);}
    if(ps.length<2)return 'diff: need 2 files';
    const [a,b]=[VFS.readFile(ps[0],ENV.cwd)||'',VFS.readFile(ps[1],ENV.cwd)||''];
    const al=a.split('\n'),bl=b.split('\n');
    if(a===b)return '';
    const lines=[];
    lines.push(`--- ${ps[0]}`);lines.push(`+++ ${ps[1]}`);
    const max=Math.max(al.length,bl.length);
    lines.push(`@@ -1,${al.length} +1,${bl.length} @@`);
    for(let i=0;i<max;i++){
      if(i>=al.length)lines.push(`\x1b[1m+${bl[i]}\x1b[0m`);
      else if(i>=bl.length)lines.push(`\x1b[2m-${al[i]}\x1b[0m`);
      else if(al[i]!==bl[i]){lines.push(`\x1b[2m-${al[i]}\x1b[0m`);lines.push(`\x1b[1m+${bl[i]}\x1b[0m`);}
      else if(u)lines.push(` ${al[i]}`);
    }
    return lines.join('\n');
  },
  patch(args){
    const pf=args.find(a=>a.endsWith('.patch')||a.endsWith('.diff'));
    if(!pf)return 'patch: no patch file specified';
    const c=VFS.readFile(pf,ENV.cwd);if(!c)return 'patch: patch file not found';
    return 'patching file (simulated)';
  },
  find(args){
    let start='.',name2=null,type2=null,maxD=999,exec=null;
    for(let i=0;i<args.length;i++){
      if(args[i]==='-name'&&args[i+1])name2=args[++i];
      else if(args[i]==='-type'&&args[i+1])type2=args[++i];
      else if(args[i]==='-maxdepth'&&args[i+1])maxD=parseInt(args[++i]);
      else if(args[i]==='-exec'&&args[i+1])exec=args[++i];
      else if(!args[i].startsWith('-'))start=args[i];
    }
    const results=[];
    const walk=(p,depth=0)=>{
      if(depth>maxD)return;
      const n=VFS.lstat(p,ENV.cwd);if(!n)return;
      let match=true;
      if(name2){const nm=p.split('/').pop();const re=new RegExp('^'+name2.replace(/\*/g,'.*').replace(/\?/g,'.')+'$');match=re.test(nm);}
      if(type2){if(type2==='f'&&n.t!=='f')match=false;if(type2==='d'&&n.t!=='d')match=false;if(type2==='l'&&n.t!=='l')match=false;}
      if(match)results.push(p);
      if(n.t==='d'){const en=VFS.readdir(p,ENV.cwd)||[];for(const e of en)walk(e.path,depth+1);}
    };
    walk(VFS.norm(start,ENV.cwd));
    return results.join('\n');
  },
  locate(args){
    if(!args[0])return 'locate: missing pattern';
    const pat=args[0].toLowerCase();
    return Object.keys(VFS._raw()).filter(k=>k.toLowerCase().includes(pat)).join('\n');
  },

  // ── NEW v2: tee, xargs, time, cal, units, apropos, whatis ───────
  tee(args){
    const append=args.includes('-a');
    const files=args.filter(a=>!a.startsWith('-'));
    return (input)=>{
      if(input===undefined||input===null)return '';
      for(const f of files){if(append)VFS.appendFile(f,input,ENV.cwd);else VFS.writeFile(f,input,ENV.cwd);}
      return input;
    };
  },

  xargs(args){
    return async(input)=>{
      if(!input)return '';
      const cmd=args[0]||'echo';
      const items=input.trim().split(/\s+/);
      const results=[];
      for(const item of items){
        const r=await Shell.exec(`${cmd} ${item}`);
        if(r&&r.trim())results.push(r.trim());
      }
      return results.join('\n');
    };
  },

  async time(args){
    if(!args.length)return 'time: missing command';
    const t0=performance.now();
    const result=await Shell.exec(args.join(' '));
    const elapsed=((performance.now()-t0)/1000).toFixed(3);
    if(result&&result.trim())TERM.writeln(result);
    return `\nreal\t0m${elapsed}s\nuser\t0m0.000s\nsys\t0m0.000s`;
  },

  cal(args){
    const now=new Date();
    const month=parseInt(args[0])||now.getMonth()+1;
    const year=parseInt(args[1])||now.getFullYear();
    const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
    const header=`      ${months[month-1]} ${year}`;
    const dayHdr='Su Mo Tu We Th Fr Sa';
    const first=new Date(year,month-1,1).getDay();
    const total=new Date(year,month,0).getDate();
    const today=now.getDate();
    const isCurrentMonth=(month===now.getMonth()+1&&year===now.getFullYear());
    const rows=[''];let col=first;
    for(let i=0;i<first;i++)rows[0]+='   ';
    for(let d=1;d<=total;d++){
      const s=isCurrentMonth&&d===today?`\x1b[7m${String(d).padStart(2)}\x1b[0m`:String(d).padStart(2);
      rows[rows.length-1]+=s+' ';
      if(++col===7&&d<total){rows.push('');col=0;}
    }
    return [header,dayHdr,...rows].join('\n');
  },

  units(args){
    const table={'km->miles':0.621371,'miles->km':1.60934,'kg->lbs':2.20462,'lbs->kg':0.453592,'gb->mb':1024,'mb->gb':1/1024,'mb->kb':1024,'kb->mb':1/1024,'kb->bytes':1024,'bytes->kb':1/1024,'in->cm':2.54,'cm->in':0.393701,'ft->m':0.3048,'m->ft':3.28084,'oz->g':28.3495,'g->oz':0.035274,'gal->l':3.78541,'l->gal':0.264172,'mph->kph':1.60934,'kph->mph':0.621371,'rad->deg':57.2958,'deg->rad':0.017453};
    const v=parseFloat(args[0]);const from=args[1]?.toLowerCase();const to=args[2]?.toLowerCase();
    if(!from||!to||isNaN(v))return 'usage: units <value> <from> <to>\nExamples: units 100 km miles\n          units 72 f c\nSupported: km/miles, kg/lbs, gb/mb, kb/bytes, in/cm, ft/m, oz/g, gal/l, mph/kph, deg/rad, c/f';
    if(from==='c'&&to==='f')return `${v}°C = ${(v*9/5+32).toFixed(2)}°F`;
    if(from==='f'&&to==='c')return `${v}°F = ${((v-32)*5/9).toFixed(2)}°C`;
    const factor=table[`${from}->${to}`];
    if(!factor)return `units: unknown conversion: ${from} -> ${to}`;
    return `${v} ${from} = ${(v*factor).toFixed(4)} ${to}`;
  },

  apropos(args){
    const q=args.join(' ').toLowerCase();
    if(!q)return 'apropos: missing keyword';
    const cmds=Object.keys(CMDS).filter(k=>!k.startsWith('_'));
    const matches=cmds.filter(c=>c.includes(q));
    return matches.length?matches.map(c=>`${c} (1)            - HTMLinux v2 built-in`).join('\n'):`apropos: nothing appropriate for '${q}'`;
  },

  whatis(args){
    const descs={ls:'list directory contents',cat:'concatenate files and print',grep:'search for patterns',sed:'stream editor',awk:'pattern scanning language',find:'search for files in a hierarchy',tar:'archive utility',curl:'transfer a URL',wget:'non-interactive downloader',git:'distributed version control',nano:'simple text editor',apt:'package manager',ps:'report process status',kill:'send signal to process',df:'report disk space',du:'estimate file space usage',chmod:'change file permissions',time:'measure command execution time',cal:'display a calendar',units:'unit conversion utility',bc:'arbitrary precision calculator',ssh:'secure shell client',ping:'send ICMP echo request',tee:'read stdin, write to files and stdout',xargs:'build and execute commands from stdin',nproc:'print number of processors',watch:'execute a command repeatedly',htop:'interactive process viewer',jq:'JSON processor',openssl:'cryptographic tools',traceroute:'trace network path to host',nmap:'network port scanner',strace:'trace system calls',vmstat:'virtual memory statistics',cal:'display a calendar',script:'record terminal session'};
    return args.map(a=>descs[a]?`${a} (1)            - ${descs[a]}`:`${a}: nothing appropriate`).join('\n');
  },

  info(args){
    const topic=args.find(a=>!a.startsWith('-'));
    if(!topic)return 'info: try "info <command>"\nTopics available: bash, coreutils, grep, sed, apt';
    return `info: ${topic}: use 'man ${topic}' for documentation in HTMLinux v2.`;
  },

  nproc(){return String(navigator.hardwareConcurrency||4);},

  getconf(args){
    const vals={'PAGE_SIZE':'4096','PAGESIZE':'4096','_NPROCESSORS_ONLN':String(navigator.hardwareConcurrency||4),'LONG_BIT':'64','WORD_BIT':'32','PATH_MAX':'4096','NAME_MAX':'255','ARG_MAX':'2097152','OPEN_MAX':'1024'};
    if(!args[0])return Object.entries(vals).map(([k,v])=>`${k} = ${v}`).join('\n');
    return vals[args[0]]??`getconf: ${args[0]}: unknown variable`;
  },

  vmstat(){
    const free=Math.floor(Math.random()*512000+512000);
    return `procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----\n r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st\n 1  0      0 ${free}   1024  65536    0    0     0     0  100  200  2  1 97  0  0`;
  },

  iostat(){
    return `Linux 6.1.0-htmlinux (htmlinux)\t${new Date().toLocaleDateString()}\t_x86_64_\t(${navigator.hardwareConcurrency||4} CPU)\n\navg-cpu:  %user   %nice %system %iowait  %steal   %idle\n           2.00    0.00    1.00    0.00    0.00   97.00\n\nDevice            tps    kB_read/s    kB_wrtn/s\nvda              1.00         0.00         4.00`;
  },

  mpstat(){
    const cpus=navigator.hardwareConcurrency||4;
    const lines=[`Linux 6.1.0-htmlinux  ${new Date().toLocaleDateString()}  (${cpus} CPU)`,'','CPU  %usr   %nice  %sys  %iowait  %idle'];
    for(let i=0;i<cpus;i++)lines.push(`  ${i}   2.00   0.00   1.00     0.00   97.00`);
    return lines.join('\n');
  },

  traceroute(args){
    const host=args.find(a=>!a.startsWith('-'))||'example.com';
    return [`traceroute to ${host}, 30 hops max, 60 byte packets`,` 1  192.168.1.1 (192.168.1.1)  1.234 ms  1.100 ms  0.987 ms`,` 2  10.0.0.1 (10.0.0.1)  12.345 ms  11.987 ms  12.010 ms`,` 3  ${host} (93.184.216.34)  45.678 ms  44.321 ms  45.100 ms`].join('\n');
  },

  mtr(args){
    const host=args.find(a=>!a.startsWith('-'))||'example.com';
    return `My traceroute [v0.95] to ${host}\n Host                            Loss%   Snt   Avg  Best  Wrst\n 1. 192.168.1.1                    0.0%    10   1.3   1.1   1.6\n 2. ${host}                   0.0%    10  44.8  43.2  46.1`;
  },

  host(args){
    const name=args[0];if(!name)return 'usage: host name';
    if(name==='localhost')return 'localhost has address 127.0.0.1\nlocalhost has IPv6 address ::1';
    return `${name} has address 93.184.216.34\n${name} mail is handled by 0 .`;
  },

  whois(args){
    const name=args[0];if(!name)return 'usage: whois domain';
    return `Domain Name: ${name.toUpperCase()}\nRegistrar: Example Registrar, Inc.\nCreation Date: 1995-08-14T04:00:00Z\nExpiry Date: 2025-08-13T04:00:00Z\nName Server: NS1.EXAMPLE.COM\nDNSSEC: unsigned\n\n(whois data is simulated in HTMLinux v2)`;
  },

  nc(args){
    const host=args.find(a=>!a.startsWith('-'));const port=args[args.length-1];
    if(!host)return 'usage: nc [options] host port';
    return `nc: connect to ${host} port ${port} (tcp) failed: Connection refused\n(network is simulated in HTMLinux v2)`;
  },

  nmap(args){
    const host=args.find(a=>!a.startsWith('-'))||'localhost';
    return `Starting Nmap 7.94\nNmap scan report for ${host} (127.0.0.1)\nHost is up (0.00010s latency).\n\nPORT     STATE SERVICE\n22/tcp   open  ssh\n80/tcp   open  http\n443/tcp  open  https\n3306/tcp closed mysql\n\nNmap done: 1 IP address (1 host up) scanned in 0.12 seconds`;
  },

  iptables(args){
    if(args.includes('-L')||args.includes('--list'))
      return `Chain INPUT (policy ACCEPT)\ntarget  prot opt source    destination\nACCEPT  all  --  anywhere  anywhere state RELATED,ESTABLISHED\n\nChain FORWARD (policy DROP)\n\nChain OUTPUT (policy ACCEPT)`;
    return '';
  },

  route(args){
    return `Kernel IP routing table\nDestination  Gateway      Genmask          Flags Metric Iface\n0.0.0.0      192.168.1.1  0.0.0.0          UG    100    eth0\n192.168.1.0  0.0.0.0      255.255.255.0    U     100    eth0`;
  },

  openssl(args){
    const sub=args[0];
    if(sub==='version')return 'OpenSSL 3.1.4 24 Oct 2023';
    if(sub==='rand'&&args.includes('-hex')){
      const n=parseInt(args[args.indexOf('-hex')+1])||16;
      return [...Array(n)].map(()=>Math.floor(Math.random()*256).toString(16).padStart(2,'0')).join('');
    }
    if(sub==='base64'){
      const dec=args.includes('-d');
      const f=args.find(a=>!a.startsWith('-')&&a!=='base64');
      const txt=f?(VFS.readFile(f,ENV.cwd)||''):args[args.length-1]||'';
      try{return dec?atob(txt.trim()):btoa(txt);}catch{return 'openssl: invalid input';}
    }
    return `OpenSSL 3.1.4\nusage: openssl [version|rand|base64|...]`;
  },

  sha1sum(args){
    if(!args.length)return 'sha1sum: missing file';
    return args.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `sha1sum: ${p}: No such file`;let h=0x67452301;for(let i=0;i<c.length;i++)h=Math.imul(h^c.charCodeAt(i),0x9e3779b9)|0;return Math.abs(h).toString(16).padStart(40,'0')+'  '+p;}).join('\n');
  },
  sha512sum(args){
    if(!args.length)return 'sha512sum: missing file';
    return args.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `sha512sum: ${p}: No such file`;let h=0x6a09e667;for(let i=0;i<c.length;i++)h=Math.imul(h^c.charCodeAt(i),0xbb67ae85)|0;return Math.abs(h).toString(16).padStart(128,'0')+'  '+p;}).join('\n');
  },

  base32(args){
    const decode=args.includes('-d')||args.includes('--decode');
    const files=args.filter(a=>!a.startsWith('-'));
    const text=files.length?(VFS.readFile(files[0],ENV.cwd)||''):'';
    if(!text)return `base32: no input`;
    const CHARS='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    if(decode){
      const clean=text.replace(/[^A-Z2-7]/g,'');
      let bits='',out='';
      for(const c of clean)bits+=CHARS.indexOf(c).toString(2).padStart(5,'0');
      for(let i=0;i+8<=bits.length;i+=8)out+=String.fromCharCode(parseInt(bits.slice(i,i+8),2));
      return out;
    }
    let bits='',out='';
    for(let i=0;i<text.length;i++)bits+=text.charCodeAt(i).toString(2).padStart(8,'0');
    while(bits.length%5)bits+='0';
    for(let i=0;i<bits.length;i+=5)out+=CHARS[parseInt(bits.slice(i,i+5),2)];
    while(out.length%8)out+='=';
    return out;
  },

  strace(args){
    const cmd=args.find(a=>!a.startsWith('-'))||'cmd';
    return `execve("/usr/bin/${cmd}", ["${cmd}"], /* env */) = 0\nbrk(NULL) = 0x55a3c4c75000\narch_prctl(ARCH_SET_FS, 0x7f...) = 0\nmmap(NULL, 8192, ...) = 0x7f2b4c000000\n+++ exited with 0 +++`;
  },

  lsattr(args){
    const dir=args.find(a=>!a.startsWith('-'))||'.';
    const entries=VFS.readdir(dir,ENV.cwd)||[];
    return entries.map(e=>`-------------e-- ${e.name}`).join('\n');
  },
  chattr(){return '';},

  gpg(args){
    if(args.includes('--version'))return 'gpg (GnuPG) 2.2.40\nlibgcrypt 1.10.1';
    if(args.includes('-k')||args.includes('--list-keys'))return 'pub   rsa4096 2023-01-01 [SC]\n      ABCDEF1234567890ABCDEF1234567890ABCDEF12\nuid   [ultimate] HTMLinux User <user@htmlinux>\nsub   rsa4096 2023-01-01 [E]';
    return 'gpg: (stub) cryptographic operations are simulated in HTMLinux v2';
  },

  hash(args){
    if(!args.length||args[0]==='-r')return '';
    return args.map(a=>CMDS[a]?`${a}: /usr/bin/${a}`:`hash: ${a}: not found`).join('\n');
  },

  compgen(args){
    if(args.includes('-c'))return Object.keys(CMDS).filter(k=>!k.startsWith('_')).sort().join('\n');
    if(args.includes('-d'))return (VFS.readdir(ENV.cwd)||[]).filter(e=>e.t==='d').map(e=>e.name).join('\n');
    if(args.includes('-f'))return (VFS.readdir(ENV.cwd)||[]).map(e=>e.name).join('\n');
    return Object.keys(CMDS).filter(k=>!k.startsWith('_')).sort().join('\n');
  },

  declare(args){
    if(!args.length||args[0]==='-p')return Object.entries(ENV.v).map(([k,v])=>`declare -- ${k}="${v}"`).join('\n');
    for(const a of args.filter(x=>!x.startsWith('-'))){if(a.includes('=')){const[k,...r]=a.split('=');ENV.set(k,r.join('='));}}
    return '';
  },

  pv(args){
    return(input)=>{
      if(!input)return '';
      const bytes=new TextEncoder().encode(input).length;
      TERM.writeln(`${bytes}B 0:00:00 [${bytes}B/s] [================================>] 100%`);
      return input;
    };
  },

  script(args){
    const file=args.find(a=>!a.startsWith('-'))||'typescript';
    VFS.writeFile(file,`Script started on ${new Date().toString()}\n`,ENV.cwd);
    return `Script started, file is ${file}\n(stub: output capture is not supported in browser)`;
  },

  look(args){
    const prefix=args.find(a=>!a.startsWith('-'))?.toLowerCase();
    if(!prefix)return 'look: missing string';
    const words='about above across address after again against age agent ago agree ahead air all allow almost alone along already also always among another answer any apart apply area around array ask back bash basic before between binary boot both bring build call case change class clean clear clone close code color command commit compile config connect continue copy count create data debug define delete deploy diff directory disk docker done echo edit else enable enter error event every exec exit export false fetch file find first flag font force format from function git grep group head help here home host http import info input install interface kernel kill know last left line link list load local login loop make match memory mkdir mode mount move name node null open option output package parse path pipe print process push python read remote remove return root run script search server shell show signal size sort source split start status stop sudo tail test text then thread true type unix user variable version view watch write'.split(' ');
    return words.filter(w=>w.startsWith(prefix)).join('\n')||`(no words starting with '${prefix}')`;
  },

  pmap(args){
    const pid=args[0]||'1000';
    return `${pid}:   bash\n0000000000400000    512K r-x-- bash\n00007ffff7a00000   1824K r-x-- libc-2.31.so\n total  2336K`;
  },

  // ── System ──────────────────────────────────────────────────────
  clear(){TERM.clear();return '';},
  env(args){
    if(args[0]==='-i'){const[cmd,...rest]=args.slice(1);return cmd?Shell.exec(cmd+' '+rest.join(' ')):'';  }
    return Object.entries(ENV.v).sort().map(([k,v])=>`${k}=${v}`).join('\n');
  },
  printenv(args){
    if(args.length)return args.map(k=>ENV.v[k]??'').join('\n');
    return CMDS.env([]);
  },
  export(args){
    if(!args.length)return Object.entries(ENV.v).map(([k,v])=>`declare -x ${k}="${v}"`).join('\n');
    for(const a of args){if(a.includes('=')){const[k,...r]=a.split('=');ENV.set(k,r.join('='));}else ENV.set(a,ENV.v[a]||'');}
    return '';
  },
  unset(args){for(const a of args)ENV.unset(a);return '';},
  set(args){for(const a of args){if(a.includes('=')){const[k,...r]=a.split('=');ENV.set(k,r.join('='));}}return '';},
  which(args){return args.map(cmd=>{if(CMDS[cmd])return `/usr/bin/${cmd}`;const ps=ENV.v.PATH.split(':');for(const p of ps){const f=p+'/'+cmd;if(VFS.exists(f))return f;}return `which: no ${cmd} in (${ENV.v.PATH})`;}).join('\n');},
  type(args){return args.map(cmd=>{if(CMDS[cmd])return `${cmd} is a shell builtin`;return `${cmd}: not found`;}).join('\n');},
  whoami(){return ENV.v.USER;},

  // ── User management ─────────────────────────────────────────────
  async users(){return new Promise(r=>UserMgr.open(()=>r('')));},
  useradd(args){
    const n=args.find(a=>!a.startsWith('-'));if(!n)return'useradd: missing username';
    if(UserDB.getUser(n))return`useradd: user '${n}' already exists`;
    const hi=args.indexOf('-d'),si=args.indexOf('-s'),ci=args.indexOf('-c');
    UserDB.addUser({name:n,home:hi!==-1?args[hi+1]:`/home/${n}`,shell:si!==-1?args[si+1]:'/bin/bash',gecos:ci!==-1?args[ci+1]:''});
    return '';
  },
  userdel(args){
    const n=args.find(a=>!a.startsWith('-'));if(!n)return'userdel: missing username';
    if(!UserDB.getUser(n))return`userdel: user '${n}' does not exist`;
    UserDB.removeUser(n,args.includes('-r'));return '';
  },
  usermod(args){
    const n=args[args.length-1];const u=UserDB.getUser(n);if(!u)return`usermod: user '${n}' not found`;
    const ch={};const si=args.indexOf('-s'),di=args.indexOf('-d'),ci=args.indexOf('-c');
    if(si!==-1)ch.shell=args[si+1];if(di!==-1)ch.home=args[di+1];if(ci!==-1)ch.gecos=args[ci+1];
    if(args.includes('-L'))ch.locked=true;if(args.includes('-U'))ch.locked=false;
    UserDB.modifyUser(n,ch);return '';
  },
  groupadd(args){const n=args.find(a=>!a.startsWith('-'));if(!n)return'groupadd: missing name';UserDB.addGroup(n);return '';},
  groupdel(args){const n=args.find(a=>!a.startsWith('-'));if(!n)return'groupdel: missing name';UserDB.removeGroup(n);return '';},
  passwd(args){
    const name=args[0]||ENV.v.USER;
    const p1=prompt(`New password for ${name}:`);if(!p1)return'passwd: unchanged';
    const p2=prompt('Retype:');if(p1!==p2)return'passwd: passwords do not match';
    UserDB.modifyUser(name,{pw:p1});
    VFS.appendFile('/var/log/auth.log',`${new Date().toISOString()} htmlinux passwd: password changed for ${name}\n`);
    return 'passwd: password updated successfully';
  },
  who(){return `${ENV.v.USER}  pts/0   ${new Date().toLocaleString()}`;},
  w(){return `${ENV.v.USER.padEnd(8)} pts/0  - ${new Date().toTimeString().slice(0,5)} 0.00s bash`;},
  id(){return `uid=${ENV.uid}(${ENV.v.USER}) gid=${ENV.gid}(${ENV.v.USER}) groups=${ENV.gid}(${ENV.v.USER}),27(sudo),4(adm)`;},
  hostname(args){if(args[0]){ENV.set('HOSTNAME',args[0]);VFS.writeFile('/etc/hostname',args[0]+'\n');return '';}return ENV.v.HOSTNAME;},
  uname(args){
    const a=args.includes('-a');
    if(a)return `Linux ${ENV.v.HOSTNAME} 6.1.0-htmlinux #1 SMP PREEMPT_DYNAMIC ${new Date().toDateString()} x86_64 GNU/Linux`;
    if(args.includes('-r'))return '6.1.0-htmlinux';if(args.includes('-n'))return ENV.v.HOSTNAME;
    if(args.includes('-m'))return 'x86_64';if(args.includes('-s'))return 'Linux';
    return 'Linux';
  },
  date(args){
    const now=new Date();
    if(args[0]==='+%s')return Math.floor(now/1000).toString();
    if(args[0]?.startsWith('+'))return args[0].slice(1).replace('%Y',now.getFullYear()).replace('%m',String(now.getMonth()+1).padStart(2,'0')).replace('%d',String(now.getDate()).padStart(2,'0')).replace('%H',String(now.getHours()).padStart(2,'0')).replace('%M',String(now.getMinutes()).padStart(2,'0')).replace('%S',String(now.getSeconds()).padStart(2,'0')).replace('%A',now.toLocaleDateString('en',{weekday:'long'})).replace('%B',now.toLocaleDateString('en',{month:'long'})).replace('%T',now.toTimeString().slice(0,8));
    return now.toString();
  },
  uptime(args){
    const s=Math.floor((Date.now()-BOOT_T)/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60);
    const t=new Date().toTimeString().slice(0,5);
    if(args.includes('-p'))return `up ${h} hours, ${m} minutes`;
    if(args.includes('-s'))return new Date(BOOT_T).toISOString().replace('T',' ').slice(0,19);
    return ` ${t} up ${h}:${String(m).padStart(2,'0')},  1 user,  load average: ${(Math.random()*0.5).toFixed(2)}, ${(Math.random()*0.3).toFixed(2)}, ${(Math.random()*0.2).toFixed(2)}`;
  },
  ps(args){return `  PID TTY          TIME CMD\n    1 ?        00:00:00 init\n  200 ?        00:00:01 systemd-journald\n  800 ?        00:00:00 dbus-daemon\n 1000 pts/0    00:00:00 bash\n 1001 pts/0    00:00:00 ps`;},
  kill(args){const sig=args.find(a=>a.startsWith('-'))||'-15';const pids=args.filter(a=>/^\d+$/.test(a));return pids.length?pids.map(p=>`kill: (${p}) - Operation not permitted`).join('\n'):'kill: usage: kill [-s sig] pid...';},
  killall(args){return `killall: ${args[0]||'?'}: no process found`;},
  sleep:(args)=>new Promise(r=>setTimeout(r,parseFloat(args[0]||1)*1000)).then(()=>''),
  timeout:async(args)=>{const t=parseFloat(args[0]||10);const cmd=args.slice(1).join(' ');if(!cmd)return 'timeout: missing command';const p=Shell.exec(cmd);const tout=new Promise(r=>setTimeout(()=>r('timeout: command timed out'),t*1000));return Promise.race([p,tout]);},
  watch:async(args)=>{
    let n=2;const ps=[];
    for(let i=0;i<args.length;i++){if((args[i]==='-n')&&args[i+1])n=parseFloat(args[++i]);else ps.push(args[i]);}
    const cmd=ps.join(' ');if(!cmd)return 'watch: missing command';
    TERM.writeln(`Every ${n}s: ${cmd}  — Press Ctrl+C to stop`);
    return new Promise(res=>{
      let running=true;
      const run=async()=>{
        if(!running)return;
        const r=await Shell.exec(cmd);
        TERM.clear();TERM.writeln(`Every ${n}s: ${cmd}`);
        if(r)TERM.writeln(r);
        if(running)setTimeout(run,n*1000);
      };
      run();
      Shell._watchStop=()=>{running=false;res('');};
    });
  },
  nohup:(args)=>{if(!args.length)return 'nohup: missing command';TERM.writeln(`nohup: running '${args.join(' ')}' in background`);Shell.exec(args.join(' '));return '';},

  // ── Disk ────────────────────────────────────────────────────────
  df(args){
    const h=args.includes('-h');const used=VFS.usedSpace();const total=5*1024*1024;const free=total-used;
    const fmt=h?humanSize:(b)=>Math.round(b/1024)+'K';
    return `Filesystem      Size  Used Avail Use% Mounted on\nlocalStorage  ${String(fmt(total)).padStart(6)} ${String(fmt(used)).padStart(5)} ${String(fmt(free)).padStart(5)} ${Math.round(used/total*100)}% /\ntmpfs         ${String(fmt(512*1024)).padStart(6)} ${String(fmt(0)).padStart(5)} ${String(fmt(512*1024)).padStart(5)}   0% /tmp`;
  },
  du(args){
    let h=false;const ps=[];
    for(const a of args){if(a==='-h')h=true;else if(a==='-s'){}else ps.push(a);}
    const target=ps[0]||'.';const abs=VFS.norm(target,ENV.cwd);
    const walk=(p)=>{const entries=VFS.readdir(p)||[];return entries.reduce((s,e)=>{if(e.t==='d')return s+walk(e.path);return s+VFS.size(e.path);},0);};
    const node=VFS.stat(target,ENV.cwd);const sz=node?.t==='d'?walk(abs):VFS.size(target,ENV.cwd);
    return h?`${humanSize(sz)}\t${target}`:`${Math.ceil(sz/1024)}\t${target}`;
  },
  free(args){
    const h=args.includes('-h');const mem=performance.memory;
    const total=mem?mem.jsHeapSizeLimit:8*1024*1024*1024;
    const used=mem?mem.usedJSHeapSize:512*1024*1024;
    const free=total-used;
    const fmt=h?humanSize:(b)=>Math.round(b/1024);
    return `               total        used        free      shared  buff/cache   available\nMem:   ${String(fmt(total)).padStart(12)} ${String(fmt(used)).padStart(11)} ${String(fmt(free)).padStart(11)}          0 ${String(fmt(Math.round(total*0.1))).padStart(11)} ${String(fmt(free+Math.round(total*0.05))).padStart(11)}\nSwap:             0           0           0`;
  },
  lsblk(){return `NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS\nvda      252:0    0   20G  0 disk\n└─vda1   252:1    0   20G  0 part /\nlocalStorage 8:0  0    5M  0 disk (localStorage)\n└─ls1    8:1    0    5M  0 part /`;},
  mount(args){if(!args.length)return VFS.readFile('/proc/mounts');return `mount: ${args.join(' ')}: simulated mount`;},
  umount(args){return args.length?`umount: ${args[0]}: device busy`:'umount: missing path';},

  // ── Network ─────────────────────────────────────────────────────
  ping(args){
    const h=args.find(a=>!a.startsWith('-'))||'localhost';
    const n=args.includes('-c')?parseInt(args[args.indexOf('-c')+1])||4:4;
    const lines=[`PING ${h} (127.0.0.1) 56(84) bytes of data.`];
    for(let i=0;i<n;i++)lines.push(`64 bytes from ${h}: icmp_seq=${i+1} ttl=64 time=${(Math.random()*20+0.5).toFixed(3)} ms`);
    lines.push(`\n--- ${h} ping statistics ---\n${n} packets transmitted, ${n} received, 0% packet loss\nrtt min/avg/max/mdev = 0.5/10.0/20.0/5.0 ms`);
    return lines.join('\n');
  },
  ifconfig(){return `lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536\n    inet 127.0.0.1  netmask 255.0.0.0\n    inet6 ::1  prefixlen 128\n\nbr0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n    inet ${navigator.onLine?'10.0.0.2':'0.0.0.0'}  netmask 255.255.255.0\n    ether 52:54:00:12:34:56  txqueuelen 1000  (Ethernet)`;},
  ip(args){if(!args[0]||args[0]==='addr'||args[0]==='a')return CMDS.ifconfig([]);if(args[0]==='route'||args[0]==='r')return 'default via 10.0.0.1 dev br0 proto dhcp\n10.0.0.0/24 dev br0 proto kernel scope link src 10.0.0.2';if(args[0]==='link'||args[0]==='l')return '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536\n2: br0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500';return 'Usage: ip [addr|route|link]';},
  ss(args){return `Netid  State   Recv-Q Send-Q Local Address:Port  Peer Address:Port\ntcp    LISTEN  0      128    0.0.0.0:80         0.0.0.0:*\ntcp    ESTAB   0      0      10.0.0.2:52345     10.0.0.1:443`;},
  netstat:()=>CMDS.ss([]),
  nslookup(args){const h=args[0]||'localhost';return `Server:\t\t8.8.8.8\nAddress:\t8.8.8.8#53\n\nNon-authoritative answer:\nName:\t${h}\nAddress: 93.184.216.34`;},
  dig(args){const h=args[0]||'localhost';return `; <<>> DiG 9.18.19 <<>> ${h}\n;; ANSWER SECTION:\n${h}.\t\t300\tIN\tA\t93.184.216.34\n;; Query time: 23 msec\n;; SERVER: 8.8.8.8#53`;},
  ssh(args){const host=args.find(a=>!a.startsWith('-'));if(!host)return 'usage: ssh [user@]hostname';return `ssh: connect to host ${host} port 22: Network access is not available in browser context.\nTip: use curl or wget for HTTP requests.`;},

  // ── Crypto / Binary ─────────────────────────────────────────────
  md5sum(args){
    const hash=s=>{let h=0;for(let i=0;i<s.length;i++)h=Math.imul(31,h)+s.charCodeAt(i)|0;return Math.abs(h).toString(16).padStart(32,'0');};
    return args.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `md5sum: ${p}: No such file`;return `${hash(c)}  ${p}`;}).join('\n');
  },
  sha256sum(args){
    const hash=s=>{let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<s.length;i++){h1=Math.imul(h1^s.charCodeAt(i),2654435761);h2=Math.imul(h2^s.charCodeAt(i),1597334677);}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return((4294967296*(2097151&h2))+(h1>>>0)).toString(16).padStart(64,'0');};
    return args.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `sha256sum: ${p}: No such file`;return `${hash(c)}  ${p}`;}).join('\n');
  },
  base64(args){
    let d=false;const ps=[];
    for(const a of args){if(a==='-d'||a==='--decode')d=true;else ps.push(a);}
    return ps.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `base64: ${p}: No such file`;try{return d?atob(c.trim()):btoa(unescape(encodeURIComponent(c)));}catch{return 'base64: invalid input';}}).join('\n');
  },
  xxd(args){
    let n=256;const ps=args.filter(a=>!a.startsWith('-'));
    if(!ps[0])return 'xxd: missing filename';
    const c=VFS.readFile(ps[0],ENV.cwd);if(c===null)return `xxd: ${ps[0]}: No such file`;
    const bytes=new TextEncoder().encode(c);const lines=[];
    for(let i=0;i<Math.min(bytes.length,n);i+=16){
      const chunk=bytes.slice(i,i+16);
      const hex=[...chunk].map(b=>b.toString(16).padStart(2,'0'));
      const pad=hex.length<16?hex.concat(Array(16-hex.length).fill('  ')):hex;
      const ascii=[...chunk].map(b=>(b>=32&&b<127)?String.fromCharCode(b):'.');
      lines.push(`${i.toString(16).padStart(8,'0')}: ${pad.slice(0,8).join(' ')}  ${pad.slice(8).join(' ')}  |${ascii.join('')}|`);
    }
    if(bytes.length>n)lines.push(`... (${bytes.length-n} more bytes)`);
    return lines.join('\n');
  },
  hexdump:(args)=>CMDS.xxd(args),
  od(args){
    const ps=args.filter(a=>!a.startsWith('-'));if(!ps[0])return 'od: missing file';
    const c=VFS.readFile(ps[0],ENV.cwd);if(c===null)return `od: ${ps[0]}: No such file`;
    const bytes=new TextEncoder().encode(c);const lines=[];
    for(let i=0;i<Math.min(bytes.length,128);i+=16){const chunk=bytes.slice(i,i+16);const oct=[...chunk].map(b=>b.toString(8).padStart(3,'0')).join(' ');lines.push(`${i.toString(8).padStart(7,'0')} ${oct}`);}
    lines.push(`${Math.min(bytes.length,128).toString(8).padStart(7,'0')}`);return lines.join('\n');
  },
  strings(args){if(!args[0])return 'strings: missing file';const c=VFS.readFile(args[0],ENV.cwd);if(c===null)return `strings: ${args[0]}: No such file`;return(c.match(/[\x20-\x7e]{4,}/g)||[]).join('\n');},
  cmp(args){
    if(args.length<2)return 'cmp: missing operand';
    const [a,b]=[VFS.readFile(args[0],ENV.cwd),VFS.readFile(args[1],ENV.cwd)];
    if(a===null)return `cmp: ${args[0]}: No such file`;if(b===null)return `cmp: ${args[1]}: No such file`;
    if(a===b)return '';
    for(let i=0;i<Math.min(a.length,b.length);i++){if(a[i]!==b[i])return `${args[0]} ${args[1]} differ: byte ${i+1}, line ${a.slice(0,i).split('\n').length}`;}
    return `${args[0]} ${args[1]}: EOF on ${a.length<b.length?args[0]:args[1]}`;
  },

  // ── Math ────────────────────────────────────────────────────────
  bc(args){
    const code=args.join(' ');if(!code)return 'bc -- arbitrary precision calculator. Usage: bc <expr>';
    try{return String(Function('"use strict";return('+code+')')());}catch(e){return `(standard_in) 1: ${e.message}`;}
  },
  calc:(args)=>CMDS.bc(args),
  seq(args){
    let first=1,step=1,last;
    if(args.length===1)last=parseInt(args[0]);
    else if(args.length===2){first=parseInt(args[0]);last=parseInt(args[1]);}
    else if(args.length===3){first=parseInt(args[0]);step=parseInt(args[1]);last=parseInt(args[2]);}
    const r=[];for(let i=first;step>0?i<=last:i>=last;i+=step)r.push(i);return r.join('\n');
  },
  factor(args){
    const factorize=(n)=>{const f=[];let d=2;while(d*d<=n){while(n%d===0){f.push(d);n=Math.floor(n/d);}d++;}if(n>1)f.push(n);return f;};
    return args.map(a=>{const n=parseInt(a);return isNaN(n)?`factor: '${a}' is not a positive integer`:`${n}: ${factorize(n).join(' ')}`;}).join('\n');
  },
  numfmt(args){
    const n=parseFloat(args[0]);if(isNaN(n))return 'numfmt: missing number';
    if(args.includes('--to=si'))return humanSize(n);if(args.includes('--to=iec'))return humanSize(n);return String(n);
  },
  shuf(args){
    const n=args.indexOf('-n')!==-1?parseInt(args[args.indexOf('-n')+1]):Infinity;
    const e=args.indexOf('-e')!==-1;let lines2;
    if(e){lines2=args.filter(a=>a!=='-e'&&a!=='-n'&&!a.match(/^\d+$/));}
    else{const ps=args.filter(a=>!a.startsWith('-'));if(!ps.length)return 'shuf: no input';lines2=(VFS.readFile(ps[0],ENV.cwd)||'').split('\n');}
    for(let i=lines2.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[lines2[i],lines2[j]]=[lines2[j],lines2[i]];}
    return lines2.slice(0,n).join('\n');
  },
  repeat(args){
    const n=parseInt(args[0])||3;const cmd=args.slice(1).join(' ');if(!cmd)return 'repeat: missing command';
    const results=[];for(let i=0;i<n;i++)results.push(Shell.exec(cmd));
    return Promise.all(results).then(rs=>rs.join('\n'));
  },

  // ── Archive ──────────────────────────────────────────────────────
  tar(args){
    const flags=args.filter(a=>a.startsWith('-')).join('');
    const paths=args.filter(a=>!a.startsWith('-'));
    if(flags.includes('c')&&paths.length>=2){
      const arch={};for(const f of paths.slice(1)){const c=VFS.readFile(f,ENV.cwd);if(c!==null)arch[f]=c;}
      VFS.writeFile(paths[0],JSON.stringify(arch),ENV.cwd);
      return paths.slice(1).map(f=>`a ${f}`).join('\n');
    }
    if(flags.includes('x')&&paths[0]){
      try{const a=JSON.parse(VFS.readFile(paths[0],ENV.cwd)||'{}');for(const[n,c] of Object.entries(a))VFS.writeFile(n,c,ENV.cwd);return Object.keys(a).map(f=>`x ${f}`).join('\n');}catch{return 'tar: invalid archive';}
    }
    if(flags.includes('t')&&paths[0]){
      try{const a=JSON.parse(VFS.readFile(paths[0],ENV.cwd)||'{}');return Object.keys(a).join('\n');}catch{return 'tar: invalid archive';}
    }
    return 'tar: usage: tar [-cvxtzf] [archive] [files...]';
  },
  gzip(args){
    const ps=args.filter(a=>!a.startsWith('-'));if(!ps.length)return 'gzip: missing file';
    for(const p of ps){const c=VFS.readFile(p,ENV.cwd);if(c===null)continue;VFS.writeFile(p+'.gz',btoa(c),ENV.cwd);VFS.unlink(VFS.norm(p,ENV.cwd));}
    return '';
  },
  gunzip(args){
    const ps=args.filter(a=>!a.startsWith('-'));if(!ps.length)return 'gunzip: missing file';
    for(const p of ps){const c=VFS.readFile(p,ENV.cwd);if(c===null)continue;try{const d=atob(c);VFS.writeFile(p.replace(/\.gz$/,''),d,ENV.cwd);VFS.unlink(VFS.norm(p,ENV.cwd));}catch{TERM.writeln(`gunzip: ${p}: not in gzip format`);}}
    return '';
  },
  zip(args){
    const out=args.find(a=>a.endsWith('.zip'));const files=args.filter(a=>!a.startsWith('-')&&a!==out);
    if(!out)return 'zip: missing output filename';
    const arch={};for(const f of files){const c=VFS.readFile(f,ENV.cwd);if(c!==null)arch[f]=btoa(unescape(encodeURIComponent(c)));}
    VFS.writeFile(out,JSON.stringify(arch),ENV.cwd);
    return `  adding: ${files.join(', ')} (stored 0%)`;
  },
  unzip(args){
    const f=args.find(a=>a.endsWith('.zip'));if(!f)return 'unzip: missing file';
    try{const a=JSON.parse(VFS.readFile(f,ENV.cwd)||'{}');for(const[n,d] of Object.entries(a))VFS.writeFile(n,decodeURIComponent(escape(atob(d))),ENV.cwd);return `Archive: ${f}\n  inflating: ${Object.keys(a).join('\n  inflating: ')}`;}catch{return 'unzip: invalid archive';}
  },
  split(args){
    let lines2=100;const ps=[];
    for(let i=0;i<args.length;i++){if((args[i]==='-l')&&args[i+1])lines2=parseInt(args[++i]);else ps.push(args[i]);}
    if(!ps[0])return 'split: missing file';
    const content=VFS.readFile(ps[0],ENV.cwd);if(!content)return `split: ${ps[0]}: No such file`;
    const prefix=ps[1]||'x';const all=content.split('\n');
    for(let i=0;i<all.length;i+=lines2){const sfx=String.fromCharCode(97+Math.floor(i/lines2/26))+(String.fromCharCode(97+Math.floor(i/lines2)%26));VFS.writeFile(prefix+sfx,all.slice(i,i+lines2).join('\n'),ENV.cwd);}
    return '';
  },

  // ── Package manager ──────────────────────────────────────────────
  async apt(args,shell){
    const sub=args[0];
    if(!sub)return 'Usage: apt [update|install|remove|purge|reinstall|list|search|show|upgrade|full-upgrade|autoremove|depends|rdepends|policy|clean|autoclean|download|source|changelog|mark|history|stats]';
    if(sub==='update')return await PKG.update(shell||TERM);
    if(sub==='install'&&args[1])return await PKG.install(args.slice(1),shell||TERM);
    if(sub==='reinstall'&&args[1])return await PKG.reinstall(args.slice(1),shell||TERM);
    if(sub==='remove'||sub==='purge')return PKG.remove(args[1],sub==='purge');
    if(sub==='autoremove')return PKG.autoremove(shell||TERM);
    if(sub==='list')return PKG.list(args.slice(1));
    if(sub==='search')return PKG.search(args.slice(1).join(' '));
    if(sub==='show')return PKG.show(args[1]);
    if(sub==='upgrade'){await PKG.update(shell||TERM);return PKG.upgradeAll(shell||TERM,false);}
    if(sub==='full-upgrade'||sub==='dist-upgrade'){await PKG.update(shell||TERM);return PKG.upgradeAll(shell||TERM,true);}
    if(sub==='depends')return PKG.depends(args[1]);
    if(sub==='rdepends')return PKG.rdepends(args[1]);
    if(sub==='policy')return PKG.policy(args[1]);
    if(sub==='clean')return PKG.clean(false);
    if(sub==='autoclean')return PKG.clean(true);
    if(sub==='download')return PKG.download(args[1],ENV.cwd);
    if(sub==='source')return PKG.source(args[1],ENV.cwd);
    if(sub==='changelog')return PKG.changelog(args[1]);
    if(sub==='mark')return PKG.mark(args[1],args.slice(2));
    if(sub==='history')return PKG.history();
    if(sub==='stats')return PKG.stats();
    return `apt: unknown command '${sub}'\nUsage: apt [update|install|remove|purge|reinstall|list|search|show|upgrade|full-upgrade|autoremove|policy|clean|mark|history|stats]`;
  },
  async aptGet(args,shell){
    if(!args.length)return 'apt-get: usage: apt-get <command> [package]';
    return CMDS.apt(args,shell||TERM);
  },
  aptCache(args){
    const sub=args[0];
    if(sub==='policy')return PKG.policy(args[1]);
    if(sub==='show')return PKG.show(args[1]);
    if(sub==='depends')return PKG.depends(args[1]);
    if(sub==='rdepends')return PKG.rdepends(args[1]);
    if(sub==='search')return PKG.search(args.slice(1).join(' '));
    if(sub==='pkgnames')return PKG.packageNames(args[1]||'');
    if(sub==='stats')return PKG.stats();
    return 'apt-cache: usage: apt-cache [policy|show|depends|rdepends|search|pkgnames|stats]';
  },
  dpkg(args){
    const sub=args[0];
    if(sub==='-l'||sub==='--list')return PKG.list(args.slice(1));
    if(sub==='-L'||sub==='--listfiles')return PKG.listFiles(args[1]);
    if(sub==='-s'||sub==='--status')return PKG.show(args[1]);
    if(sub==='-i')return `dpkg: use 'apt install' for package installation`;
    if(sub==='--get-selections')return PKG.list(['--installed','--names-only']);
    return 'dpkg: use apt for package management';
  },

  // ── Editor ───────────────────────────────────────────────────────
  nano:async(args)=>{const f=args.find(a=>!a.startsWith('-'))||null;return new Promise(r=>Nano.open(f,()=>r('')));},
  vi:async(args)=>CMDS.nano(args),
  vim:async(args)=>CMDS.nano(args),

  // ── Crontab ──────────────────────────────────────────────────────
  crontab(args){
    if(args[0]==='-l')return VFS.readFile('/var/spool/cron/'+ENV.v.USER,ENV.cwd)||'# no crontab for '+ENV.v.USER;
    if(args[0]==='-e'){CMDS.nano(['/var/spool/cron/'+ENV.v.USER]);return '';}
    if(args[0]==='-r'){VFS.unlink(VFS.norm('/var/spool/cron/'+ENV.v.USER));return '';}
    return 'crontab: usage: crontab [-l|-e|-r]';
  },

  // ── Sudo / Su ────────────────────────────────────────────────────
  su(args){
    const user=args[0]||'root';
    if(user==='root'){
      const pw=prompt(`Password for root:`,'');
      if(pw!=='root'&&pw!=='')return 'su: Authentication failure';
      ENV.uid=0;ENV.v.USER='root';ENV.v.HOME='/root';ENV.cwd='/root';
      return `root@${ENV.v.HOSTNAME}:/root# `;
    }
    return `su: user ${user} does not exist`;
  },
  sudo(args){
    if(!args.length)return 'sudo: no command specified';
    ENV.uid=0;const old=ENV.v.USER;ENV.v.USER='root';
    const r=Shell.exec(args.join(' '));
    ENV.uid=1000;ENV.v.USER=old;
    return r;
  },
  last(){return `${ENV.v.USER}  pts/0        -                ${new Date().toDateString()} ${new Date().toTimeString().slice(0,5)}   still logged in\n\nwtmp begins ${new Date(BOOT_T).toDateString()}`;},
  tty(){return '/dev/pts/0';},
  stty(args){if(args.includes('size'))return '50 220';return 'speed 38400 baud; rows 50; columns 220;';},

  // ── Logging ──────────────────────────────────────────────────────
  dmesg(args){return VFS.readFile('/var/log/kern.log')||`[    0.000000] Linux version 6.1.0-htmlinux\n[    0.100000] HTMLinux v2: VFS initialized\n[    0.500000] bash: started (PID 1000)`;},
  journalctl(args){
    const n=args.includes('-n')?parseInt(args[args.indexOf('-n')+1])||20:50;
    const syslog=VFS.readFile('/var/log/syslog')||'';const kern=VFS.readFile('/var/log/kern.log')||'';const auth=VFS.readFile('/var/log/auth.log')||'';
    const lines=(syslog+kern+auth).split('\n').filter(Boolean).slice(-n);
    if(!lines.length)return `-- No entries --`;
    return `-- Logs begin at ${new Date(BOOT_T).toISOString()} --\n`+lines.join('\n');
  },
  logger(args){VFS.appendFile('/var/log/syslog',`${new Date().toISOString()} ${ENV.v.HOSTNAME} ${ENV.v.USER}: ${args.join(' ')}\n`);return '';},
  sysctl(args){
    const show={'kernel.hostname':ENV.v.HOSTNAME,'kernel.ostype':'Linux','kernel.osrelease':'6.1.0-htmlinux','vm.swappiness':'60','net.ipv4.ip_forward':'0'};
    if(args[0]==='-a')return Object.entries(show).map(([k,v])=>`${k} = ${v}`).join('\n');
    if(args[0]&&!args[0].startsWith('-'))return show[args[0]]!==undefined?`${args[0]} = ${show[args[0]]}`:'';
    return 'sysctl: usage: sysctl [-a] [variable]';
  },

  // ── Misc ─────────────────────────────────────────────────────────
  history(args){if(args[0]==='-c'){Hist.clear();return '';}return Hist.all().map((e,i)=>`${String(i+1).padStart(5)}  ${e}`).join('\n');},
  alias(args){if(!args.length)return Object.entries(Shell.aliases).map(([k,v])=>`alias ${k}='${v}'`).join('\n');for(const a of args){if(a.includes('=')){const[k,...r]=a.split('=');Shell.aliases[k]=r.join('=').replace(/^['"]|['"]$/g,'');}}return '';},
  unalias(args){for(const a of args)delete Shell.aliases[a];return '';},
  source(args){const f=args[0];if(!f)return 'source: filename argument required';const c=VFS.readFile(f,ENV.cwd);if(!c)return `source: ${f}: No such file`;for(const l of c.split('\n').filter(l=>l.trim()&&!l.trim().startsWith('#')))Shell.exec(l);return '';},
  yes(args){return Array(20).fill(args[0]||'y').join('\n');},
  true:()=>'',false:()=>'',
  test(args){
    if(args[0]==='-f')return VFS.stat(args[1],ENV.cwd)?.t==='f'?'':'1';
    if(args[0]==='-d')return VFS.stat(args[1],ENV.cwd)?.t==='d'?'':'1';
    if(args[0]==='-e')return VFS.exists(args[1],ENV.cwd)?'':'1';
    if(args[0]==='-z')return !args[1]?'':'1';if(args[0]==='-n')return args[1]?'':'1';
    if(args[1]==='=')return args[0]===args[2]?'':'1';if(args[1]==='!=')return args[0]!==args[2]?'':'1';
    if(args[1]==='-lt')return parseInt(args[0])<parseInt(args[2])?'':'1';
    if(args[1]==='-gt')return parseInt(args[0])>parseInt(args[2])?'':'1';
    if(args[1]==='-eq')return parseInt(args[0])===parseInt(args[2])?'':'1';
    return '';
  },
  expr(args){try{return String(Function('"use strict";return('+args.join(' ')+')')());}catch{return '0';}},
  read(args){const v=args[args.indexOf('-p')!==-1?2:0]||'REPLY';ENV.set(v,'');return '';},

  // ── Kernel/Admin (new) ───────────────────────────────────────────
  arch(){return 'x86_64';},
  lscpu(){return `Architecture:            x86_64\nCPU op-mode(s):          32-bit, 64-bit\nCPU(s):                  ${navigator.hardwareConcurrency||4}\nModel name:              Browser Virtual CPU\nThread(s) per core:      2\nCore(s) per socket:      ${Math.max(1,Math.floor((navigator.hardwareConcurrency||4)/2))}`;},
  lsmod(){return `Module                  Size  Used by\nvfs_htmlinux           24576  1\nnet_htmlinux           16384  0\ntty_htmlinux           12288  2`;},
  modprobe(args){const m=args[0];if(!m)return 'modprobe: missing module name';return '';},
  modinfo(args){const m=args[0]||'vfs_htmlinux';return `filename:       /lib/modules/6.1.0-htmlinux/${m}.ko\ndescription:    HTMLinux kernel module (simulated)\nlicense:        GPL\nvermagic:       6.1.0-htmlinux SMP`;},
  insmod(args){return args[0]?'' :'insmod: missing module filename';},
  rmmod(args){return args[0]?'' :'rmmod: missing module name';},
  depmod(){return '';},
  kmod(args){return args[0]?`kmod: executed ${args.join(' ')}`:'kmod: usage: kmod <command>';},
  lsusb(){return `Bus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub\nBus 001 Device 002: ID 046d:c534 Logitech USB Receiver`;},
  lspci(){return `00:00.0 Host bridge: Browser VM Host Bridge\n00:01.0 VGA compatible controller: HTMLinux Virtual GPU\n00:02.0 Ethernet controller: HTMLinux VirtIO Network Device`;},
  lsdev(){return `/dev/null\n/dev/zero\n/dev/urandom\n/dev/pts/0`;},
  udevadm(args){if(args[0]==='info')return 'P: /devices/virtual/tty/tty0\nE: DEVNAME=/dev/tty0\nE: SUBSYSTEM=tty';return 'udevadm: usage: udevadm [info|monitor|control|trigger]';},
  blkid(){return '/dev/vda1: UUID="HTMLINUX-ROOT" TYPE="ext4" PARTUUID="00000001-01"';},
  fdisk(args){if(args.includes('-l'))return `Disk /dev/vda: 20 GiB, 21474836480 bytes\nDevice     Boot Start      End  Sectors Size Id Type\n/dev/vda1  *     2048 41943039 41940992  20G 83 Linux`;return 'fdisk: simulated mode only (use -l)';},
  parted(args){if(args.includes('print'))return `Model: HTMLinux Virtual Disk (file)\nDisk /dev/vda: 20.0GB\nNumber  Start   End     Size    Type     File system  Flags\n 1      1049kB  20.0GB  20.0GB  primary  ext4         boot`;return 'parted: simulated mode only';},
  mkfs(args){const dev=args.find(a=>a.startsWith('/dev/'));if(!dev)return 'mkfs: missing device';return `mke2fs 1.47.0 (simulated)\nCreating filesystem on ${dev} ... done`;},
  fsck(args){const dev=args.find(a=>a.startsWith('/dev/'));if(!dev)return 'fsck: missing device';return `fsck from util-linux 2.39\n${dev}: clean, 1024/131072 files, 4096/524288 blocks`;},
  mkswap(args){const dev=args.find(a=>a.startsWith('/dev/'));if(!dev)return 'mkswap: missing device';return `Setting up swapspace version 1, size = 512 MiB\nno label, UUID=HTMLINUX-SWAP`;},
  swapon(args){return args[0]?'' :'swapon: missing device';},
  swapoff(args){return args[0]?'' :'swapoff: missing device';},
  lsipc(){return `RESOURCE DESCRIPTION\nMessage Queues 0\nShared Memory Segments 0\nSemaphore Arrays 0`;},
  ipcs(){return `------ Message Queues --------\nkey        msqid      owner      perms      used-bytes   messages\n\n------ Shared Memory Segments --------\nkey        shmid      owner      perms      bytes      nattch     status`;},
  ipcrm(){return '';},
  systemctl(args){
    const sub=args[0]||'status';
    if(sub==='list-units')return `UNIT                         LOAD   ACTIVE SUB     DESCRIPTION\ncron.service                 loaded active running Regular background program processing daemon\nnetworking.service           loaded active exited  Raise network interfaces\nsshd.service                 loaded active running OpenBSD Secure Shell server`;
    if(sub==='status')return `● htmlinux.service - HTMLinux Userspace\n   Loaded: loaded (/etc/systemd/system/htmlinux.service; enabled)\n   Active: active (running) since ${new Date(BOOT_T).toLocaleString()}`;
    if(['start','stop','restart','enable','disable','daemon-reload'].includes(sub))return '';
    return `systemctl: unsupported action '${sub}'`;
  },
  service(args){if(!args[0]||!args[1])return 'usage: service <name> <start|stop|restart|status>';return CMDS.systemctl([args[1],args[0]]);},
  loginctl(){return `SESSION UID USER SEAT TTY\n      1 1000 user seat0 pts/0`;},
  hostnamectl(){return ` Static hostname: ${ENV.v.HOSTNAME}\n       Icon name: computer-vm\n         Chassis: vm\n      Machine ID: htmlinux-demo\n         Boot ID: ${Math.random().toString(16).slice(2,18)}\nOperating System: HTMLinux 2.0\n          Kernel: Linux 6.1.0-htmlinux\n    Architecture: x86-64`;},
  timedatectl(){return `               Local time: ${new Date().toString()}\n           Universal time: ${new Date().toUTCString()}\n                 RTC time: ${new Date().toUTCString()}\n                Time zone: UTC (UTC, +0000)\nSystem clock synchronized: yes\n              NTP service: active`;},
  localectl(){return `System Locale: LANG=${ENV.v.LANG}\nVC Keymap: us\nX11 Layout: us`;},
  procinfo(){return `Kernel version: 6.1.0-htmlinux\nUptime: ${Math.floor((Date.now()-BOOT_T)/1000)}s\nPID max: 32768\nOpen files max: 1024`;},
  top(){return `top - ${new Date().toTimeString().slice(0,8)} up ${Math.floor((Date.now()-BOOT_T)/60000)} min, 1 user, load average: 0.08, 0.05, 0.01\nTasks: 5 total, 1 running, 4 sleeping, 0 stopped, 0 zombie\n%Cpu(s): 2.1 us, 1.0 sy, 0.0 ni, 96.9 id, 0.0 wa\nMiB Mem :  8192 total,  1024 free,   640 used,  6528 buff/cache\n\n  PID USER      PR  NI    VIRT    RES    SHR S  %CPU %MEM     TIME+ COMMAND\n 1000 user      20   0   10320   4128   3012 S   1.3  0.1   0:00.10 bash`;},
  sar(){return `Linux 6.1.0-htmlinux (${ENV.v.HOSTNAME})\t${new Date().toLocaleDateString()}\n\n12:00:00 AM     CPU     %user     %system    %idle\n12:00:01 AM     all      2.00       1.00     97.00`;},
  pidstat(){return `Linux 6.1.0-htmlinux (${ENV.v.HOSTNAME})\n\n12:00:00 AM   UID       PID    %usr %system  %guest   %wait    %CPU   CPU  Command\n12:00:01 AM  1000      1000    1.00    0.50    0.00    0.00    1.50     0  bash`;},
  perf(args){return args[0]?`perf: ${args.join(' ')} (simulated)\nSamples: 120  of event 'cycles', Event count (approx.): 452334`:'perf: usage: perf <subcommand>';},
  lslocks(){return `COMMAND           PID  TYPE SIZE MODE  M START END PATH\nbash             1000 POSIX 4K  WRITE 0     0   EOF /home/user/.bash_history`;},
  fuser(args){return args[0]?`${args[0]}: 1000`:'fuser: missing file or socket';},
  lsof(){return `COMMAND PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\nbash    1000 user  cwd    DIR  8,1      4096 1024 /home/user\nbash    1000 user    0u   CHR  136,0      0t0    3 /dev/pts/0`;},
  nice(args){if(!args.length)return '0';const cmd=args.filter(a=>!a.startsWith('-')).join(' ');return cmd?Shell.exec(cmd):'nice: missing command';},
  renice(args){const pid=args.find(a=>/^\d+$/.test(a));return pid?`${pid} (process ID) old priority 0, new priority 5`:'renice: bad process id';},
  chrt(){return `pid 1000's current scheduling policy: SCHED_OTHER\npid 1000's current scheduling priority: 0`;},
  taskset(){return `pid 1000's current affinity mask: f`;},
  getent(args){
    if(args[0]==='passwd')return VFS.readFile('/etc/passwd')||'';
    if(args[0]==='group')return VFS.readFile('/etc/group')||'';
    if(args[0]==='hosts')return VFS.readFile('/etc/hosts')||'';
    return 'getent: usage: getent [passwd|group|hosts] [key]';
  },
  groups(args){const u=args[0]||ENV.v.USER;const usr=UserDB.getUser(u);if(!usr)return `groups: '${u}': no such user`;return `${u} : ${(usr.groups||[]).join(' ')}`;},
  newgrp(args){if(!args[0])return 'newgrp: missing group';return '';},
  chsh(args){const shell=args[args.indexOf('-s')+1];if(!shell)return 'chsh: option requires an argument -- s';UserDB.modifyUser(ENV.v.USER,{shell});return 'Shell changed.';},
  chfn(args){const i=args.indexOf('-f');if(i===-1||!args[i+1])return 'chfn: missing full name';UserDB.modifyUser(ENV.v.USER,{gecos:args[i+1]});return '';},
  lastlog(){return `Username         Port     From             Latest\nroot                                     **Never logged in**\nuser             pts/0   localhost        ${new Date().toString()}`;},
  finger(args){const u=args[0]||ENV.v.USER;const usr=UserDB.getUser(u);if(!usr)return `finger: ${u}: no such user`;return `Login: ${usr.name}\t\tName: ${usr.gecos||usr.name}\nDirectory: ${usr.home}\t\tShell: ${usr.shell}\nOn since ${new Date().toString()} on pts/0`;},
  mesg(args){if(!args[0])return 'is y';return '';},
  wall(args){if(!args.length)return 'wall: message expected';TERM.writeln(`Broadcast message from ${ENV.v.USER}@${ENV.v.HOSTNAME}:\n${args.join(' ')}`);return '';},
  write(args){if(args.length<2)return 'write: usage: write user [tty]';TERM.writeln(`Message to ${args[0]}: ${args.slice(1).join(' ')}`);return '';},
  runlevel(){return 'N 5';},
  bootctl(){return `System:\n      Firmware: UEFI 2.70 (simulated)\n Firmware Arch: x64\n   Secure Boot: disabled\n  Current Boot Loader: HTMLinux`;},
  'grub-install'(args){return args[0]?`Installing for x86_64-efi platform to ${args[0]}...\nInstallation finished. No error reported.`:'grub-install: missing install device';},
  updateGrub(){return `Generating grub configuration file ...\nFound linux image: /boot/vmlinuz-6.1.0-htmlinux\ndone`;},
  'update-grub':(args)=>CMDS.updateGrub(args),
  lsinitramfs(){return `usr/bin/busybox\nusr/bin/bash\ninit\netc/fstab`;},
  initramfs(){return 'initramfs-tools: generated /boot/initrd.img-6.1.0-htmlinux';},
  mkinitcpio(){return '==> Building image from preset: default\n==> Image generation successful';},
  dracut(){return 'dracut: Executing: /usr/bin/dracut --force\ndracut: *** Creating initramfs image file done ***';},
  kernelstub(){return 'kernelstub.Config    :\nKernel Stub Manager (simulated)';},
  kexec(){return 'kexec_load failed: Operation not permitted';},
  crash(){return 'crash: cannot open /proc/kcore (simulated environment)';},
  sysrq(args){return args[0]?`SysRq : ${args[0]} accepted`:'sysrq: missing key';},
  halt(){return CMDS.poweroff([]);},
  shutdown(args){if(args.includes('now'))return CMDS.poweroff([]);return 'Shutdown scheduled (simulated).';},
  sync(){return '';},

  // ── Fun ──────────────────────────────────────────────────────────
  cowsay(args){const m=args.join(' ')||'Moo!';const b=m.length+2;return ` ${'_'.repeat(b)}\n< ${m} >\n ${'‾'.repeat(b)}\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`;},
  fortune(){const q=['The art of programming is the art of organizing complexity. — Dijkstra','Any fool can write code that a computer can understand. — Fowler','Talk is cheap. Show me the code. — Torvalds','In theory there is no difference between theory and practice. In practice there is. — Yogi Berra','The most dangerous phrase in the language is "We have always done it this way." — Grace Hopper','sudo make me a sandwich. — xkcd','There are 10 types of people: those who understand binary, and those who do not.','The best code is no code at all. — Jeff Atwood','It works on my machine. — Every Developer'];return q[Math.floor(Math.random()*q.length)];},
  cowthink(args){const m=args.join(' ')||'Hmm...';const b=m.length+2;return ` ${'_'.repeat(b)}\n( ${m} )\n ${'‾'.repeat(b)}\n        o   ^__^\n         o  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`;},
  sl(){return '      ====        ________                ___________ \n  _D _|  |_______/        \\__I_I_____===__|_________|\n   |(_)---  |   H\\________/ |   |        =|___ ___| \n   /     |  |   H  |  |     |   |         ||_| |_|| \n  |      |  |   H  |__--------------------| [___] |\n  | ________|___H__/__|_____/[][]~\\_______|       |\n  |/ |   |-----------I_____I [][] []  D   |=======|\n__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__\n |/-=|___|=O=====O=====O=====O   |_____/~\\___/\n  \\_/      \\__/  \\__/  \\__/  \\__/      \\_/';},
  banner(args){const t=args.join(' ')||'Hello!';return `\x1b[1m+${'─'.repeat(t.length+2)}+\n| ${t} |\n+${'─'.repeat(t.length+2)}+\x1b[0m`;},
  matrix(){const c='ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ012345678901234567890'.split('');const r=[];for(let i=0;i<12;i++)r.push(Array.from({length:60},()=>c[Math.floor(Math.random()*c.length)]).join(''));return r.join('\n');},
  lolcat(args){const t=args.join(' ')||'Hello, World!';return [...t].map((c,i)=>`\x1b[${31+(i%6)}m${c}\x1b[0m`).join('');},
  figlet(args){const t=args.join(' ')||'Hello';return `  ___ \n |${t}|\n  ‾‾‾`;},
  toilet(args){const t=args.filter(a=>!a.startsWith('-')).join(' ')||'HTMLinux';return `\x1b[1;36m██╗  ██╗████████╗███╗   ███╗██╗     ██╗███╗   ██╗██╗   ██╗██╗  ██╗\x1b[0m\n${t}`;},

  // ── JS runtime ───────────────────────────────────────────────────
  js(args){
    if(!args.length)return 'Usage: js [-e "code"] [file.js]';
    if(args[0]==='-e'&&args[1])return runJS(args[1]);
    const c=VFS.readFile(args[0],ENV.cwd);if(c===null)return `js: ${args[0]}: No such file`;
    return runJS(c);
  },

  // ── Help ─────────────────────────────────────────────────────────
  help(){
    return `\x1b[1;36mHTMLinux v2.0\x1b[0m — Built-in Commands
${'─'.repeat(60)}
\x1b[1mNavigation:\x1b[0m   cd pwd ls tree
\x1b[1mFiles:\x1b[0m        cat head tail tac rev nl fold touch cp mv rm
              mkdir rmdir ln readlink stat file realpath
              basename dirname mktemp install
\x1b[1mText:\x1b[0m         echo printf grep sed awk sort uniq wc tr cut
              paste join comm diff cmp strings xxd od hexdump
              tee xargs pv look
\x1b[1mSearch:\x1b[0m       find locate grep
\x1b[1mCompression:\x1b[0m  tar gzip gunzip zip unzip split
\x1b[1mSystem:\x1b[0m       env export set unset printenv uname date uptime
              ps kill free df du lsblk mount sysctl dmesg
              journalctl logger who w last tty stty nproc getconf
              vmstat iostat mpstat time watch sleep timeout
\x1b[1mNetwork:\x1b[0m      ping ifconfig ip ss netstat nslookup dig ssh
              traceroute mtr host whois nc nmap iptables route
\x1b[1mCrypto:\x1b[0m       md5sum sha1sum sha256sum sha512sum base64 base32
              xxd openssl gpg
\x1b[1mMath:\x1b[0m         bc calc seq factor numfmt shuf expr units cal
\x1b[1mUser:\x1b[0m         whoami id su sudo passwd hostname useradd userdel
\x1b[1mCron:\x1b[0m         crontab -e/-l/-r
\x1b[1mPackages:\x1b[0m     apt / apt-get / apt-cache (update install reinstall
              remove purge list search show policy mark clean
              autoremove download source changelog upgrade history stats)
              Available: python node htop neofetch git curl wget
                         vim lua jq ripgrep fzf httpie tree
\x1b[1mEditor:\x1b[0m       nano / vi / vim
\x1b[1mFun:\x1b[0m          cowsay cowthink fortune sl banner matrix lolcat toilet
\x1b[1mDiag:\x1b[0m         strace lsattr apropos whatis info compgen look pmap
\x1b[1mMisc:\x1b[0m         history alias source repeat nohup script declare
              clear reset_fs reboot poweroff exit
\x1b[1mBrowser:\x1b[0m      download upload js

Type \x1b[1mman <cmd>\x1b[0m for details. Tab to autocomplete.`;
  },
  man(args){
    const p={
      ls:'ls [options] [path]\n  -l  long format with permissions\n  -a  show hidden files\n  -h  human-readable sizes\n  -t  sort by modification time\n  -S  sort by size   -r  reverse   -R  recursive   -F  append indicators',
      grep:'grep [options] pattern [files]\n  -i  case insensitive  -v  invert match  -n  show line numbers\n  -r  recursive  -c  count  -l  list files  -o  only matching  -w  whole word',
      find:'find [path] [options]\n  -name pattern   match filename (glob)\n  -type f|d|l     file type filter\n  -maxdepth n     limit recursion depth',
      nano:'nano [file]\n  ^O  Write (save)  ^X  Exit  ^K  Cut line  ^U  Paste\n  ^W  Search  ^R  Insert file  ^C  Show cursor position',
      apt:'apt [command] [package]\n  update                 Refresh package index\n  install <pkg...>       Install packages (with dependencies)\n  reinstall <pkg...>     Reinstall packages\n  remove|purge <pkg>     Remove package (with or without config purge)\n  list [opts] [filter]   List packages\n    --installed --available --names-only --limit N --page N\n  search <query>         Search packages\n  show <pkg>             Show package info\n  policy [pkg]           Show candidate/install versions\n  mark auto|manual <p>   Toggle auto/manual state\n  mark hold|unhold <p>   Hold package versions\n  clean|autoclean        Clean package cache\n  autoremove             Remove auto-installed packages\n  download <pkg>         Download .deb to current directory\n  source <pkg>           Download simulated source package\n  changelog <pkg>        Show package changelog\n  history                Show apt history log\n  stats                  Show package db stats\n  upgrade|full-upgrade   Upgrade all installed packages\n  depends <pkg>          Show dependencies\n  rdepends <pkg>         Show reverse dependencies\n\nAlso available: apt-get, apt-cache, dpkg -L',
      bash:'Bash built-ins & shell features:\n  Variables: VAR=val, $VAR, ${VAR}, $?, $$, $#, $@\n  Subshell:  $(cmd) or `cmd`\n  Control:   if/then/elif/else/fi\n             for VAR in list; do ... done\n             while cond; do ... done\n  Redirect:  > >> < 2> 2>&1\n  Pipe:      cmd1 | cmd2 | cmd3\n  Logic:     cmd1 && cmd2  cmd1 || cmd2\n  Functions: fname() { commands; }',
      units:'units <value> <from> <to>\n  Temperature: c/f\n  Distance:    km/miles, in/cm, ft/m\n  Weight:      kg/lbs, g/oz\n  Volume:      l/gal\n  Data:        gb/mb, mb/kb, kb/bytes\n  Speed:       mph/kph\n  Angle:       deg/rad\n\nExample: units 100 km miles',
      git:'git <command>\n  init            Create new repository\n  clone <url>     Clone a GitHub repo (fetches real files)\n  status          Show working tree status\n  add .           Stage all files\n  commit -m "msg" Create a commit\n  log [--oneline] Show commit history\n  branch [-d]     List or delete branches\n  checkout [-b]   Switch or create branch\n  stash [pop]     Stash or restore changes\n  remote -v       Show remotes\n  diff            Show staged changes\n  push / pull     Simulate push/pull',
    };
    const cmd=args[0];
    if(!cmd)return 'What manual page do you want?\nExample: man ls';
    if(p[cmd])return `MANUAL PAGE: ${cmd.toUpperCase()}\n\nSYNOPSIS\n  ${p[cmd]}`;
    return `No manual entry for ${cmd}\nTry: man [ls|grep|find|nano|apt|bash|git|units]`;
  },

  // ── File I/O (browser) ───────────────────────────────────────────
  download(args){
    const f=args[0];if(!f)return 'download: specify a filename';
    const c=VFS.readFile(f,ENV.cwd);if(c===null)return `download: ${f}: No such file`;
    const blob=new Blob([c],{type:'text/plain'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=f.split('/').pop();a.click();
    URL.revokeObjectURL(url);
    return `Saved ${f} (${humanSize(c.length)}) to browser downloads`;
  },
  upload(){
    const inp=$('file-up');
    inp.onchange=async()=>{
      for(const file of inp.files){
        const txt=await file.text();
        VFS.writeFile(VFS.norm(file.name,ENV.cwd),txt);
        TERM.writeln(`Received: ${file.name} (${humanSize(txt.length)})`);
      }
      inp.value='';TERM.unlock();TERM.updatePrompt();TERM.focus();
    };
    inp.click();TERM.lock();return '';
  },
  reset_fs(){if(confirm('Reset filesystem to defaults? All data will be lost.')){VFS.reset();return 'Filesystem reset to defaults.';}return 'Cancelled.';},
  reboot(){TERM.writeln('\x1b[1mSystem is going down for reboot NOW!\x1b[0m');setTimeout(()=>location.reload(),1500);return '';},
  poweroff(){TERM.writeln('\x1b[1mSystem is shutting down...\x1b[0m');setTimeout(()=>{document.body.style.background='#000';document.body.innerHTML='<div style="color:#1a1a1a;font-family:monospace;padding:10px">[ 0.000000] System halted.</div>';},1500);return '';},
  exit(args){TERM.writeln(`logout`);return '';},
  logout:()=>CMDS.exit([]),

  // ── JSON processor ───────────────────────────────────────────────
  jq(args){
    let filter='.';const ps=[];
    for(const a of args){if(!a.startsWith('-')&&!VFS.exists(a,ENV.cwd)&&a!=='.')filter=a;else if(!a.startsWith('-'))ps.push(a);}
    if(!ps.length)return 'jq: no input file';
    return ps.map(p=>{
      const c=VFS.readFile(p,ENV.cwd);if(!c)return `jq: ${p}: No such file`;
      try{
        const data=JSON.parse(c);
        if(filter==='.')return JSON.stringify(data,null,2);
        if(filter.startsWith('.'))return JSON.stringify(filter.slice(1).split('.').reduce((o,k)=>o?.[k],data),null,2);
        return JSON.stringify(data,null,2);
      }catch(e){return `jq: parse error: ${e.message}`;}
    }).join('\n');
  },

  // ── Autocomplete helper ──────────────────────────────────────────
  _completions(partial) {
    const parts=partial.split(' ');
    if(parts.length<=1){
      const pfx=parts[0];
      return [...Object.keys(CMDS).filter(c=>c.startsWith(pfx)&&!c.startsWith('_')),
              ...Object.keys(Shell.aliases).filter(a=>a.startsWith(pfx))].sort();
    }
    const pathPart=parts[parts.length-1];
    let dir=ENV.cwd,pfx='';
    if(pathPart.includes('/')){const ls=pathPart.lastIndexOf('/');dir=VFS.norm(pathPart.slice(0,ls)||'/',ENV.cwd);pfx=pathPart.slice(ls+1);}
    else pfx=pathPart;
    const entries=VFS.readdir(dir,ENV.cwd)||[];
    return entries.filter(e=>e.name.startsWith(pfx)).map(e=>{const base=pathPart.includes('/')?pathPart.slice(0,pathPart.lastIndexOf('/')+1):'';return base+e.name+(e.t==='d'?'/':'');});
  },
};

// Aliases
CMDS['['] = CMDS.test;
CMDS['ll'] = (a)=>CMDS.ls(['-la',...a]);
CMDS['la'] = (a)=>CMDS.ls(['-A',...a]);
CMDS['l']  = (a)=>CMDS.ls(['-CF',...a]);
CMDS['cls'] = ()=>{ CMDS.clear(); return ''; };
CMDS['.']  = CMDS.source;
CMDS['typeset'] = CMDS.declare;
CMDS['nc'] = CMDS.nc;
CMDS['tracepath'] = CMDS.traceroute;
CMDS['apt-get'] = CMDS.aptGet;
CMDS['apt-cache'] = CMDS.aptCache;

// scope aliases
var CMDS = window.CMDS;

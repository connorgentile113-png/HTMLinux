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
  pwd(args){ return args.includes('-L')||!args.includes('-P')?ENV.cwd:ENV.cwd; },

  // ── Listing ──────────────────────────────────────────────────────
  ls(args) {
    let a=false,A=false,l=false,h=false,t=false,S=false,r=false,F=false,R=false,one=false,color=true,si=false;
    const paths=[];
    for(const x of args){
      if(x.startsWith('-')&&!x.startsWith('--')){
        if(x.includes('a'))a=true; if(x.includes('A'))A=true;
        if(x.includes('l'))l=true; if(x.includes('h'))h=true;
        if(x.includes('t'))t=true; if(x.includes('S'))S=true;
        if(x.includes('r'))r=true; if(x.includes('F'))F=true;
        if(x.includes('R'))R=true; if(x.includes('1'))one=true;
        if(x.includes('n'))color=false; if(x.includes('s'))si=true;
      } else paths.push(x);
    }
    if(!paths.length)paths=['.'];

    const colorName=(e)=>{
      if(!color)return e.name+(e.t==='d'?(F?'/':''):e.t==='l'?(F?'@':''):(e.m&&(e.m&0o111))?(F?'*':''):'');
      let n=e.name;
      const suf=e.t==='d'?(F?'/':''):e.t==='l'?(F?'@':''):'';
      if(e.t==='d') return `\x1b[1m${n}${suf}\x1b[0m`;
      if(e.t==='l') return `\x1b[4m${n}${suf}\x1b[0m`;
      if(e.m&&(e.m&0o111)) return `\x1b[1m${n}${suf}\x1b[0m`;
      return n+suf;
    };

    const doDir=(p,prefix='')=>{
      let entries=VFS.readdir(p,ENV.cwd)||[];
      if(!a&&!A)entries=entries.filter(e=>!e.name.startsWith('.'));
      if(t)entries.sort((a,b)=>(b.mt||0)-(a.mt||0));
      else if(S)entries.sort((a,b)=>VFS.size(b.path)-VFS.size(a.path));
      else entries.sort((a,b)=>a.name.localeCompare(b.name));
      if(r)entries.reverse();

      if(l){
        const total=entries.reduce((s,e)=>s+Math.ceil(VFS.size(e.path)/512),0);
        const lines=entries.map(e=>{
          const perm=VFS.fmtMode(e.m||0o644,e.t);
          const sz=h?humanSize(VFS.size(e.path)).padStart(6):String(VFS.size(e.path)).padStart(9);
          const d=new Date(e.mt||0);
          const mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
          const dt=`${mo} ${String(d.getDate()).padStart(2)} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
          const lnk=e.t==='l'?` -> ${e.target}`:'';
          return `${perm} 1 ${String(e.u||1000).padEnd(8)} ${String(e.g||1000).padEnd(8)} ${sz} ${dt} ${colorName(e)}${lnk}`;
        });
        return (prefix?`${prefix}:\n`:'')+`total ${total}\n`+lines.join('\n');
      }
      if(one||!process?.stdout?.columns) return (prefix?`${prefix}:\n`:'')+entries.map(e=>colorName(e)).join('\n');
      return (prefix?`${prefix}:\n`:'')+entries.map(e=>colorName(e)).join('  ');
    };

    const results=[];
    for(const p of paths){
      const node=VFS.stat(p,ENV.cwd);
      if(!node){results.push(`ls: cannot access '${p}': No such file or directory`);continue;}
      if(node.t==='d'){
        results.push(doDir(p,paths.length>1?p:''));
        if(R){const en=VFS.readdir(p,ENV.cwd)||[];for(const e of en)if(e.t==='d')results.push('\n'+doDir(e.path,e.path));}
      } else results.push(colorName(node));
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
  tac(args){
    if(!args.length)return 'tac: missing file';
    return args.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `tac: ${p}: No such file`;return c.split('\n').reverse().join('\n');}).join('\n');
  },
  rev(args){
    if(!args.length)return 'rev: missing file';
    return args.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `rev: ${p}: No such file`;return c.split('\n').map(l=>[...l].reverse().join('')).join('\n');}).join('\n');
  },
  nl(args){
    if(!args.length)return 'nl: missing file';
    return args.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `nl: ${p}: No such file`;let n=1;return c.split('\n').map(l=>l.trim()?`${String(n++).padStart(6)}\t${l}`:l).join('\n');}).join('\n');
  },
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
    for(const a of args){if(a==='-r'||a==='-R'||a==='--recursive')rf=true;else if(a==='-f')f=true;else if(a==='-rf'||a==='-fr'||a==='-Rf'||a==='-fr')rf=f=true;else ps.push(a);}
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
  realpath(args){
    if(!args.length)return 'realpath: missing operand';
    return args.map(p=>VFS.norm(p,ENV.cwd)).join('\n');
  },
  basename(args){
    if(!args.length)return 'basename: missing operand';
    let name=args[0].split('/').pop();
    if(args[1]&&name.endsWith(args[1]))name=name.slice(0,-args[1].length);
    return name;
  },
  dirname(args){
    if(!args.length)return 'dirname: missing operand';
    const p=args[0].replace(/\/+$/,'');
    return p.includes('/')?p.slice(0,p.lastIndexOf('/'))||'/':'.';
  },
  mktemp(args){
    const tmpdir=ENV.v.TMPDIR||'/tmp';
    const name=args.find(a=>a.includes('XXX'))||'tmp.XXXXXX';
    const n=name.replace(/X+$/,m=>Math.random().toString(36).slice(2,2+m.length));
    const p=`${tmpdir}/${n}`;
    if(args.includes('-d'))VFS.mkdir(p);else VFS.writeFile(p,'');
    return p;
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
    const rest=args.slice(1); let i=0;
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
    let re; try{re=new RegExp(pat,flags);}catch{return `grep: invalid regex: ${pat}`;}
    const search=(p,prefix='')=>{
      const content=VFS.readFile(p,ENV.cwd);
      if(content===null)return `grep: ${p}: No such file`;
      const lines=content.split('\n');
      if(c2){const n=lines.filter(x=>{const m=re.test(x);re.lastIndex=0;return v2?!m:m;}).length;return prefix?`${prefix}:${n}`:String(n);}
      if(l){const found=lines.some(x=>{const m=re.test(x);re.lastIndex=0;return v2?!m:m;});return found?p:'';}
      const results=[];
      lines.forEach((line,idx)=>{
        const match=re.test(line); re.lastIndex=0;
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
      const NF=fields.length,NR=1;
      const get=(e)=>{
        if(e==='$0')return line;
        if(e.startsWith('$')){const n2=parseInt(e.slice(1));return fields[n2-1]??'';}
        if(e==='NF')return NF;
        if(e==='NR')return NR;
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
    lines.sort((a,b)=>{
      let av=field?a.split(/\s+/)[field]||a:a;
      let bv=field?b.split(/\s+/)[field]||b:b;
      if(f){av=av.toLowerCase();bv=bv.toLowerCase();}
      return n2?parseFloat(av)-parseFloat(bv):av.localeCompare(bv);
    });
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
    lines.push(`--- ${ps[0]}`);
    lines.push(`+++ ${ps[1]}`);
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

  // ── System ───────────────────────────────────────────────────────
  clear(){TERM.clear();return '';},
  echo: null, // defined above
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

  // ── User management ──────────────────────────────────────────────
  async users() { return new Promise(r=>UserMgr.open(()=>r(''))); },
  useradd(args) {
    const n=args.find(a=>!a.startsWith('-')); if(!n)return'useradd: missing username';
    if(UserDB.getUser(n))return`useradd: user '${n}' already exists`;
    const hi=args.indexOf('-d'),si=args.indexOf('-s'),ci=args.indexOf('-c');
    UserDB.addUser({name:n,home:hi!==-1?args[hi+1]:`/home/${n}`,shell:si!==-1?args[si+1]:'/bin/bash',gecos:ci!==-1?args[ci+1]:''});
    return '';
  },
  userdel(args) {
    const n=args.find(a=>!a.startsWith('-')); if(!n)return'userdel: missing username';
    if(!UserDB.getUser(n))return`userdel: user '${n}' does not exist`;
    UserDB.removeUser(n, args.includes('-r')); return '';
  },
  usermod(args) {
    const n=args[args.length-1]; const u=UserDB.getUser(n); if(!u)return`usermod: user '${n}' not found`;
    const ch={}; const si=args.indexOf('-s'),di=args.indexOf('-d'),ci=args.indexOf('-c');
    if(si!==-1)ch.shell=args[si+1]; if(di!==-1)ch.home=args[di+1]; if(ci!==-1)ch.gecos=args[ci+1];
    if(args.includes('-L'))ch.locked=true; if(args.includes('-U'))ch.locked=false;
    UserDB.modifyUser(n,ch); return '';
  },
  groupadd(args) { const n=args.find(a=>!a.startsWith('-')); if(!n)return'groupadd: missing name'; UserDB.addGroup(n); return ''; },
  groupdel(args) { const n=args.find(a=>!a.startsWith('-')); if(!n)return'groupdel: missing name'; UserDB.removeGroup(n); return ''; },
  passwd(args) {
    const name=args[0]||ENV.v.USER;
    const p1=prompt(`New password for ${name}:`); if(!p1)return'passwd: unchanged';
    const p2=prompt('Retype:'); if(p1!==p2)return'passwd: passwords do not match';
    UserDB.modifyUser(name,{pw:p1});
    VFS.appendFile('/var/log/auth.log',`${new Date().toISOString()} htmlinux passwd: password changed for ${name}\n`);
    return 'passwd: password updated successfully';
  },
  who() { return `${ENV.v.USER}  pts/0   ${new Date().toLocaleString()}`; },
  w()   { return `${ENV.v.USER.padEnd(8)} pts/0  - ${new Date().toTimeString().slice(0,5)} 0.00s bash`; },
  id()  { const u=UserDB.getUser(ENV.v.USER); const grps=(u?.groups||[]).map((g,i)=>{ const gr=UserDB.getGroup(g); return gr?`${gr.gid}(${g})`:g; }).join(','); return `uid=${ENV.uid}(${ENV.v.USER}) gid=${ENV.gid}(${ENV.v.USER}) groups=${grps}`; },
  id(){return `uid=${ENV.uid}(${ENV.v.USER}) gid=${ENV.gid}(${ENV.v.USER}) groups=${ENV.gid}(${ENV.v.USER}),27(sudo),4(adm)`;},
  hostname(args){if(args[0]){ENV.set('HOSTNAME',args[0]);VFS.writeFile('/etc/hostname',args[0]+'\n');return '';}return ENV.v.HOSTNAME;},
  uname(args){
    const a=args.includes('-a');
    if(a)return `Linux ${ENV.v.HOSTNAME} 6.1.0-htmlinux #1 SMP PREEMPT_DYNAMIC ${new Date().toDateString()} x86_64 GNU/Linux`;
    if(args.includes('-r'))return '6.1.0-htmlinux';
    if(args.includes('-n'))return ENV.v.HOSTNAME;
    if(args.includes('-m'))return 'x86_64';
    if(args.includes('-s'))return 'Linux';
    if(args.includes('-v'))return '#1 SMP PREEMPT_DYNAMIC';
    if(args.includes('-p'))return 'x86_64';
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

  // ── Disk ─────────────────────────────────────────────────────────
  df(args){
    const h=args.includes('-h');const used=VFS.usedSpace();const total=5*1024*1024;const free=total-used;
    const fmt=h?humanSize:(b)=>Math.round(b/1024)+'K';
    return `Filesystem      Size  Used Avail Use% Mounted on\nlocalStorage  ${String(fmt(total)).padStart(6)} ${String(fmt(used)).padStart(5)} ${String(fmt(free)).padStart(5)} ${Math.round(used/total*100)}% /\ntmpfs         ${String(fmt(512*1024)).padStart(6)} ${String(fmt(0)).padStart(5)} ${String(fmt(512*1024)).padStart(5)}   0% /tmp`;
  },
  du(args){
    let h=false;const ps=[];
    for(const a of args){if(a==='-h')h=true;else if(a==='-s'){}else ps.push(a);}
    const target=ps[0]||'.';
    const abs=VFS.norm(target,ENV.cwd);
    const walk=(p)=>{
      const entries=VFS.readdir(p)||[];
      return entries.reduce((s,e)=>{if(e.t==='d')return s+walk(e.path);return s+VFS.size(e.path);},0);
    };
    const node=VFS.stat(target,ENV.cwd);
    const sz=node?.t==='d'?walk(abs):VFS.size(target,ENV.cwd);
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
  mount(args){
    if(!args.length)return VFS.readFile('/proc/mounts');
    return `mount: ${args.join(' ')}: simulated mount (not persistent)`;
  },
  umount(args){return args.length?`umount: ${args[0]}: device busy`:'umount: missing path';},

  // ── Network ───────────────────────────────────────────────────────
  ping(args){
    const h=args.find(a=>!a.startsWith('-'))||'localhost';
    const n=args.includes('-c')?parseInt(args[args.indexOf('-c')+1])||4:4;
    const lines=[`PING ${h} (127.0.0.1) 56(84) bytes of data.`];
    for(let i=0;i<n;i++)lines.push(`64 bytes from ${h}: icmp_seq=${i+1} ttl=64 time=${(Math.random()*20+0.5).toFixed(3)} ms`);
    lines.push(`\n--- ${h} ping statistics ---\n${n} packets transmitted, ${n} received, 0% packet loss, time ${n*1000}ms\nrtt min/avg/max/mdev = 0.5/10.0/20.0/5.0 ms`);
    return lines.join('\n');
  },
  ifconfig(){return `lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536\n    inet 127.0.0.1  netmask 255.0.0.0\n    inet6 ::1  prefixlen 128\n    loop  txqueuelen 1000  (Local Loopback)\n    RX packets 0  bytes 0 (0.0 B)\n    TX packets 0  bytes 0 (0.0 B)\n\nbr0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n    inet ${navigator.onLine?'10.0.0.2':'0.0.0.0'}  netmask 255.255.255.0  broadcast 10.0.0.255\n    ether 52:54:00:12:34:56  txqueuelen 1000  (Ethernet)\n    RX packets 5678  bytes 567890 (555.0 KiB)\n    TX packets 2345  bytes 234567 (229.0 KiB)`;},
  ip(args){if(!args[0]||args[0]==='addr'||args[0]==='a')return CMDS.ifconfig([]);if(args[0]==='route'||args[0]==='r')return 'default via 10.0.0.1 dev br0 proto dhcp\n10.0.0.0/24 dev br0 proto kernel scope link src 10.0.0.2';if(args[0]==='link'||args[0]==='l')return '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536\n2: br0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500';return 'Usage: ip [addr|route|link]';},
  ss(args){return `Netid  State   Recv-Q Send-Q Local Address:Port  Peer Address:Port  Process\ntcp    LISTEN  0      128    0.0.0.0:80         0.0.0.0:*          users:("nginx")\ntcp    ESTAB   0      0      10.0.0.2:52345     10.0.0.1:443       users:("browser")`;},
  netstat:()=>CMDS.ss([]),
  nslookup(args){const h=args[0]||'localhost';return `Server:\t\t8.8.8.8\nAddress:\t8.8.8.8#53\n\nNon-authoritative answer:\nName:\t${h}\nAddress: 93.184.216.34`;},
  dig(args){const h=args[0]||'localhost';return `; <<>> DiG 9.18.19 <<>> ${h}\n;; global options: +cmd\n;; Got answer:\n;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 12345\n;; flags: qr rd ra; QUERY: 1, ANSWER: 1\n\n;; ANSWER SECTION:\n${h}.\t\t300\tIN\tA\t93.184.216.34\n\n;; Query time: 23 msec\n;; SERVER: 8.8.8.8#53`;},

  // ── Crypto / Binary ──────────────────────────────────────────────
  md5sum(args){
    const hash=s=>{let h=0;for(let i=0;i<s.length;i++)h=Math.imul(31,h)+s.charCodeAt(i)|0;return Math.abs(h).toString(16).padStart(32,'0');};
    return args.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `md5sum: ${p}: No such file`;return `${hash(c)}  ${p}`;}).join('\n');
  },
  sha256sum(args){
    const hash=s=>{let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<s.length;i++){h1=Math.imul(h1^s.charCodeAt(i),2654435761);h2=Math.imul(h2^s.charCodeAt(i),1597334677);}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return((4294967296*(2097151&h2))+(h1>>>0)).toString(16).padStart(64,'0');};
    return args.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `sha256sum: ${p}: No such file`;return `${hash(c)}  ${p}`;}).join('\n');
  },
  sha1sum(args){
    const hash=s=>{let h=0x67452301;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),0x9e3779b9)|0;return Math.abs(h).toString(16).padStart(40,'0');};
    return args.map(p=>{const c=VFS.readFile(p,ENV.cwd);if(c===null)return `sha1sum: ${p}: No such file`;return `${hash(c)}  ${p}`;}).join('\n');
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
    const bytes=new TextEncoder().encode(c);
    const lines=[];
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
    const ps=args.filter(a=>!a.startsWith('-'));
    if(!ps[0])return 'od: missing file';
    const c=VFS.readFile(ps[0],ENV.cwd);if(c===null)return `od: ${ps[0]}: No such file`;
    const bytes=new TextEncoder().encode(c);
    const lines=[];
    for(let i=0;i<Math.min(bytes.length,128);i+=16){
      const chunk=bytes.slice(i,i+16);
      const oct=[...chunk].map(b=>b.toString(8).padStart(3,'0')).join(' ');
      lines.push(`${i.toString(8).padStart(7,'0')} ${oct}`);
    }
    lines.push(`${Math.min(bytes.length,128).toString(8).padStart(7,'0')}`);
    return lines.join('\n');
  },
  strings(args){if(!args[0])return 'strings: missing file';const c=VFS.readFile(args[0],ENV.cwd);if(c===null)return `strings: ${args[0]}: No such file`;return(c.match(/[\x20-\x7e]{4,}/g)||[]).join('\n');},
  cmp(args){
    if(args.length<2)return 'cmp: missing operand';
    const [a,b]=[VFS.readFile(args[0],ENV.cwd),VFS.readFile(args[1],ENV.cwd)];
    if(a===null)return `cmp: ${args[0]}: No such file`;
    if(b===null)return `cmp: ${args[1]}: No such file`;
    if(a===b)return '';
    for(let i=0;i<Math.min(a.length,b.length);i++){if(a[i]!==b[i])return `${args[0]} ${args[1]} differ: byte ${i+1}, line ${a.slice(0,i).split('\n').length}`;}
    return `${args[0]} ${args[1]}: EOF on ${a.length<b.length?args[0]:args[1]}`;
  },

  // ── Math ─────────────────────────────────────────────────────────
  bc(args){
    const code=args.join(' ');
    if(!code)return 'bc -- arbitrary precision calculator. Usage: bc <expr>';
    try {return String(Function('"use strict";return('+code+')')());} catch(e){return `(standard_in) 1: ${e.message}`;}
  },
  calc:(args)=>CMDS.bc(args),
  seq(args){
    let first=1,step=1,last;
    if(args.length===1)last=parseInt(args[0]);
    else if(args.length===2){first=parseInt(args[0]);last=parseInt(args[1]);}
    else if(args.length===3){first=parseInt(args[0]);step=parseInt(args[1]);last=parseInt(args[2]);}
    const r=[];for(let i=first;step>0?i<=last:i>=last;i+=step)r.push(i);
    return r.join('\n');
  },
  factor(args){
    const factorize=(n)=>{const f=[];let d=2;while(d*d<=n){while(n%d===0){f.push(d);n=Math.floor(n/d);}d++;}if(n>1)f.push(n);return f;};
    return args.map(a=>{const n=parseInt(a);return isNaN(n)?`factor: '${a}' is not a positive integer`:`${n}: ${factorize(n).join(' ')}`;}).join('\n');
  },
  numfmt(args){
    const n=parseFloat(args[0]);
    if(isNaN(n))return 'numfmt: missing number';
    if(args.includes('--to=si'))return humanSize(n);
    if(args.includes('--to=iec'))return humanSize(n);
    if(args.includes('--from=si')||args.includes('--from=iec'))return String(n);
    return String(n);
  },
  shuf(args){
    const n=args.indexOf('-n')!==-1?parseInt(args[args.indexOf('-n')+1]):Infinity;
    const e=args.indexOf('-e')!==-1;
    let lines2;
    if(e){lines2=args.filter(a=>a!=='-e'&&a!=='-n'&&!a.match(/^\d+$/));}
    else{const ps=args.filter(a=>!a.startsWith('-'));if(!ps.length)return 'shuf: no input';lines2=(VFS.readFile(ps[0],ENV.cwd)||'').split('\n');}
    for(let i=lines2.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[lines2[i],lines2[j]]=[lines2[j],lines2[i]];}
    return lines2.slice(0,n).join('\n');
  },
  repeat(args){
    const n=parseInt(args[0])||3;const cmd=args.slice(1).join(' ');
    if(!cmd)return 'repeat: missing command';
    const results=[];
    for(let i=0;i<n;i++)results.push(Shell.exec(cmd));
    return Promise.all(results).then(rs=>rs.join('\n'));
  },

  // ── Archive ───────────────────────────────────────────────────────
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
    const ps=args.filter(a=>!a.startsWith('-'));
    if(!ps.length)return 'gzip: missing file';
    for(const p of ps){
      const c=VFS.readFile(p,ENV.cwd);if(c===null)continue;
      VFS.writeFile(p+'.gz',btoa(c),ENV.cwd);VFS.unlink(VFS.norm(p,ENV.cwd));
    }
    return '';
  },
  gunzip(args){
    const ps=args.filter(a=>!a.startsWith('-'));
    if(!ps.length)return 'gunzip: missing file';
    for(const p of ps){
      const c=VFS.readFile(p,ENV.cwd);if(c===null)continue;
      try{const d=atob(c);VFS.writeFile(p.replace(/\.gz$/,''),d,ENV.cwd);VFS.unlink(VFS.norm(p,ENV.cwd));}catch{TERM.writeln(`gunzip: ${p}: not in gzip format`);}
    }
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

  // ── Package manager ───────────────────────────────────────────────
  async apt(args,shell){
    const sub=args[0];
    if(!sub)return 'Usage: apt [update|install|remove|purge|list|search|show|upgrade] [package]';
    if(sub==='update')return await PKG.update(shell||TERM);
    if(sub==='install'&&args[1])return await PKG.install(args[1],shell||TERM);
    if(sub==='remove'||sub==='purge')return PKG.remove(args[1]);
    if(sub==='list')return PKG.list(args[1]);
    if(sub==='search')return PKG.search(args[1]||'');
    if(sub==='show')return PKG.show(args[1]);
    if(sub==='upgrade'){await PKG.update(shell||TERM);return 'All packages are up to date.';}
    return `apt: unknown command '${sub}'`;
  },
  dpkg(args){
    const sub=args[0];
    if(sub==='-l')return PKG.list(args[1]);
    if(sub==='--list')return PKG.list(args[1]);
    return 'dpkg: use apt for package management';
  },

  // ── Editor ────────────────────────────────────────────────────────
  nano:async(args)=>{const f=args.find(a=>!a.startsWith('-'))||null;return new Promise(r=>Nano.open(f,()=>r('')));},
  vi:async(args)=>CMDS.nano(args),
  vim:async(args)=>CMDS.nano(args),

  // ── Crontab ───────────────────────────────────────────────────────
  crontab(args){
    if(args[0]==='-l')return VFS.readFile('/var/spool/cron/'+ENV.v.USER,ENV.cwd)||'# no crontab for '+ENV.v.USER;
    if(args[0]==='-e'){CMDS.nano(['/var/spool/cron/'+ENV.v.USER]);return '';}
    if(args[0]==='-r'){VFS.unlink(VFS.norm('/var/spool/cron/'+ENV.v.USER));return '';}
    return 'crontab: usage: crontab [-l|-e|-r]';
  },

  // ── User management ───────────────────────────────────────────────
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
  passwd(args){
    const user=args[0]||ENV.v.USER;
    const pw=prompt(`New password for ${user}:`,'');
    if(!pw)return 'passwd: Password unchanged.';
    const pw2=prompt(`Retype new password:`,'');
    if(pw!==pw2)return 'passwd: Sorry, passwords do not match.';
    return `passwd: password updated successfully`;
  },
  useradd(args){return `useradd: not supported in browser environment`;},
  groupadd(args){return `groupadd: not supported in browser environment`;},
  who(){return `${ENV.v.USER}  tty1         ${new Date().toLocaleString()}`;},
  w(){return `${new Date().toTimeString().slice(0,5)} up ${Math.floor((Date.now()-BOOT_T)/60000)} min,  1 user,  load average: 0.00\nUSER     TTY      FROM             LOGIN@   IDLE JCPU   PCPU WHAT\n${ENV.v.USER.padEnd(8)} pts/0    -                ${new Date().toTimeString().slice(0,5)}   0.00s  0.00s  0.00s bash`;},
  last(){return `${ENV.v.USER}  pts/0        -                ${new Date().toDateString()} ${new Date().toTimeString().slice(0,5)}   still logged in\n\nwtmp begins ${new Date(BOOT_T).toDateString()}`;},
  tty(){return '/dev/pts/0';},
  stty(args){if(args.includes('size'))return '50 220';return 'speed 38400 baud; rows 50; columns 220;\n-parenb -parodd -cmspar cs8 -hupcl -cstopb cread -clocal -crtscts\n-ignbrk -brkint -ignpar -parmrk -inpck -istrip -inlcr -igncr icrnl ixon -ixoff -iuclc -ixany -imaxbel -iutf8\nopost -olcuc -ocrnl onlcr -onocr -onlret -ofill -ofdel nl0 cr0 tab0 bs0 vt0 ff0\nisig icanon iexten echo echoe echok -echonl -noflsh -xcase -tostop -echoprt echoctl echoke -flusho -extproc';},

  // ── Logging ───────────────────────────────────────────────────────
  dmesg(args){
    const t=(s)=>`[${((Date.now()-BOOT_T)/1000+s).toFixed(6)}]`;
    return VFS.readFile('/var/log/kern.log')||`[    0.000000] Linux version 6.1.0-htmlinux\n[    0.100000] HTMLinux: VFS initialized\n[    0.500000] bash: started (PID 1000)`;
  },
  journalctl(args){
    const n=args.includes('-n')?parseInt(args[args.indexOf('-n')+1])||20:50;
    const syslog=VFS.readFile('/var/log/syslog')||'';
    const kern=VFS.readFile('/var/log/kern.log')||'';
    const auth=VFS.readFile('/var/log/auth.log')||'';
    const lines=(syslog+kern+auth).split('\n').filter(Boolean).slice(-n);
    if(!lines.length)return `-- No entries --`;
    return `-- Logs begin at ${new Date(BOOT_T).toISOString()} --\n`+lines.join('\n');
  },
  logger(args){
    const msg=args.join(' ');
    VFS.appendFile('/var/log/syslog',`${new Date().toISOString()} ${ENV.v.HOSTNAME} ${ENV.v.USER}: ${msg}\n`);
    return '';
  },
  sysctl(args){
    const show={
      'kernel.hostname':ENV.v.HOSTNAME,
      'kernel.ostype':'Linux',
      'kernel.osrelease':'6.1.0-htmlinux',
      'kernel.version':'#1 SMP PREEMPT_DYNAMIC',
      'vm.swappiness':'60',
      'net.ipv4.ip_forward':'0',
    };
    if(args[0]==='-a')return Object.entries(show).map(([k,v])=>`${k} = ${v}`).join('\n');
    if(args[0]&&!args[0].startsWith('-')){
      if(args[0].includes('='))[...show[args[0].split('=')[0]]||''];
      return show[args[0]]!==undefined?`${args[0]} = ${show[args[0]]}`:'';}
    return 'sysctl: usage: sysctl [-a] [variable[=value]]';
  },

  // ── Misc ──────────────────────────────────────────────────────────
  history(args){if(args[0]==='-c'){Hist.clear();return '';}return Hist.all().map((e,i)=>`${String(i+1).padStart(5)}  ${e}`).join('\n');},
  alias(args){if(!args.length)return Object.entries(Shell.aliases).map(([k,v])=>`alias ${k}='${v}'`).join('\n');for(const a of args){if(a.includes('=')){const[k,...r]=a.split('=');Shell.aliases[k]=r.join('=').replace(/^['"]|['"]$/g,'');}}return '';},
  unalias(args){for(const a of args)delete Shell.aliases[a];return '';},
  source(args){const f=args[0];if(!f)return 'source: filename argument required';const c=VFS.readFile(f,ENV.cwd);if(!c)return `source: ${f}: No such file`;for(const l of c.split('\n').filter(l=>l.trim()&&!l.trim().startsWith('#')))Shell.exec(l);return '';},
  yes(args){return Array(20).fill(args[0]||'y').join('\n');},
  true:()=>'',
  false:()=>'',
  test(args){
    if(args[0]==='-f')return VFS.stat(args[1],ENV.cwd)?.t==='f'?'':'1';
    if(args[0]==='-d')return VFS.stat(args[1],ENV.cwd)?.t==='d'?'':'1';
    if(args[0]==='-e')return VFS.exists(args[1],ENV.cwd)?'':'1';
    if(args[0]==='-z')return !args[1]?'':'1';
    if(args[0]==='-n')return args[1]?'':'1';
    if(args[0]==='-r')return VFS.exists(args[1],ENV.cwd)?'':'1';
    if(args[1]==='=')return args[0]===args[2]?'':'1';
    if(args[1]==='!=')return args[0]!==args[2]?'':'1';
    if(args[1]==='-lt')return parseInt(args[0])<parseInt(args[2])?'':'1';
    if(args[1]==='-gt')return parseInt(args[0])>parseInt(args[2])?'':'1';
    if(args[1]==='-eq')return parseInt(args[0])===parseInt(args[2])?'':'1';
    return '';
  },
  expr(args){try{return String(Function('"use strict";return('+args.join(' ')+')')());}catch{return '0';}},
  read(args){const v=args[args.indexOf('-p')!==-1?2:0]||'REPLY';ENV.set(v,'');return '';},

  // ── Fun ───────────────────────────────────────────────────────────
  cowsay(args){const m=args.join(' ')||'Moo!';const b=m.length+2;return ` ${'_'.repeat(b)}\n< ${m} >\n ${'‾'.repeat(b)}\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`;},
  fortune(){const q=['The art of programming is the art of organizing complexity. — Dijkstra','Any fool can write code that a computer can understand. — Fowler','Talk is cheap. Show me the code. — Torvalds','In theory there is no difference between theory and practice. In practice there is. — Yogi Berra','The most dangerous phrase in the language is "We have always done it this way." — Grace Hopper','Walking on water and developing software from a specification are easy if both are frozen. — Edward Berard','sudo make me a sandwich. — xkcd','There are 10 types of people: those who understand binary, and those who do not.','The best code is no code at all. — Jeff Atwood'];return q[Math.floor(Math.random()*q.length)];},
  cowthink(args){const m=args.join(' ')||'Hmm...';const b=m.length+2;return ` ${'_'.repeat(b)}\n( ${m} )\n ${'‾'.repeat(b)}\n        o   ^__^\n         o  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`;},
  sl(){return '      ====        ________                ___________ \n  _D _|  |_______/        \\__I_I_____===__|_________|\n   |(_)---  |   H\\________/ |   |        =|___ ___|  \n   /     |  |   H  |  |     |   |         ||_| |_||  \n  |      |  |   H  |__--------------------| [___] |\n  | ________|___H__/__|_____/[][]~\\_______|       |\n  |/ |   |-----------I_____I [][] []  D   |=======|\n__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__\n |/-=|___|=O=====O=====O=====O   |_____/~\\___/\n  \\_/      \\__/  \\__/  \\__/  \\__/      \\_/';},
  banner(args){const t=args.join(' ')||'Hello!';return `\x1b[1m+${'─'.repeat(t.length+2)}+\n| ${t} |\n+${'─'.repeat(t.length+2)}+\x1b[0m`;},
  matrix(){const c='ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ012345678901234567890'.split('');const r=[];for(let i=0;i<12;i++)r.push(Array.from({length:60},()=>c[Math.floor(Math.random()*c.length)]).join(''));return r.join('\n');},
  lolcat(args){const t=args.join(' ')||'Hello, World!';return [...t].map((c,i)=>`\x1b[${31+(i%6)}m${c}\x1b[0m`).join('');},
  figlet(args){const t=args.join(' ')||'Hello';const art={'H':'|_| |','e':' _\\  ','l':'| |  ','o':' _ )','!':'! ','W':'W W','r':' /',',':' ,',' ':' '};return `  ___ \n |${t.split('').map(c=>art[c]||c).join('')}|\n  ‾‾‾`;},

  // ── JS runtime ────────────────────────────────────────────────────
  js(args){
    if(!args.length)return 'Usage: js [-e "code"] [file.js]';
    if(args[0]==='-e'&&args[1])return runJS(args[1]);
    const c=VFS.readFile(args[0],ENV.cwd);if(c===null)return `js: ${args[0]}: No such file`;
    return runJS(c);
  },

  // ── Help ──────────────────────────────────────────────────────────
  help(){
    return `HTMLinux 1.0 — Built-in Commands
${'─'.repeat(60)}
Navigation:   cd pwd ls
Files:        cat head tail tac rev nl fold touch cp mv rm
              mkdir rmdir ln readlink stat file realpath
              basename dirname mktemp
Text:         echo printf grep sed awk sort uniq wc tr cut
              paste join comm diff cmp strings xxd od hexdump
Search:       find locate grep
Compression:  tar gzip gunzip zip unzip split
System:       env export set unset printenv uname date uptime
              ps kill free df du lsblk mount sysctl dmesg
              journalctl logger who w last tty stty
Network:      ping ifconfig ip ss netstat nslookup dig
Crypto:       md5sum sha1sum sha256sum base64
Math:         bc calc seq factor numfmt shuf expr
User:         whoami id su sudo passwd hostname
Cron:         crontab (edit, list, remove)
Packages:     apt [update|install|remove|list|search|show]
              Available: python, node, htop, neofetch, git,
                         curl, wget, vim, lua
Editor:       nano / vi / vim
Fun:          cowsay cowthink fortune sl banner matrix lolcat
Misc:         history alias source watch timeout repeat nohup
              sleep yes true false test time js download upload
              clear reset_fs reboot poweroff

Shell:        VAR=val, VAR=val cmd, cmd > file, cmd >> file
              cmd1 | cmd2, cmd1 && cmd2, cmd1 || cmd2
              if/then/fi, for/do/done, while/do/done, functions
              $VAR expansion, $(cmd) subshell, "quoted strings"

Type \x1b[1mman <cmd>\x1b[0m for more info. Tab to autocomplete.`;
  },
  man(args){
    const p={
      ls:'ls [options] [path]\n  -l  long format with permissions\n  -a  show hidden files (dotfiles)\n  -h  human-readable sizes\n  -t  sort by modification time\n  -S  sort by size\n  -r  reverse sort order\n  -R  recursive listing\n  -F  append indicators (/ @ *)',
      grep:'grep [options] pattern [files]\n  -i  case insensitive\n  -v  invert match\n  -n  show line numbers\n  -r  recursive directory search\n  -c  count matches only\n  -l  list matching files only\n  -o  only matching part\n  -F  fixed string (no regex)\n  -E  extended regex\n  -w  whole word match',
      find:'find [path] [options]\n  -name pattern   match filename glob\n  -type f|d|l     file type\n  -maxdepth n     limit depth\n  -exec cmd {}    execute command',
      nano:'nano [file]\n  ^O  Write (save)\n  ^X  Exit\n  ^K  Cut line to buffer\n  ^U  Paste buffer\n  ^W  Search forward\n  \\   Replace\n  ^A  Beginning of line\n  ^E  End of line\n  ^R  Insert file\n  ^C  Show position',
      apt:'apt [command] [package]\n  update          Refresh package list\n  install <pkg>   Install package\n  remove <pkg>    Remove package\n  list [filter]   List packages\n  search <query>  Search packages\n  show <pkg>      Show package details\n  upgrade         Upgrade all packages\n\nAvailable packages: python, node, htop, neofetch, git, curl, wget, vim, lua',
      bash:'bash — Bourne Again SHell\n  Builtins: cd, pwd, echo, export, unset, source, alias\n  Control:  if/then/elif/else/fi, for/in/do/done,\n            while/do/done, case/in/esac\n  Operators: &&, ||, |, >, >>, <, 2>\n  Variables: $VAR, ${VAR}, $?, $!, $$, $#, $@\n  Quoting: "double" or \'single\' quotes\n  Subshell: $(cmd) or `cmd`',
    };
    const cmd=args[0];
    if(!cmd)return 'What manual page do you want?\nFor example: man ls';
    if(p[cmd])return `MANUAL PAGE: ${cmd.toUpperCase()}\n\nSYNOPSIS\n  ${p[cmd]}`;
    return `No manual entry for ${cmd}\nTry: man [ls|grep|find|nano|apt|bash]`;
  },

  // ── File I/O (browser) ────────────────────────────────────────────
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
      inp.value='';TERM.unlock();TERM.updatePrompt();
    };
    inp.click();TERM.lock();return '';
  },
  reset_fs(){if(confirm('Reset filesystem to defaults? All data will be lost.')){VFS.reset();return 'Filesystem reset to defaults.';}return 'Cancelled.';},
  reboot(){TERM.writeln('\x1b[1mSystem is going down for reboot NOW!\x1b[0m');setTimeout(()=>location.reload(),1500);return '';},
  poweroff(){TERM.writeln('\x1b[1mSystem is shutting down...\x1b[0m');setTimeout(()=>{document.body.style.background='#000';document.body.innerHTML='<div style="color:#333;font-family:monospace;padding:10px">[ 0.000000] System halted.</div>';},1500);return '';},
  exit(args){TERM.writeln(`logout`);return '';},
  logout:()=>CMDS.exit([]),

  // ── JSON processor (basic jq) ─────────────────────────────────────
  jq(args){
    let filter='.';const ps=[];
    for(const a of args){if(!a.startsWith('-')&&!VFS.exists(a,ENV.cwd)&&a!=='.')filter=a;else if(!a.startsWith('-'))ps.push(a);}
    if(!ps.length)return 'jq: no input file';
    return ps.map(p=>{
      const c=VFS.readFile(p,ENV.cwd);if(!c)return `jq: ${p}: No such file`;
      try {
        const data=JSON.parse(c);
        if(filter==='.')return JSON.stringify(data,null,2);
        if(filter.startsWith('.'))return JSON.stringify(filter.slice(1).split('.').reduce((o,k)=>o?.[k],data),null,2);
        return JSON.stringify(data,null,2);
      } catch(e){return `jq: parse error: ${e.message}`;}
    }).join('\n');
  },

  // ── Autocomplete helper ───────────────────────────────────────────
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

// Fix echo overwrite
CMDS.echo = function(args){
  let n=false,e2=false;const ps=[];
  for(const a of args){if(a==='-n')n=true;else if(a==='-e')e2=true;else ps.push(a);}
  let out=ps.map(p=>ENV.expand(p)).join(' ');
  if(e2)out=out.replace(/\\n/g,'\n').replace(/\\t/g,'\t').replace(/\\033\[/g,'\x1b[').replace(/\\e\[/g,'\x1b[').replace(/\\\\/g,'\\');
  return out+(n?'':'');
};

// Fix sort overwrite
CMDS.sort = function(args){
  let r=false,u=false,n2=false,f=false;let field=0;const ps=[];
  for(let i=0;i<args.length;i++){
    if(args[i]==='-r')r=true;else if(args[i]==='-u')u=true;
    else if(args[i]==='-n')n2=true;else if(args[i]==='-f')f=true;
    else if((args[i]==='-k')&&args[i+1])field=parseInt(args[++i])-1;
    else ps.push(args[i]);
  }
  if(!ps.length)return 'sort: no input';
  let lines=ps.map(p=>VFS.readFile(p,ENV.cwd)||'').join('\n').split('\n');
  if(u)lines=[...new Set(lines)];
  lines.sort((a,b)=>{let av=field?a.split(/\s+/)[field]||a:a;let bv=field?b.split(/\s+/)[field]||b:b;if(f){av=av.toLowerCase();bv=bv.toLowerCase();}return n2?parseFloat(av)-parseFloat(bv):av.localeCompare(bv);});
  if(r)lines.reverse();
  return lines.join('\n');
};

// Aliases
CMDS['['] = CMDS.test;
CMDS['ll'] = (a)=>CMDS.ls(['-la',...a]);
CMDS['la'] = (a)=>CMDS.ls(['-A',...a]);
CMDS['l']  = (a)=>CMDS.ls(['-CF',...a]);
CMDS['cls'] = ()=>{ CMDS.clear(); return ''; };
CMDS['.']  = CMDS.source;

// ================================================================
// SHELL — command interpreter with scripting support
// ================================================================

// ================================================================
// PACKAGE MANAGER
// ================================================================
// scope aliases
var CMDS = window.CMDS;

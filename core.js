'use strict';
// ================================================================
//  BROWSERLINUX 2.0 — Raw Kernel Edition
//  Design: pure black/white tty aesthetic
//  Added features over v1:
//    - cron/at job scheduler
//    - shell scripting (if/for/while/functions)
//    - pipe chains with stdin buffering
//    - more text tools: paste, join, tac, rev, nl, fold, column
//    - bc calculator with full expressions
//    - watch command
//    - diff / patch
//    - crontab / at
//    - passwd (fake)
//    - su / sudo
//    - mount / umount (virtual)
//    - sysctl
//    - journalctl / dmesg
//    - hexdump
//    - od
//    - split / csplit
//    - comm
//    - tee (with stdin from piped output)
//    - mktemp
//    - realpath
//    - basename / dirname
//    - stat
//    - file (type detection)
//    - lsattr / chattr
//    - ln hard links
//    - readlink
//    - tty
//    - stty
//    - env -i
//    - printenv
//    - nohup (stub)
//    - screen (stub REPL)
//    - tmux (stub)
//    - ssh (stub)
//    - ftp (stub)
//    - rsync (stub)
//    - cmp
//    - seq
//    - shuf
//    - factor
//    - numfmt
//    - timeout
//    - repeat
//    - jq (basic JSON processor)
// ================================================================

window.BOOT_T = Date.now();

// ── Helpers ──────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
window.delay = ms => new Promise(r => setTimeout(r, ms));

function humanSize(b) {
  if (b < 1024) return b + 'B';
  if (b < 1048576) return (b/1024).toFixed(1)+'K';
  if (b < 1073741824) return (b/1048576).toFixed(1)+'M';
  return (b/1073741824).toFixed(1)+'G';
}

// ================================================================
// VFS — Virtual Filesystem
// ================================================================
window.VFS = (() => {
  const KEY = 'hl_fs_v1';
  let fs = {};

  const DEFAULTS = {
    '/':                    { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/bin':                 { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/usr':                 { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/usr/bin':             { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/usr/local':           { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/usr/local/bin':       { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/usr/share':           { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/usr/share/man':       { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/etc':                 { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/home':                { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/home/user':           { t:'d', m:0o700, u:1000, g:1000, mt:0 },
    '/home/user/Documents': { t:'d', m:0o755, u:1000, g:1000, mt:0 },
    '/home/user/Downloads': { t:'d', m:0o755, u:1000, g:1000, mt:0 },
    '/home/user/scripts':   { t:'d', m:0o755, u:1000, g:1000, mt:0 },
    '/tmp':                 { t:'d', m:0o1777, u:0, g:0, mt:0 },
    '/var':                 { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/var/log':             { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/var/run':             { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/var/spool':           { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/var/spool/cron':      { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/proc':                { t:'d', m:0o555, u:0, g:0, mt:0 },
    '/dev':                 { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/mnt':                 { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/opt':                 { t:'d', m:0o755, u:0, g:0, mt:0 },
    '/root':                { t:'d', m:0o700, u:0, g:0, mt:0 },
    '/dev/null':            { t:'f', m:0o666, u:0, g:0, mt:0, c:'' },
    '/dev/urandom':         { t:'f', m:0o444, u:0, g:0, mt:0, c:'' },
    '/dev/zero':            { t:'f', m:0o444, u:0, g:0, mt:0, c:'' },
    '/etc/hostname':        { t:'f', m:0o644, u:0, g:0, mt:0, c:'htmlinux\n' },
    '/etc/os-release':      { t:'f', m:0o644, u:0, g:0, mt:0,
      c:'PRETTY_NAME="HTMLinux 1.0.0 LTS"\nNAME="HTMLinux"\nVERSION_ID="2.0"\nVERSION="2.0.0 LTS (Kernel Edition)"\nID=htmlinux\nID_LIKE=debian\n' },
    '/etc/passwd':          { t:'f', m:0o644, u:0, g:0, mt:0,
      c:'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\nnobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin\nuser:x:1000:1000:User,,,:/home/user:/bin/bash\n' },
    '/etc/shadow':          { t:'f', m:0o640, u:0, g:42, mt:0,
      c:'root:$6$salt$hash:19000:0:99999:7:::\nuser:$6$salt$hash:19000:0:99999:7:::\n' },
    '/etc/group':           { t:'f', m:0o644, u:0, g:0, mt:0,
      c:'root:x:0:\ndaemon:x:1:\nsudo:x:27:user\nadm:x:4:user\nuser:x:1000:\n' },
    '/etc/fstab':           { t:'f', m:0o644, u:0, g:0, mt:0,
      c:'# <file system> <mount point>   <type>  <options>       <dump>  <pass>\nlocalStorage /               vfs     defaults                0       1\ntmpfs        /tmp            tmpfs   defaults,nosuid,nodev   0       0\n' },
    '/etc/hosts':           { t:'f', m:0o644, u:0, g:0, mt:0,
      c:'127.0.0.1       localhost\n127.0.1.1       htmlinux\n::1             localhost ip6-localhost\n' },
    '/etc/resolv.conf':     { t:'f', m:0o644, u:0, g:0, mt:0,
      c:'nameserver 8.8.8.8\nnameserver 8.8.4.4\nsearch local\n' },
    '/etc/motd':            { t:'f', m:0o644, u:0, g:0, mt:0,
      c:'\nHTMLinux 1.0.0 LTS (kernel)\n\n' },
    '/etc/shells':          { t:'f', m:0o644, u:0, g:0, mt:0,
      c:'/bin/sh\n/bin/bash\n/bin/dash\n/bin/zsh\n' },
    '/etc/profile':         { t:'f', m:0o644, u:0, g:0, mt:0,
      c:'export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\nexport TERM=xterm-256color\nexport LANG=en_US.UTF-8\n' },
    '/etc/crontab':         { t:'f', m:0o644, u:0, g:0, mt:0,
      c:'# /etc/crontab\nSHELL=/bin/bash\nPATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin\n\n# m h dom mon dow user  command\n17 *    * * *   root  cd / && run-parts --report /etc/cron.hourly\n' },
    '/var/log/syslog':      { t:'f', m:0o640, u:0, g:4, mt:0, c:'' },
    '/var/log/auth.log':    { t:'f', m:0o640, u:0, g:4, mt:0, c:'' },
    '/var/log/kern.log':    { t:'f', m:0o640, u:0, g:4, mt:0,
      c:'[    0.000000] Linux version 6.1.0-htmlinux\n[    0.000000] Command line: BOOT_IMAGE=/vmlinuz root=/dev/localStorage\n[    0.100000] HTMLinux VFS: initialised\n' },
    '/proc/version':        { t:'f', m:0o444, u:0, g:0, mt:0,
      c:'Linux version 6.1.0-htmlinux (gcc version 12.2.0) #1 SMP PREEMPT_DYNAMIC\n' },
    '/proc/cmdline':        { t:'f', m:0o444, u:0, g:0, mt:0,
      c:'BOOT_IMAGE=/vmlinuz root=/dev/localStorage ro quiet splash\n' },
    '/proc/uptime':         { t:'f', m:0o444, u:0, g:0, mt:0, c:'' },
    '/proc/loadavg':        { t:'f', m:0o444, u:0, g:0, mt:0, c:'' },
    '/proc/cpuinfo':        { t:'f', m:0o444, u:0, g:0, mt:0,
      c:`processor\t: 0\nvendor_id\t: BrowserVM\ncpu family\t: 6\nmodel\t\t: 165\nmodel name\t: Browser Virtual CPU @ 3.00GHz\nstepping\t: 2\ncpu MHz\t\t: 3000.000\ncache size\t: 8192 KB\nphysical id\t: 0\nsiblings\t: ${navigator.hardwareConcurrency||4}\ncore id\t\t: 0\ncpu cores\t: ${Math.ceil((navigator.hardwareConcurrency||4)/2)}\nflags\t\t: fpu vme de pse tsc msr pae mce cx8 apic\nbogomips\t: 6000.00\n` },
    '/proc/meminfo':        { t:'f', m:0o444, u:0, g:0, mt:0, c:'' },
    '/proc/mounts':         { t:'f', m:0o444, u:0, g:0, mt:0,
      c:'localStorage / vfs rw,relatime 0 0\ntmpfs /tmp tmpfs rw,nosuid,nodev 0 0\nproc /proc proc ro 0 0\n' },
    '/proc/net':            { t:'d', m:0o555, u:0, g:0, mt:0 },
    '/proc/net/dev':        { t:'f', m:0o444, u:0, g:0, mt:0,
      c:'Inter-|   Receive                                  |  Transmit\n face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets\n   lo: 1234567   12345    0    0    0     0          0         0 1234567   12345 0 0 0 0 0 0\n  br0:  567890    5678    0    0    0     0          0         0  234567    2345 0 0 0 0 0 0\n' },
    '/bin/sh':              { t:'l', target:'/bin/bash', m:0o777, u:0, g:0, mt:0 },
    '/bin/bash':            { t:'f', m:0o755, u:0, g:0, mt:0, c:'[builtin]' },
    '/bin/dash':            { t:'l', target:'/bin/bash', m:0o777, u:0, g:0, mt:0 },
    '/usr/bin/env':         { t:'l', target:'/bin/env', m:0o777, u:0, g:0, mt:0 },
    '/home/user/.bashrc':   { t:'f', m:0o644, u:1000, g:1000, mt:0,
      c:'# ~/.bashrc\nexport PS1="\\u@\\h:\\w\\$ "\nexport HISTSIZE=10000\nexport EDITOR=nano\nexport PAGER=less\nalias ll="ls -la"\nalias la="ls -A"\nalias l="ls -CF"\nalias ..="cd .."\nalias ...="cd ../.."\nalias grep="grep --color=auto"\nalias diff="diff --color=auto"\n' },
    '/home/user/.bash_history': { t:'f', m:0o600, u:1000, g:1000, mt:0, c:'' },
    '/home/user/.vimrc':    { t:'f', m:0o644, u:1000, g:1000, mt:0,
      c:'set number\nset tabstop=4\nset shiftwidth=4\nset expandtab\nsyntax on\n' },
    '/home/user/.ssh':      { t:'d', m:0o700, u:1000, g:1000, mt:0 },
    '/home/user/.ssh/authorized_keys': { t:'f', m:0o600, u:1000, g:1000, mt:0, c:'' },
    '/home/user/Documents/notes.txt': { t:'f', m:0o644, u:1000, g:1000, mt:0,
      c:'# My Notes\n\nTODO:\n- learn more shell scripting\n- write a kernel module\n- read APUE\n' },
    '/home/user/scripts/hello.sh': { t:'f', m:0o755, u:1000, g:1000, mt:0,
      c:'#!/bin/bash\n# Simple hello world script\necho "Hello, ${USER:-world}!"\necho "Today is $(date)"\necho "You are running: $SHELL"\n' },
    '/home/user/scripts/sysinfo.sh': { t:'f', m:0o755, u:1000, g:1000, mt:0,
      c:'#!/bin/bash\necho "=== System Information ==="\necho "Hostname: $(hostname)"\necho "Kernel:   $(uname -r)"\necho "Uptime:   $(uptime -p)"\necho "Users:    $(who | wc -l) logged in"\necho "Disk:     $(df -h / | tail -1 | awk \'{print $5}\') used"\n' },
    '/tmp/.keep':           { t:'f', m:0o644, u:0, g:0, mt:0, c:'' },
  };

  function norm(p, cwd='/') {
    if (!p || p === '~') p = '/home/user';
    else if (p.startsWith('~/')) p = '/home/user' + p.slice(1);
    if (!p.startsWith('/')) p = (cwd === '/' ? '' : cwd) + '/' + p;
    const parts = p.split('/').filter(Boolean);
    const out = [];
    for (const x of parts) {
      if (x === '.') continue;
      if (x === '..') out.pop();
      else out.push(x);
    }
    return '/' + out.join('/');
  }

  function resolveLink(p, hops=0) {
    if (hops > 10) return null;
    const n = fs[p];
    if (!n) return null;
    if (n.t === 'l') {
      const tgt = n.target.startsWith('/') ? n.target : norm(n.target, p.split('/').slice(0,-1).join('/')||'/');
      return resolveLink(tgt, hops+1);
    }
    return p;
  }

  return {
    load() {
      try {
        const saved = localStorage.getItem(KEY);
        if (saved) {
          fs = JSON.parse(saved);
          for (const [k,v] of Object.entries(DEFAULTS)) if (!fs[k]) fs[k] = {...v, mt: v.mt || Date.now()};
        } else {
          const now = Date.now();
          for (const [k,v] of Object.entries(DEFAULTS)) fs[k] = {...v, mt: now};
          this.save();
        }
      } catch { this.reset(); }
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(fs)); } catch {} },
    reset() {
      const now = Date.now();
      fs = {};
      for (const [k,v] of Object.entries(DEFAULTS)) fs[k] = {...v, mt: now};
      this.save();
    },
    norm,

    stat(p, cwd='/') {
      const a = norm(p, cwd), r = resolveLink(a);
      return r ? {...fs[r], _path:r} : null;
    },
    lstat(p, cwd='/') {
      const a = norm(p, cwd);
      return fs[a] ? {...fs[a], _path:a} : null;
    },
    exists(p, cwd='/') { const a = norm(p,cwd); return !!(fs[a] || resolveLink(a)); },

    readdir(p, cwd='/') {
      const a = norm(p, cwd), r = resolveLink(a) || a;
      if (!fs[r] || fs[r].t !== 'd') return null;
      const pfx = r === '/' ? '' : r;
      const seen = [];
      for (const k of Object.keys(fs)) {
        const rest = k.slice(pfx.length);
        if (!rest.startsWith('/') || rest.indexOf('/', 1) !== -1) continue;
        if (k === r) continue;
        seen.push({ name: rest.slice(1), path: k, ...fs[k] });
      }
      return seen;
    },

    readFile(p, cwd='/') {
      const a = norm(p, cwd), r = resolveLink(a);
      // Dynamic proc files
      if (r === '/proc/uptime') {
        const s = (Date.now()-BOOT_T)/1000;
        return `${s.toFixed(2)} ${(s*0.9).toFixed(2)}\n`;
      }
      if (r === '/proc/loadavg') {
        return `${(Math.random()*0.5).toFixed(2)} ${(Math.random()*0.3).toFixed(2)} ${(Math.random()*0.2).toFixed(2)} 1/7 1001\n`;
      }
      if (r === '/proc/meminfo') {
        const mem = performance.memory;
        const total = mem ? Math.round(mem.jsHeapSizeLimit/1024) : 8388608;
        const used  = mem ? Math.round(mem.usedJSHeapSize/1024) : 524288;
        const free  = total - used;
        return `MemTotal:       ${total} kB\nMemFree:        ${free} kB\nMemAvailable:   ${free + Math.round(total*0.1)} kB\nBuffers:         ${Math.round(total*0.03)} kB\nCached:          ${Math.round(total*0.12)} kB\nSwapTotal:              0 kB\nSwapFree:               0 kB\n`;
      }
      if (r === '/dev/urandom') {
        return Array.from({length:32}, ()=>Math.floor(Math.random()*256).toString(16).padStart(2,'0')).join('');
      }
      if (!r || !fs[r] || fs[r].t !== 'f') return null;
      return fs[r].c ?? '';
    },

    writeFile(p, content, cwd='/') {
      const a = norm(p, cwd);
      if (fs[a] && fs[a].t === 'd') return false;
      const ex = fs[a];
      fs[a] = { t:'f', m: ex?.m ?? 0o644, u: ex?.u ?? 1000, g: ex?.g ?? 1000, mt: Date.now(), c: content };
      this.save(); return true;
    },
    appendFile(p, txt, cwd='/') {
      return this.writeFile(p, (this.readFile(p,cwd)||'') + txt, cwd);
    },
    mkdir(p, cwd='/') {
      const a = norm(p, cwd);
      if (fs[a]) return false;
      const par = a.lastIndexOf('/') ? a.slice(0, a.lastIndexOf('/')) : '/';
      if (!fs[par] || fs[par].t !== 'd') return false;
      fs[a] = { t:'d', m:0o755, u:1000, g:1000, mt:Date.now() };
      this.save(); return true;
    },
    unlink(p, cwd='/') {
      const a = norm(p, cwd);
      if (!fs[a]) return false;
      delete fs[a]; this.save(); return true;
    },
    rmdir(p, recursive=false, cwd='/') {
      const a = norm(p, cwd);
      if (!fs[a] || fs[a].t !== 'd') return false;
      const entries = this.readdir(a) || [];
      if (entries.length && !recursive) return false;
      if (recursive) {
        for (const e of entries) {
          if (e.t === 'd') this.rmdir(e.path, true);
          else delete fs[e.path];
        }
      }
      delete fs[a]; this.save(); return true;
    },
    rename(s, d, cwd='/') {
      const as = norm(s,cwd), ad = norm(d,cwd);
      if (!fs[as]) return false;
      if (fs[as].t === 'd') {
        for (const k of Object.keys(fs)) {
          if (k === as || k.startsWith(as+'/')) {
            fs[ad + k.slice(as.length)] = fs[k];
            delete fs[k];
          }
        }
      } else { fs[ad] = {...fs[as]}; delete fs[as]; }
      this.save(); return true;
    },
    copyFile(s, d, cwd='/') {
      const c = this.readFile(s, cwd);
      if (c === null) return false;
      return this.writeFile(d, c, cwd);
    },
    symlink(tgt, lp, cwd='/') {
      const a = norm(lp, cwd);
      fs[a] = { t:'l', target:tgt, m:0o777, u:1000, g:1000, mt:Date.now() };
      this.save(); return true;
    },
    chmod(p, mode, cwd='/') {
      const a = norm(p, cwd);
      if (!fs[a]) return false;
      fs[a].m = mode; this.save(); return true;
    },
    size(p, cwd='/') {
      const c = this.readFile(p, cwd);
      return c === null ? 0 : new TextEncoder().encode(c).length;
    },
    fmtMode(mode, t) {
      const tp = t==='d'?'d':t==='l'?'l':'-';
      let s = tp;
      for (let i=8;i>=0;i--) s += ((mode>>i)&1) ? 'rwxrwxrwx'[8-i] : '-';
      return s;
    },
    usedSpace() { return JSON.stringify(fs).length; },
    _raw: () => fs,
  };
})();

// ================================================================
// ENV
// ================================================================
window.ENV = {
  v: {
    HOME:'/home/user', USER:'user', LOGNAME:'user', SHELL:'/bin/bash',
    TERM:'xterm-256color', LANG:'en_US.UTF-8',
    PATH:'/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin',
    PWD:'/home/user', OLDPWD:'/home/user', HOSTNAME:'htmlinux',
    EDITOR:'nano', PAGER:'less', LS_COLORS:'', HISTSIZE:'10000',
    COLUMNS:'220', LINES:'50', SHLVL:'1', _:'bash',
    BROWSER:'chromium', DISPLAY:':0',
  },
  cwd: '/home/user',
  uid: 1000, gid: 1000,
  get(k) { return this.v[k] ?? ''; },
  set(k, val) { this.v[k] = String(val); },
  unset(k) { delete this.v[k]; },
  expand(s) {
    return String(s)
      .replace(/\$\{([^}]+)\}/g, (_,k) => this.v[k]??'')
      .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_,k) => this.v[k]??'');
  },
  prompt() {
    const u = this.v.USER, h = this.v.HOSTNAME;
    const home = this.v.HOME;
    let w = this.cwd === home ? '~' : this.cwd.startsWith(home+'/') ? '~'+this.cwd.slice(home.length) : this.cwd;
    const ch = this.uid === 0 ? '#' : '$';
    return `${u}@${h}:${w}${ch} `;
  },
};

// ================================================================
// ANSI PARSER — maps colors to grayscale CSS classes
// ================================================================
window.ANSI = (() => {
  let s = { fg:null, bg:null, b:false, d:false, i:false, u:false, bl:false, rv:false };
  const reset = () => { s = { fg:null, bg:null, b:false, d:false, i:false, u:false, bl:false, rv:false }; };

  // 16-color → our grayscale class map
  const FG_MAP = {30:'c0',31:'c1',32:'c2',33:'c3',34:'c4',35:'c5',36:'c6',37:'c7',
                  90:'c8',91:'c9',92:'c10',93:'c11',94:'c12',95:'c13',96:'c14',97:'c15'};
  const BG_MAP = {40:'bg1',41:'bg2',42:'bg3',43:'bg4',44:'bg1',45:'bg2',46:'bg3',47:'bg7'};

  function color256(n) {
    // Map all 256 colors to grayscale
    if (n < 8) return '#' + ['484848','a0a0a0','e8e8e8','e8e8e8','b0b0b0','787878','e8e8e8','e8e8e8'][n];
    if (n < 16) return '#' + ['606060','c0c0c0','ffffff','ffffff','e0e0e0','909090','d0d0d0','ffffff'][n-8];
    if (n < 232) { const v = Math.round(((n-16)%6 + Math.floor((n-16)/6)%6 + Math.floor((n-16)/36))/3 * 255/5); return `rgb(${v},${v},${v})`; }
    const v = (n-232)*10+8; return `rgb(${v},${v},${v})`;
  }

  function sgr(params) {
    let i = 0;
    while (i < params.length) {
      const n = params[i];
      if (n===0) reset();
      else if (n===1) s.b=true;
      else if (n===2) s.d=true;
      else if (n===3) s.i=true;
      else if (n===4) s.u=true;
      else if (n===5) s.bl=true;
      else if (n===7) s.rv=true;
      else if (n===22){s.b=false;s.d=false;}
      else if (n===23)s.i=false;
      else if (n===24)s.u=false;
      else if (n===25)s.bl=false;
      else if (n===27)s.rv=false;
      else if (FG_MAP[n]) s.fg={type:'cls',val:FG_MAP[n]};
      else if (BG_MAP[n]) s.bg={type:'cls',val:BG_MAP[n]};
      else if (n===38&&params[i+1]===5){s.fg={type:'color',val:color256(params[i+2])};i+=2;}
      else if (n===48&&params[i+1]===5){s.bg={type:'color',val:color256(params[i+2])};i+=2;}
      else if (n===38&&params[i+1]===2){s.fg={type:'color',val:`rgb(${params[i+2]},${params[i+3]},${params[i+4]})`};i+=4;}
      else if (n===39)s.fg=null;
      else if (n===49)s.bg=null;
      i++;
    }
  }

  function span(txt) {
    if (!txt) return '';
    const esc = txt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const cls=[], st=[];
    if (s.b)  cls.push('b');
    if (s.d)  cls.push('d');
    if (s.i)  cls.push('i');
    if (s.u)  cls.push('u');
    if (s.bl) cls.push('bl');
    if (s.rv) cls.push('rv');
    if (s.fg) { s.fg.type==='cls' ? cls.push(s.fg.val) : st.push(`color:${s.fg.val}`); }
    if (s.bg) { s.bg.type==='cls' ? cls.push(s.bg.val) : st.push(`background:${s.bg.val}`); }
    if (!cls.length && !st.length) return esc;
    let attr = '';
    if (cls.length) attr += ` class="${cls.join(' ')}"`;
    if (st.length)  attr += ` style="${st.join(';')}"`;
    return `<span${attr}>${esc}</span>`;
  }

  return {
    parse(str) {
      reset();
      const parts = String(str).split(/(\x1b\[[0-9;]*[A-Za-z]|\x1b[^[])/);
      let html = '';
      for (const p of parts) {
        if (!p) continue;
        if (p.startsWith('\x1b[')) {
          const cmd = p[p.length-1];
          const ps = p.slice(2,-1);
          if (cmd==='m') sgr(ps?ps.split(';').map(Number):[0]);
        } else if (!p.startsWith('\x1b')) {
          html += span(p);
        }
      }
      return html;
    },
    strip(s) { return String(s).replace(/\x1b\[[0-9;]*[A-Za-z]/g,'').replace(/\x1b./g,''); },
  };
})();

// ================================================================
// History
// ================================================================
window.Hist = (() => {
  const K = 'hl_history';
  let e=[], p=-1;
  return {
    load() { try { e=JSON.parse(localStorage.getItem(K)||'[]'); } catch{e=[];} p=e.length; },
    save() { try { localStorage.setItem(K, JSON.stringify(e.slice(-10000))); } catch{} },
    push(c) { if (c&&c!==e[e.length-1]) e.push(c); this.save(); p=e.length; },
    prev() { if(p>0)p--; return e[p]||''; },
    next() { if(p<e.length-1){p++;return e[p];} p=e.length; return ''; },
    all() { return [...e]; },
    reset() { p=e.length; },
    clear() { e=[]; p=0; this.save(); },
  };
})();

// ================================================================
// TERM — Output engine
// ================================================================
window.TERM = (() => {
  const out = $('output');
  const inp = $('cmd-input');
  const ps  = $('prompt-span');
  const acb = $('ac-box');
  let locked = false;
  let acItems = [], acIdx = -1;

  function writeHTML(html) {
    const d = document.createElement('div');
    d.className = 'ln';
    d.innerHTML = html;
    out.appendChild(d);
    scroll();
  }
  function write(txt) {
    const lines = String(txt).split('\n');
    lines.forEach((l, i) => {
      if (i===0 && out.lastChild?.classList.contains('ln')) {
        out.lastChild.innerHTML += ANSI.parse(l);
      } else writeHTML(ANSI.parse(l));
    });
    scroll();
  }
  function writeln(txt='') { write(txt+'\n'); }
  function scroll() { requestAnimationFrame(()=>{ out.scrollTop=out.scrollHeight; }); }
  function clear() { out.innerHTML=''; }
  function updatePrompt() {
    const p = ENV.prompt();
    ps.textContent = p;
    // Update statusbar
    const u=ENV.v.USER, h=ENV.v.HOSTNAME;
    let w=ENV.cwd; if(w.startsWith(ENV.v.HOME))w='~'+w.slice(ENV.v.HOME.length);
    $('statusbar-left').textContent = `${u}@${h} — ${w}`;
    const now = new Date();
    $('statusbar-right').textContent = now.toTimeString().slice(0,5);
  }
  function resize() {
    inp.style.height='auto';
    inp.style.height=inp.scrollHeight+'px';
  }
  function showAC(items) {
    acItems=items; acIdx=-1;
    acb.innerHTML='';
    if (!items.length){acb.style.display='none';return;}
    items.forEach((item,i)=>{
      const d=document.createElement('div');
      d.className='ac-item'; d.textContent=item;
      d.addEventListener('mousedown',e=>{e.preventDefault();selectAC(i);});
      acb.appendChild(d);
    });
    acb.style.display='block';
  }
  function hideAC() { acb.style.display='none'; acItems=[]; acIdx=-1; }
  function selectAC(i) {
    const val=inp.value, parts=val.split(' ');
    parts[parts.length-1]=acItems[i];
    inp.value=parts.join(' ')+(acItems[i].endsWith('/')?'':' ');
    hideAC(); inp.focus();
  }
  return {
    write, writeln, writeHTML, clear, updatePrompt, resize,
    showAC, hideAC,
    lock()  {locked=true; inp.disabled=true;},
    unlock(){locked=false;inp.disabled=false;inp.focus();},
    isLocked:()=>locked,
    focus(){inp.focus();},
    getValue(){return inp.value;},
    setValue(v){inp.value=v;resize();},
    clearInput(){inp.value='';resize();},
    scroll,
    get acItems(){return acItems;},
    get acIdx(){return acIdx;},
    set acIdx(v){acIdx=v;},
    out,
  };
})();

// Update statusbar clock every second
setInterval(()=>{ const n=new Date(); $('statusbar-right').textContent=n.toTimeString().slice(0,5); }, 1000);

// ================================================================
// NANO EDITOR
// ================================================================
// scope aliases
var VFS = window.VFS;
var ENV = window.ENV;
var ANSI = window.ANSI;
var Hist = window.Hist;
var TERM = window.TERM;
var BOOT_T = window.BOOT_T;
var delay = window.delay;

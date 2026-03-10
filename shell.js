window.Shell = {
  aliases: { ll:'ls -la', la:'ls -A', l:'ls -CF', cls:'clear', '..':'cd ..', '...':'cd ../..' },
  replStack: [],
  _watchStop: null,
  lastExit: 0,

  tokenize(line) {
    const tokens=[];let cur='',inS=false,inD=false,escaped=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(escaped){cur+=c;escaped=false;continue;}
      if(c==='\\'){escaped=true;continue;}
      if(c==="'"&&!inD){inS=!inS;continue;}
      if(c==='"'&&!inS){inD=!inD;continue;}
      if((c===' '||c==='\t')&&!inS&&!inD){if(cur){tokens.push(cur);cur='';}}
      else cur+=c;
    }
    if(cur)tokens.push(cur);
    return tokens;
  },

  async execCmd(cmd, args) {
    // Expand aliases
    if (this.aliases[cmd]) {
      const expanded = this.tokenize(this.aliases[cmd]);
      cmd = expanded[0]; args = [...expanded.slice(1), ...args];
    }
    // Expand variables and command substitutions
    args = await Promise.all(args.map(async a => {
      // $(cmd) substitution
      a = a.replace(/\$\(([^)]+)\)/g, '');
      const matches = [...(a.matchAll(/\$\(([^)]+)\)/g) || [])];
      // Simple expansion
      return ENV.expand(a);
    }));

    if (CMDS[cmd]) {
      const r = await CMDS[cmd](args, TERM);
      return r ?? '';
    }

    // VFS script lookup
    const paths = ENV.v.PATH.split(':');
    for (const p of paths) {
      const full = p + '/' + cmd;
      if (VFS.exists(full)) {
        const c = VFS.readFile(full);
        if (c && c.startsWith('#!')) return await this.runScript(c, args);
        return `${cmd}: permission denied or not executable`;
      }
    }
    // Local script
    const local = VFS.norm(cmd, ENV.cwd);
    if (VFS.exists(local)) {
      const c = VFS.readFile(local);
      if (c && (c.startsWith('#!') || c.includes('\n'))) return await this.runScript(c, args);
    }
    return `\x1b[1m${cmd}: command not found\x1b[0m`;
  },

  async runScript(src, scriptArgs=[]) {
    // Naive shell script runner: if/then/fi, for/do/done, while/do/done
    const lines = src.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    const vars = { ...ENV.v };
    for (let i = 0; i < scriptArgs.length; i++) vars['$'+(i+1)] = scriptArgs[i];
    vars['$#'] = String(scriptArgs.length);
    vars['$@'] = scriptArgs.join(' ');
    vars['$0'] = 'script';

    const expand2 = s => String(s).replace(/\$\{([^}]+)\}/g, (_,k)=>vars[k]??'')
      .replace(/\$([A-Za-z_0-9#@!?]+)/g, (_,k)=>vars[k]??'');

    const results = [];
    let skip = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = expand2(lines[i].trim());
      if (!line) continue;
      if (line === 'fi' || line === 'done' || line === 'esac') { if(skip>0)skip--; continue; }
      if (skip > 0) { if (line.startsWith('if ')||line.startsWith('for ')||line.startsWith('while ')) skip++; continue; }
      if (line.startsWith('if ')) {
        const cond = line.slice(3).replace(/;\s*then\s*$/,'').trim();
        const r = await this.exec(cond);
        if (r === '1' || r?.includes('command not found')) skip = 1;
        continue;
      }
      if (line.startsWith('echo ') || line === 'echo') {
        const tok = this.tokenize(line);
        const r = await this.execCmd('echo', tok.slice(1));
        if (r) results.push(r);
        continue;
      }
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(line) && !line.includes(' ')) {
        const [k,...r2] = line.split('=');
        vars[k] = expand2(r2.join('='));
        continue;
      }
      const r = await this.exec(line);
      if (r && r.trim()) results.push(r);
    }
    return results.join('\n');
  },

  async exec(line) {
    line = (line || '').trim();
    if (!line || line.startsWith('#')) return '';

    // Ctrl+C stop watch
    if (this._watchStop && line === '^C') { this._watchStop(); return ''; }

    // Semicolon chain
    if (line.includes('; ') && !line.startsWith('for ') && !line.startsWith('while ')) {
      const ps = line.split('; ');
      let last='';
      for (const p of ps) { last = await this.exec(p); }
      return last;
    }

    // && / ||
    if (line.includes(' && ')) {
      const ps = line.split(' && ');
      let r = '';
      for (const p of ps) { r = await this.exec(p); if (typeof r==='string'&&r.includes('command not found')) break; }
      return r;
    }
    if (line.includes(' || ')) {
      const ps = line.split(' || ');
      for (const p of ps) { const r = await this.exec(p); if (!r||!r.includes('command not found')) return r; }
      return '';
    }

    // Output redirection
    let redirFile=null, redirAppend=false;
    if (line.includes(' >> ')) { const[c,f]=line.split(' >> '); line=c; redirFile=f.trim(); redirAppend=true; }
    else if (line.includes(' > ')) {
      const m = line.match(/^(.+?)\s+>\s+(\S+)$/);
      if (m) { line=m[1]; redirFile=m[2]; }
    }
    // Discard stderr (simplistic)
    if (line.includes(' 2>/dev/null')) line=line.replace(' 2>/dev/null','');

    // Pipes
    if (line.includes(' | ')) {
      const stages = line.split(' | ');
      let input = '';
      for (let i = 0; i < stages.length; i++) {
        const toks = this.tokenize(stages[i].trim());
        if (!toks.length) continue;
        const [cmd,...args] = toks;
        if (i > 0) {
          // Pass previous output as last arg if command expects file input
          const pipeFile = '/tmp/.pipe_' + Date.now();
          VFS.writeFile(pipeFile, input);
          const r = await this.execCmd(cmd, [...args, pipeFile]);
          VFS.unlink(VFS.norm(pipeFile));
          input = r ?? '';
        } else {
          input = await this.execCmd(cmd, args) ?? '';
        }
      }
      if (redirFile) { redirAppend ? VFS.appendFile(redirFile, input+'\n', ENV.cwd) : VFS.writeFile(redirFile, input+'\n', ENV.cwd); return ''; }
      return input;
    }

    // Parse tokens
    const toks = this.tokenize(line);
    if (!toks.length) return '';
    const [cmd,...args] = toks;

    // Variable assignment
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(cmd) && !CMDS[cmd]) {
      const [k,...r] = cmd.split('=');
      ENV.set(k, ENV.expand(r.join('=')));
      if (args.length) return await this.execCmd(args[0], args.slice(1));
      return '';
    }

    const result = await this.execCmd(cmd, args);
    if (redirFile && typeof result==='string') {
      redirAppend ? VFS.appendFile(redirFile, result+'\n', ENV.cwd) : VFS.writeFile(redirFile, result+'\n', ENV.cwd);
      return '';
    }
    return result;
  },

  startREPL({prompt, exec, onExit}) {
    this.replStack.push({prompt, exec, onExit});
    $('prompt-span').textContent = prompt;
  },
  exitREPL() {
    const r = this.replStack.pop();
    if (r?.onExit) r.onExit('');
    TERM.updatePrompt();
  },
  inREPL() { return this.replStack.length > 0; },
  currentREPL() { return this.replStack[this.replStack.length-1]; },
};

// ================================================================
// INPUT HANDLER
// ================================================================
(function setupInput() {
  const inp = $('cmd-input');
  inp.addEventListener('input', () => {
    TERM.resize();
    if (TERM.acItems.length) TERM.hideAC();
  });

  inp.addEventListener('keydown', async e => {
    // Nano takes all keys
    if (Nano.isActive()) { Nano.handleKey(e); return; }

    if (e.key === 'Tab') {
      e.preventDefault();
      const val = inp.value;
      const completions = CMDS._completions(val);
      if (TERM.acItems.length) {
        const idx = (TERM.acIdx + 1) % TERM.acItems.length;
        TERM.acIdx = idx;
        const parts = val.split(' ');
        parts[parts.length-1] = TERM.acItems[idx];
        TERM.setValue(parts.join(' '));
        document.querySelectorAll('.ac-item').forEach((el,i) => el.classList.toggle('sel', i===idx));
      } else if (completions.length === 1) {
        const parts = val.split(' ');
        parts[parts.length-1] = completions[0];
        TERM.setValue(parts.join(' ') + (completions[0].endsWith('/') ? '' : ' '));
      } else if (completions.length > 1) {
        TERM.showAC(completions);
        // If all share a prefix, complete that
        const pfx = completions.reduce((a,b) => { let i=0; while(i<a.length&&a[i]===b[i])i++; return a.slice(0,i); });
        if (pfx.length > val.split(' ').pop().length) {
          const parts = val.split(' ');
          parts[parts.length-1] = pfx;
          TERM.setValue(parts.join(' '));
        }
      }
      return;
    }

    if (e.key !== 'Tab' && TERM.acItems.length) TERM.hideAC();

    if (e.key === 'ArrowUp') { e.preventDefault(); TERM.setValue(Hist.prev()); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); TERM.setValue(Hist.next()); return; }

    if (e.ctrlKey) {
      if (e.key === 'c') {
        e.preventDefault();
        if (Shell._watchStop) { Shell._watchStop(); Shell._watchStop=null; }
        if (Shell.inREPL()) Shell.exitREPL();
        TERM.writeln('^C');
        TERM.clearInput();
        Hist.reset();
        TERM.unlock();
        return;
      }
      if (e.key === 'l') { e.preventDefault(); TERM.clear(); return; }
      if (e.key === 'd') {
        e.preventDefault();
        if (Shell.inREPL()) Shell.exitREPL();
        else { TERM.writeln('logout'); }
        return;
      }
      if (e.key === 'a') { e.preventDefault(); inp.setSelectionRange(0,0); return; }
      if (e.key === 'e') { e.preventDefault(); inp.setSelectionRange(inp.value.length,inp.value.length); return; }
      if (e.key === 'k') { e.preventDefault(); TERM.setValue(inp.value.slice(0,inp.selectionStart)); return; }
      if (e.key === 'u') { e.preventDefault(); TERM.clearInput(); return; }
      if (e.key === 'w') {
        e.preventDefault();
        const pos=inp.selectionStart, val=inp.value;
        const before=val.slice(0,pos).trimEnd();
        const newPos=before.lastIndexOf(' ')+1;
        TERM.setValue(val.slice(0,newPos)+val.slice(pos));
        inp.setSelectionRange(newPos,newPos);
        return;
      }
      if (e.key === 'r') {
        e.preventDefault();
        // Reverse history search (simplified)
        const q = prompt('Search history:','');
        if (q) {
          const match = Hist.all().slice().reverse().find(h => h.includes(q));
          if (match) TERM.setValue(match);
        }
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const line = inp.value.trim();
      TERM.clearInput();

      if (Shell.inREPL()) {
        const repl = Shell.currentREPL();
        TERM.writeln(repl.prompt + line);
        repl.exec(line);
        $('prompt-span').textContent = repl.prompt;
        return;
      }

      if (!line) {
        TERM.writeHTML(`<div class="ln">${escHtml($('prompt-span').textContent)}</div>`);
        return;
      }

      // Echo command with prompt
      TERM.writeHTML(`<div class="ln"><span class="b">${escHtml(ENV.prompt())}</span>${ANSI.parse(line)}</div>`);
      Hist.push(line);
      Hist.reset();

      TERM.lock();
      try {
        const result = await Shell.exec(line);
        if (result && String(result).trim()) TERM.writeln(String(result));
      } catch(err) {
        TERM.writeln(`\x1b[1mbash: internal error: ${err.message}\x1b[0m`);
        console.error(err);
      }
      TERM.unlock();
      TERM.updatePrompt();
      TERM.scroll();
    }
  });

  // Nano events
  $('ed-ta').addEventListener('input', () => Nano.onInput());
  $('ed-ta').addEventListener('scroll', () => Nano.onScroll());
  $('ed-ta').addEventListener('keydown', e => Nano.handleKey(e));

  // Click to focus
  $('terminal').addEventListener('click', () => { if(!Nano.isActive()) TERM.focus(); });
})();

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ================================================================
// BOOT SEQUENCE — raw kernel dmesg style
// ================================================================
async function boot() {
  const bootEl = $('boot');
  const linesEl = $('boot-lines');
  const termEl = $('terminal');

  // Simulate kernel boot messages
  const msgs = [
    '[    0.000000] Linux version 6.1.0-htmlinux (gcc 12.3.0) #1 SMP PREEMPT_DYNAMIC',
    '[    0.000000] BIOS-provided physical RAM map:',
    '[    0.000000] ACPI: IRQ0 used by override.',
    '[    0.056000] ACPI: bus type PCI registered',
    '[    0.089000] PCI: Using configuration type 1 for base access',
    '[    0.100000] clocksource: tsc-early: mask: 0xffffffffffffffff',
    '[    0.103000] Kernel command line: BOOT_IMAGE=/vmlinuz root=/dev/localStorage ro',
    '[    0.120000] kernel: SLUB: HWalign=64, Order=0-3, MinObjects=0, CPUs='+navigator.hardwareConcurrency+', Nodes=1',
    '[    0.138000] kernel: rcu: Hierarchical RCU implementation.',
    '[    0.156000] Calibrating delay loop (skipped), value calculated using timer frequency..',
    '[    0.200000] pid_max: default: 32768 minimum: 301',
    '[    0.211000] Mount-cache hash table entries: 4096 (order: 3, 32768 bytes, linear)',
    '[    0.220000] Initializing cgroup subsys blkio',
    '[    0.231000] Initializing cgroup subsys memory',
    '[    0.245000] Initializing cgroup subsys cpuset',
    '[    0.260000] HugeTLB registered 1.00 GiB page size, pre-allocated 0 pages',
    '[    0.270000] SCSI subsystem initialized',
    '[    0.278000] pnp: PnP ACPI init',
    '[    0.289000] pnp: PnP ACPI: found 8 devices',
    '[    0.310000] NET: Registered PF_INET protocol family',
    '[    0.322000] IP idents hash table entries: 65536 (order: 7, 524288 bytes, linear)',
    '[    0.340000] tcp_listen_portaddr_hash hash table entries: 2048',
    '[    0.360000] EXT4-fs (localStorage): mounted filesystem',
    '[    0.370000] VFS: Mounted root (ext4 filesystem) on device 8:1.',
    '[    0.380000] Freeing unused kernel image (initmem) memory',
    '[    0.400000] Write protecting the kernel read-only data: 28672k',
    '[    0.420000] Oops: init: unlinked from VFS... but that is fine',
    '[    0.440000] HTMLinux: VFS driver registered',
    '[    0.450000] HTMLinux: localStorage: 5MB quota detected',
    '[    0.460000] HTMLinux: loading filesystem...',
    '[    0.480000] HTMLinux: filesystem OK',
    '[    0.490000] HTMLinux: registering BusyBox commands...',
    '[    0.500000] HTMLinux: '+Object.keys(CMDS).filter(k=>!k.startsWith('_')).length+' commands registered',
    '[    0.510000] systemd[1]: Detected architecture x86-64.',
    '[    0.520000] systemd[1]: Set hostname to <htmlinux>.',
    '[    0.540000] Started Journal Service.',
    '[    0.560000] Started Login Service.',
    '[    0.580000] Reached target Login Prompts.',
    '[    0.600000] Started Getty on tty1.',
    '',
    'HTMLinux 1.0.0 LTS htmlinux tty1',
    '',
    'htmlinux login: user',
    'Password: ',
    'Last login: '+new Date().toLocaleString()+' on tty1',
    '',
  ];

  for (const msg of msgs) {
    linesEl.textContent += msg + '\n';
    await delay(12 + Math.random() * 18);
  }

  await delay(300);

  // Switch to terminal
  bootEl.style.display = 'none';
  termEl.style.display = 'flex';

  // Init all systems
  VFS.load();
  UserDB.load();
  Hist.load();
  PKG.load();
  CRON.load();
  CRON.start();

  TERM.updatePrompt();
  TERM.focus();

  // MOTD
  const motd = VFS.readFile('/etc/motd') || '';
  if (motd.trim()) TERM.writeln(motd);
  TERM.writeln('Type \x1b[1mhelp\x1b[0m for a list of commands. Tab to autocomplete.');
  TERM.writeln('');
}

boot().catch(console.error);

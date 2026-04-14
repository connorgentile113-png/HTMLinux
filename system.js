window.PKG = (() => {
  const KEY='hl_pkgs';
  const META_KEY='hl_pkgs_meta';
  const HIST_KEY='hl_pkg_hist';
  let inst={};
  let meta={auto:{},hold:{},cache:{},files:{},history:[]};

  const REGISTRY = {
    python: {
      ver:'3.11.5', desc:'Python 3 interpreter', size:'28.5 MB',
      deps:[], suggests:['python3-pip','python3-venv'],
      install() {
        const interp = CMDS['python3'] = CMDS['python'] = async (args, st) => {
          if (args[0]==='-c'&&args[1]) return runPython(args[1]);
          if (args[0]&&!args[0].startsWith('-')) {
            const c=VFS.readFile(args[0],ENV.cwd);
            if(c===null)return `python3: can't open file '${args[0]}'`;
            return runPython(c);
          }
          TERM.writeln('Python 3.11.5 (HTMLinux) — Type "exit()" to quit');
          return new Promise(res=>{
            Shell.startREPL({ prompt:'>>> ',
              exec(l){ if(l==='exit()'||l==='quit()'){Shell.exitREPL();res('');return;} const r=runPython(l); if(r)TERM.writeln(r); },
              onExit:res });
          });
        };
      }
    },
    node: {
      ver:'20.9.0', desc:'Node.js JavaScript runtime', size:'82.3 MB',
      deps:[], suggests:['npm'],
      install() {
        CMDS['node']=CMDS['nodejs']=async(args)=>{
          if(args[0]==='-e'&&args[1]) return runJS(args[1]);
          if(args[0]&&!args[0].startsWith('-')){
            const c=VFS.readFile(args[0],ENV.cwd);
            if(c===null)return `node: '${args[0]}': no such file`;
            return runJS(c);
          }
          TERM.writeln('Node.js v20.9.0 (HTMLinux) — Type ".exit" to quit');
          return new Promise(res=>{
            Shell.startREPL({ prompt:'> ',
              exec(l){if(l==='.exit'){Shell.exitREPL();res('');return;} TERM.writeln(runJS(l));},
              onExit:res });
          });
        };
        CMDS['npm']=(args)=>{
          const sub=args[0];
          if(!sub)return 'npm <command>\nCommon: npm install, npm run, npm init, npm list';
          if(sub==='install'||sub==='i'){
            const pkg=args[1];
            if(!pkg)return 'npm warn: no packages installed\nnpm info: To install a package, run:\n  npm install <package>';
            TERM.writeln(`npm: fetching ${pkg}...`);
            return `+ ${pkg}@1.0.0\nadded 1 package in 0.5s\n(simulated — no real npm in browser)`;
          }
          if(sub==='run'){const script=args[1];if(!script)return 'npm error: missing script name';return `> script\n> ${script}\n(npm run: simulated)`;}
          if(sub==='init')return 'npm: wrote package.json\n(simulated)';
          if(sub==='list'||sub==='ls')return 'htmlinux@1.0.0\n(no dependencies)';
          if(sub==='-v'||sub==='--version')return '10.2.0';
          return `npm: '${sub}' is not a recognized npm command`;
        };
      }
    },
    htop: {
      ver:'3.3.0', desc:'Interactive process viewer (TUI)', size:'232 KB',
      deps:[], suggests:[],
      install() {
        CMDS['htop']=async()=>{
          showHtop();
          return new Promise(r=>document.addEventListener('htop-close',()=>r(''),{once:true}));
        };
      }
    },
    neofetch: {
      ver:'7.3.0', desc:'CLI system information tool', size:'88 KB',
      deps:[], suggests:[],
      install() {
        CMDS['neofetch']=()=>{
          const now=new Date(), up=Math.floor((now-BOOT_T)/1000);
          const uh=Math.floor(up/3600), um=Math.floor((up%3600)/60), us=up%60;
          const upStr=uh?`${uh}h ${um}m`:`${um}m ${us}s`;
          const mem=performance.memory;
          const usedMB=mem?Math.round(mem.usedJSHeapSize/1048576):64;
          const totalMB=mem?Math.round(mem.jsHeapSizeLimit/1048576):8192;
          const art=[
            '\x1b[1;36m        .',
            '\x1b[1;36m       /|\\',
            '\x1b[1;36m      / | \\',
            '\x1b[1;36m     /  |  \\',
            '\x1b[1;36m    / . | . \\',
            '\x1b[1;36m   /    |    \\',
            '\x1b[1;36m  /_____|_____\\',
            '\x1b[1;36m        |',
            '\x1b[1;36m        |\x1b[0m',
          ];
          const info=[
            `\x1b[1m${ENV.v.USER}@${ENV.v.HOSTNAME}\x1b[0m`,
            '-'.repeat(18),
            `\x1b[1mOS:\x1b[0m       HTMLinux v2.0 LTS`,
            `\x1b[1mKernel:\x1b[0m   6.1.0-htmlinux`,
            `\x1b[1mShell:\x1b[0m    bash 5.2.15`,
            `\x1b[1mTerminal:\x1b[0m browser-tty`,
            `\x1b[1mCPU:\x1b[0m      Browser vCPU x${navigator.hardwareConcurrency||4}`,
            `\x1b[1mMemory:\x1b[0m   ${usedMB}MiB / ${totalMB}MiB`,
            `\x1b[1mUptime:\x1b[0m   ${upStr}`,
            `\x1b[1mLocale:\x1b[0m   ${ENV.v.LANG}`,
            `\x1b[1mStorage:\x1b[0m  ${Math.round(VFS.usedSpace()/1024)}K (localStorage)`,
            '',
            '\x1b[40m   \x1b[41m   \x1b[42m   \x1b[43m   \x1b[44m   \x1b[45m   \x1b[46m   \x1b[47m   \x1b[0m',
          ];
          const rows=[];
          for(let i=0;i<Math.max(art.length,info.length);i++){
            rows.push(`  ${(art[i]||'').padEnd(28)}  ${info[i]||''}`);
          }
          return rows.join('\n');
        };
      }
    },
    git: {
      ver:'2.43.0', desc:'Distributed version control system', size:'23.8 MB',
      deps:[], suggests:['git-lfs'],
      install() {
        CMDS['git'] = async (args) => {
          const sub = args[0];
          if (!sub || sub === 'help') return [
            'usage: git <command>',
            'Commands: init clone status add commit log diff branch checkout',
            '          stash remote config push pull merge tag show --version'
          ].join('\n');
          if (sub === '--version') return 'git version 2.43.0 (HTMLinux)';

          const repoKey = (dir) => 'hl_git_' + (dir || ENV.cwd);
          const loadR   = (dir) => { try { return JSON.parse(localStorage.getItem(repoKey(dir)) || 'null'); } catch { return null; } };
          const saveR   = (r, dir) => localStorage.setItem(repoKey(dir), JSON.stringify(r));
          const newRepo = () => ({
            commits:[], staged:[], branch:'main', branches:['main'],
            stash:[], remotes:{}, tags:[],
            config:{ 'user.name': ENV.v.USER || 'user', 'user.email': (ENV.v.USER||'user')+'@htmlinux' }
          });

          if (sub === 'init') {
            const r = newRepo();
            saveR(r);
            VFS.mkdir('.git', ENV.cwd);
            VFS.writeFile('.git/HEAD', 'ref: refs/heads/main\n', ENV.cwd);
            VFS.writeFile('.git/config', '[core]\n\trepositoryformatversion = 0\n', ENV.cwd);
            return 'Initialized empty Git repository in ' + ENV.cwd + '/.git/';
          }

          if (sub === 'clone') {
            const url = args[1];
            if (!url) return 'usage: git clone <url> [dir]';
            const ghMatch = url.match(/github\.com\/([\w.\-]+)\/([\w.\-]+)/);
            if (!ghMatch) return 'fatal: only GitHub URLs are supported\nExample: git clone https://github.com/user/repo';
            const [, owner, repoName] = ghMatch;
            const repo    = repoName.replace(/\.git$/, '');
            const destDir = args[2] || repo;
            const destAbs = VFS.norm(destDir, ENV.cwd);

            TERM.writeln("Cloning into '" + destDir + "'...");

            let filesToFetch = [];

            try {
              const jsdResp = await fetch(`https://data.jsdelivr.com/v1/packages/gh/${owner}/${repo}`);
              if (jsdResp.ok) {
                const data = await jsdResp.json();
                const flatten = (files, prefix='') => {
                  for (const f of (files||[])) {
                    if (f.type === 'file') filesToFetch.push(prefix + f.name);
                    else if (f.type === 'directory') flatten(f.files, prefix + f.name + '/');
                  }
                };
                flatten(data.files);
              }
            } catch(e) {}

            if (!filesToFetch.length) {
              try {
                const ghResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`);
                if (ghResp.ok) {
                  const data = await ghResp.json();
                  filesToFetch = (data.tree||[]).filter(f=>f.type==='blob'&&f.size<500000).map(f=>f.path);
                }
              } catch(e) {}
            }

            if (!filesToFetch.length) {
              filesToFetch = [
                'README.md','readme.md','README.txt','LICENSE','LICENSE.md','.gitignore',
                'index.html','index.js','index.ts','index.jsx','index.tsx',
                'main.js','main.ts','main.jsx','main.tsx','main.css','main.py','main.go',
                'app.js','app.ts','app.jsx','app.tsx','app.html','app.css','app.py',
                'package.json','package-lock.json','tsconfig.json','jsconfig.json',
                'vite.config.js','vite.config.ts','webpack.config.js','babel.config.js',
                'tailwind.config.js','next.config.js','nuxt.config.js',
                'setup.py','pyproject.toml','requirements.txt','Pipfile','Cargo.toml',
                'go.mod','Makefile','Dockerfile','docker-compose.yml',
                'src/index.js','src/index.ts','src/App.jsx','src/App.tsx','src/main.js',
                'src/main.ts','src/main.py','src/main.rs','src/styles.css',
                'CHANGELOG.md','CONTRIBUTING.md','.env.example',
              ];
            }

            VFS.mkdir(destAbs);
            VFS.mkdir(destAbs + '/.git');
            VFS.writeFile(destAbs + '/.git/HEAD', 'ref: refs/heads/main\n');

            let fetched = 0, failed = 0;
            const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/`;
            TERM.writeln(`remote: Enumerating objects: ${filesToFetch.length}, done.`);
            for (const fpath of filesToFetch) {
              try {
                const resp = await fetch(rawBase + fpath);
                if (resp.ok) {
                  const text = await resp.text();
                  const parts = fpath.split('/');
                  let dir = destAbs;
                  for (let i = 0; i < parts.length - 1; i++) {
                    dir = dir + '/' + parts[i];
                    VFS.mkdir(dir);
                  }
                  VFS.writeFile(destAbs + '/' + fpath, text);
                  fetched++;
                  if (fetched <= 5 || fetched % 10 === 0)
                    TERM.writeln(`  [${fetched}/${filesToFetch.length}] ${fpath}`);
                } else { failed++; }
              } catch(e) { failed++; }
            }

            if (!fetched) return 'fatal: could not fetch any files\nCheck that the repository exists and is public.';

            const r = newRepo();
            r.remotes['origin'] = { url };
            r.commits.push({ hash: Math.random().toString(36).slice(2,9), msg: 'Initial commit (cloned)', date: new Date().toISOString(), files: [destAbs] });
            saveR(r, destAbs);
            VFS.writeFile(destAbs + '/.git/config',
              '[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\turl = ' + url + '\nfetch = +refs/heads/*:refs/remotes/origin/*\n');

            return `\nReceiving objects: 100% (${fetched}/${filesToFetch.length})\nResolving deltas: done.\n\ncd ${destDir}`;
          }

          const r = loadR();
          if (!r && !['init','clone'].includes(sub))
            return 'fatal: not a git repository (or any of the parent directories): .git';

          switch(sub) {
            case 'status': {
              const entries = VFS.readdir(ENV.cwd) || [];
              const tracked = new Set(r.commits.flatMap(c => c.files || []));
              const untracked = entries.filter(e => e.t==='f' && !e.name.startsWith('.') && !tracked.has(e.name) && !r.staged.includes(e.name));
              return `On branch ${r.branch}\n${
                r.staged.length
                  ? 'Changes to be committed:\n' + r.staged.map(f=>'\t\x1b[32mmodified: '+f+'\x1b[0m').join('\n') + '\n'
                  : 'nothing to commit, working tree clean'
              }${untracked.length ? '\nUntracked files:\n' + untracked.map(e=>'\t'+e.name).join('\n') : ''}`;
            }
            case 'add':
              if (args[1]==='.'||args[1]==='-A') {
                const e = VFS.readdir(ENV.cwd)||[];
                r.staged = e.filter(x=>x.t==='f'&&!x.name.startsWith('.')).map(x=>x.name);
              } else if (args[1] && !r.staged.includes(args[1])) {
                r.staged.push(args[1]);
              }
              saveR(r); return '';
            case 'commit': {
              if (!r.staged.length) return 'nothing to commit, working tree clean';
              const mi = args.indexOf('-m'), msg = mi!==-1 ? args[mi+1] : null;
              if (!msg) return 'error: commit message required\nusage: git commit -m "message"';
              const hash = Math.random().toString(36).slice(2,9);
              r.commits.push({ hash, msg, date:new Date().toISOString(), files:[...r.staged], author: r.config['user.name'] });
              const n = r.staged.length; r.staged = [];
              saveR(r);
              return `[${r.branch} ${hash}] ${msg}\n ${n} file(s) changed`;
            }
            case 'log': {
              if (!r.commits.length) return `fatal: your current branch '${r.branch}' does not have any commits yet`;
              const oneline = args.includes('--oneline');
              return r.commits.slice(-20).reverse().map(c =>
                oneline
                  ? c.hash.slice(0,7) + ' ' + c.msg
                  : `\x1b[33mcommit ${c.hash}\x1b[0m\nAuthor: ${c.author||r.config['user.name']}\nDate:   ${new Date(c.date).toLocaleString()}\n\n    ${c.msg}\n`
              ).join('\n');
            }
            case 'diff':
              return r.staged.map(f => {
                const content = VFS.readFile(f, ENV.cwd) || '';
                const lines = content.split('\n');
                return `diff --git a/${f} b/${f}\n--- a/${f}\n+++ b/${f}\n@@ -0,0 +1,${lines.length} @@\n` + lines.map(l=>'\x1b[32m+'+l+'\x1b[0m').join('\n');
              }).join('\n\n') || '(no staged changes)';
            case 'branch':
              if (args[1]==='-d'||args[1]==='-D') {
                if (args[2]===r.branch) return 'error: Cannot delete the branch you are currently on';
                r.branches = r.branches.filter(b=>b!==args[2]); saveR(r);
                return `Deleted branch ${args[2]}.`;
              }
              if (args[1]) { r.branches.push(args[1]); saveR(r); return ''; }
              return r.branches.map(b=>(b===r.branch?'\x1b[32m* ':'  ')+b+'\x1b[0m').join('\n');
            case 'checkout': {
              const isNew = args[1]==='-b';
              const bname = isNew ? args[2] : args[1];
              if (!bname) return 'usage: git checkout [-b] <branch>';
              if (isNew) { if(r.branches.includes(bname)) return 'fatal: branch already exists'; r.branches.push(bname); }
              else if (!r.branches.includes(bname)) return `error: pathspec '${bname}' did not match any known branch`;
              r.branch = bname; saveR(r);
              return `Switched to${isNew?' new':''} branch '${bname}'`;
            }
            case 'stash':
              if (args[1]==='pop') { if(!r.stash.length) return 'No stash entries found'; r.staged=r.stash.pop(); saveR(r); return 'Dropped stash@{0}'; }
              if (args[1]==='list') return r.stash.map((_,i)=>'stash@{'+i+'}: WIP on '+r.branch).join('\n') || '(empty stash)';
              r.stash.push([...r.staged]); r.staged=[]; saveR(r);
              return 'Saved working directory and index state WIP on ' + r.branch;
            case 'remote':
              if (args[1]==='add') { if(!args[2]||!args[3]) return 'usage: git remote add <n> <url>'; r.remotes[args[2]]={url:args[3]}; saveR(r); return ''; }
              if (args[1]==='-v') return Object.entries(r.remotes).map(([n,{url}])=>n+'\t'+url+' (fetch)\n'+n+'\t'+url+' (push)').join('\n') || '(no remotes)';
              return Object.keys(r.remotes).join('\n') || '(no remotes)';
            case 'config':
              if (args[1]==='--list') return Object.entries(r.config).map(([k,v])=>k+'='+v).join('\n');
              if (args[2]) { r.config[args[1]]=args[2]; saveR(r); return ''; }
              return r.config[args[1]] || '';
            case 'push': return `To ${r.remotes?.origin?.url||'(no remote)'}\n   (push simulated — no git server)`;
            case 'pull': return 'Already up to date.';
            case 'merge': return args[1] ? `Merge made by the 'recursive' strategy.` : 'usage: git merge <branch>';
            case 'tag':
              if (args[1]) { r.tags.push({name:args[1], hash:r.commits.at(-1)?.hash||''}); saveR(r); return ''; }
              return r.tags.map(t=>t.name).join('\n');
            case 'show': {
              const c = r.commits.at(-1);
              if (!c) return 'fatal: no commits yet';
              return `\x1b[33mcommit ${c.hash}\x1b[0m\nAuthor: ${c.author||r.config['user.name']}\nDate:   ${new Date(c.date).toLocaleString()}\n\n    ${c.msg}`;
            }
            case 'shortlog': return r.commits.map(c=>`${c.author||r.config['user.name']} (${r.commits.filter(x=>x.author===c.author).length})\n      ${c.msg}`).join('\n');
            case 'blame': {
              const f=args[1];if(!f)return 'usage: git blame <file>';
              const content=VFS.readFile(f,ENV.cwd)||'';
              return content.split('\n').map((l,i)=>`${(r.commits.at(-1)?.hash||'0000000').slice(0,8)} (${r.config['user.name']} ${new Date().toLocaleDateString()} ${i+1}) ${l}`).join('\n');
            }
            case 'grep': {
              const pat=args[1];if(!pat)return 'usage: git grep <pattern>';
              const re=new RegExp(pat,'g');const results=[];
              const entries=VFS.readdir(ENV.cwd)||[];
              for(const e of entries){if(e.t!=='f')continue;const c=VFS.readFile(e.path)||'';const m=c.match(re);if(m)results.push(`${e.name}:${m.join(', ')}`);}
              return results.join('\n')||'(no matches)';
            }
            default: return `git: '${sub}' is not a git command. See 'git help'.`;
          }
        };
      }
    },
    curl: {
      ver:'8.4.0', desc:'URL data transfer tool', size:'1.2 MB',
      deps:[], suggests:[],
      install() {
        CMDS['curl']=async(args)=>{
          let url='',heads=false,method='GET',silent=false,out=null,data=null,headers={};
          for(let i=0;i<args.length;i++){
            if(args[i]==='-I'||args[i]==='--head')heads=true;
            else if(args[i]==='-s'||args[i]==='--silent')silent=true;
            else if((args[i]==='-o'||args[i]==='--output')&&args[i+1])out=args[++i];
            else if((args[i]==='-X'||args[i]==='--request')&&args[i+1])method=args[++i];
            else if((args[i]==='-d'||args[i]==='--data')&&args[i+1])data=args[++i];
            else if((args[i]==='-H'||args[i]==='--header')&&args[i+1]){const h=args[++i];const[k,v]=h.split(':');headers[k.trim()]=v?.trim();}
            else if(!args[i].startsWith('-'))url=args[i];
          }
          if(!url)return 'curl: no URL specified';
          try {
            const opts={method,headers};
            if(data){opts.body=data;opts.headers['Content-Type']=opts.headers['Content-Type']||'application/x-www-form-urlencoded';}
            const resp=await fetch(url,opts);
            if(heads){
              let h=`HTTP/2 ${resp.status} ${resp.statusText}\r\n`;
              resp.headers.forEach((v,k)=>{h+=`${k}: ${v}\r\n`;});
              return h;
            }
            const text=await resp.text();
            if(out){VFS.writeFile(out,text,ENV.cwd);return silent?'':` 100 ${text.length} 100 ${text.length}`;}
            return text;
          } catch(e){return `curl: (6) Could not resolve host: ${url.split('/')[2]||url}`;}
        };
      }
    },
    wget: {
      ver:'1.21.4', desc:'Non-interactive network downloader', size:'760 KB',
      deps:[], suggests:[],
      install() {
        CMDS['wget']=async(args)=>{
          const url=args.find(a=>!a.startsWith('-'));
          if(!url)return 'wget: missing URL';
          const oi=args.indexOf('-O'), outFile=oi!==-1?args[oi+1]:(url.split('/').pop()||'index.html');
          try {
            TERM.writeln(`--${new Date().toISOString().slice(0,19).replace('T',' ')}--  ${url}`);
            TERM.writeln(`Connecting to ${url.split('/')[2]}... connected.`);
            TERM.writeln(`HTTP request sent, awaiting response...`);
            const resp=await fetch(url);
            const text=await resp.text();
            TERM.writeln(`${resp.status} ${resp.statusText} [${text.length} bytes]`);
            if(outFile==='-')return text;
            VFS.writeFile(outFile,text,ENV.cwd);
            TERM.writeln(`\x1b[1m'${outFile}' saved [${text.length}/${text.length}]\x1b[0m`);
            return '';
          } catch(e){return `wget: cannot connect to ${url.split('/')[2]||url}: Connection refused`;}
        };
      }
    },
    vim: {
      ver:'9.1', desc:'Vi IMproved text editor', size:'3.1 MB',
      deps:[], suggests:[],
      install() { CMDS['vim']=CMDS['vi']=(async(args)=>new Promise(r=>Nano.open(args[0],()=>r('')))); }
    },
    lua: {
      ver:'5.4.6', desc:'Lightweight scripting language', size:'312 KB',
      deps:[], suggests:[],
      install() {
        CMDS['lua']=(args)=>{
          const src=args[0]?VFS.readFile(args[0],ENV.cwd):null;
          if(args[0]&&src===null)return `lua: cannot open '${args[0]}': No such file`;
          const code=src||(args[0]==='-e'?args[1]:'');
          if(!code)return 'Lua 5.4.6 -- HTMLinux (use -e or filename)';
          const out=[];
          try {
            const js=code
              .replace(/\bprint\s*\(/g,'_out.push(String(')
              .replace(/\bend\b/g,'}')
              .replace(/\bthen\b/g,'){')
              .replace(/\bdo\b/g,'{')
              .replace(/\bnot\b/g,'!')
              .replace(/\band\b/g,'&&')
              .replace(/\bor\b/g,'||')
              .replace(/--[^\n]*/g,'')
              .replace(/\bnil\b/g,'null')
              .replace(/function\s+(\w+)\s*\(/g,'function $1(')
              .replace(/\blocal\s+/g,'let ');
            const fn=new Function('_out', js+'; return _out;');
            return fn(out).join('\n');
          } catch(e){return `lua: ${e.message}`;}
        };
      }
    },
    jq: {
      ver:'1.7.1', desc:'Command-line JSON processor', size:'1.1 MB',
      deps:[], suggests:[],
      install() {
        // jq is already in CMDS as a builtin, this upgrades it with more features
        const orig = CMDS['jq'];
        CMDS['jq']=(args)=>{
          let filter='.', raw=false, compact=false, slurp=false;
          const ps=[];
          for(const a of args){
            if(a==='-r'||a==='--raw-output')raw=true;
            else if(a==='-c'||a==='--compact-output')compact=false;
            else if(a==='-s'||a==='--slurp')slurp=true;
            else if(!a.startsWith('-')&&!VFS.exists(a,ENV.cwd)&&a!=='.')filter=a;
            else if(!a.startsWith('-'))ps.push(a);
          }
          if(!ps.length)return 'jq: no input file';
          return ps.map(p=>{
            const c=VFS.readFile(p,ENV.cwd);if(!c)return `jq: ${p}: No such file`;
            try{
              const data=JSON.parse(c);
              const apply=(d,f)=>{
                if(f==='.')return d;
                if(f==='keys')return Array.isArray(d)?[...Array(d.length).keys()]:Object.keys(d);
                if(f==='values')return Array.isArray(d)?d:Object.values(d);
                if(f==='length')return Array.isArray(d)||typeof d==='string'?d.length:Object.keys(d).length;
                if(f==='type')return Array.isArray(d)?'array':typeof d;
                if(f.startsWith('.[]'))return Array.isArray(d)?d:Object.values(d);
                if(f.startsWith('.'))return f.slice(1).split('.').reduce((o,k)=>o?.[k],d);
                return d;
              };
              const result=apply(data,filter);
              if(raw&&typeof result==='string')return result;
              return JSON.stringify(result,null,compact?0:2);
            }catch(e){return `jq: parse error: ${e.message}`;}
          }).join('\n');
        };
      }
    },
    ripgrep: {
      ver:'14.1.0', desc:'Fast recursive search tool (rg)', size:'5.2 MB',
      deps:[], suggests:[],
      install() {
        CMDS['rg']=CMDS['ripgrep']=(args)=>{
          let pattern='', ignoreCase=false, noFilename=false, lineNum=false, count=false;
          const paths=[];
          for(let i=0;i<args.length;i++){
            if(args[i]==='-i'||args[i]==='--ignore-case')ignoreCase=true;
            else if(args[i]==='--no-filename')noFilename=true;
            else if(args[i]==='-n'||args[i]==='--line-number')lineNum=true;
            else if(args[i]==='-c'||args[i]==='--count')count=true;
            else if(!pattern&&!args[i].startsWith('-'))pattern=args[i];
            else if(!args[i].startsWith('-'))paths.push(args[i]);
          }
          if(!pattern)return 'rg: missing pattern';
          const targets=paths.length?paths:['.'];
          const flags=ignoreCase?'gi':'g';
          let re;try{re=new RegExp(pattern,flags);}catch{return `rg: invalid regex: ${pattern}`;}
          const results=[];
          const searchFile=(p,prefix='')=>{
            const content=VFS.readFile(p,ENV.cwd);if(!content)return;
            const lines=content.split('\n');
            if(count){const n=lines.filter(l=>{const m=re.test(l);re.lastIndex=0;return m;}).length;if(n)results.push(`\x1b[35m${prefix||p}\x1b[0m:${n}`);return;}
            lines.forEach((line,idx)=>{
              const match=re.test(line);re.lastIndex=0;
              if(match){
                let out=noFilename?'':(`\x1b[35m${prefix||p}\x1b[0m:`);
                if(lineNum)out+=`\x1b[2m${idx+1}\x1b[0m:`;
                out+=line.replace(re,m=>`\x1b[1;31m${m}\x1b[0m`);re.lastIndex=0;
                results.push(out);
              }
            });
          };
          for(const t of targets){
            const node=VFS.stat(t,ENV.cwd);
            if(node?.t==='d'){const e=VFS.readdir(t,ENV.cwd)||[];e.filter(x=>x.t==='f').forEach(x=>searchFile(x.path,x.path));}
            else searchFile(t,t);
          }
          return results.join('\n');
        };
      }
    },
    fzf: {
      ver:'0.46.1', desc:'Command-line fuzzy finder', size:'3.4 MB',
      deps:[], suggests:[],
      install() {
        CMDS['fzf']=async(args)=>{
          // Show interactive-style fuzzy picker using all files in CWD
          const entries=VFS.readdir(ENV.cwd)||[];
          const names=entries.map(e=>e.name);
          if(!names.length)return '(no files to select)';
          const query=args[0]||'';
          const matches=query?names.filter(n=>n.toLowerCase().includes(query.toLowerCase())):names;
          if(!matches.length)return '';
          TERM.writeln(`\x1b[2m> fuzzy search (${matches.length} matches)\x1b[0m`);
          matches.slice(0,20).forEach((m,i)=>TERM.writeln(`  ${i===0?'\x1b[1;32m>':' '} ${m}\x1b[0m`));
          return matches[0]||'';
        };
      }
    },
    httpie: {
      ver:'3.2.2', desc:'User-friendly HTTP client (http/https cmds)', size:'1.8 MB',
      deps:[], suggests:[],
      install() {
        const makeReq=async(method,args)=>{
          const url=args.find(a=>a.startsWith('http')||a.includes('://'));
          if(!url)return `http: missing URL`;
          const headers={};const body={};
          for(const a of args.filter(a=>a!==url&&!a.startsWith('-'))){
            if(a.includes(':'))headers[a.split(':')[0]]=a.split(':').slice(1).join(':').trim();
            else if(a.includes('='))body[a.split('=')[0]]=a.split('=').slice(1).join('=');
          }
          try{
            const opts={method,headers};
            if(Object.keys(body).length)opts.body=JSON.stringify(body);
            const resp=await fetch(url,opts);
            const text=await resp.text();
            let parsed;try{parsed=JSON.parse(text);}catch{parsed=null;}
            const statusColor=resp.ok?'\x1b[32m':'\x1b[31m';
            return `${statusColor}HTTP/2 ${resp.status} ${resp.statusText}\x1b[0m\n${parsed?JSON.stringify(parsed,null,2):text}`;
          }catch(e){return `http: connection error: ${e.message}`;}
        };
        CMDS['http'] =async(args)=>makeReq('GET',args);
        CMDS['https']=async(args)=>makeReq('GET',args);
        CMDS['httpie']=async(args)=>{const m=args[0]?.toUpperCase()||'GET';return makeReq(m,args.slice(1));};
      }
    },
    tree: {
      ver:'2.1.1', desc:'Display directory tree structure', size:'96 KB',
      deps:[], suggests:[],
      install() {
        CMDS['tree']=(args)=>{
          const target=args.find(a=>!a.startsWith('-'))||'.';
          const maxDepth=parseInt(args[args.indexOf('-L')+1])||5;
          const showHidden=args.includes('-a');
          const lines=[];let dirs=0,files=0;
          const walk=(p,depth,prefix)=>{
            if(depth>maxDepth)return;
            const entries=(VFS.readdir(p,ENV.cwd)||[]).filter(e=>showHidden||!e.name.startsWith('.'));
            entries.sort((a,b)=>{if(a.t!==b.t)return a.t==='d'?-1:1;return a.name.localeCompare(b.name);});
            entries.forEach((e,i)=>{
              const isLast=i===entries.length-1;
              const connector=isLast?'└── ':'├── ';
              const childPrefix=prefix+(isLast?'    ':'│   ');
              const color=e.t==='d'?'\x1b[1;34m':e.t==='l'?'\x1b[1;36m':'';
              lines.push(`${prefix}${connector}${color}${e.name}\x1b[0m${e.t==='l'?` -> ${e.target||'?'}`:''}${e.t==='d'?'/':''}`);
              if(e.t==='d'){dirs++;walk(e.path,depth+1,childPrefix);}else files++;
            });
          };
          const rootName=VFS.norm(target,ENV.cwd).split('/').pop()||target;
          lines.unshift(`\x1b[1;34m${rootName}\x1b[0m`);
          walk(VFS.norm(target,ENV.cwd),1,'');
          lines.push(`\n${dirs} director${dirs===1?'y':'ies'}, ${files} file${files===1?'':'s'}`);
          return lines.join('\n');
        };
      }
    },
    fortune: {
      ver:'1.99.1', desc:'Print a random fortune cookie', size:'8 KB',
      deps:[], suggests:[],
      install() {
        const fortunes=[
          'The art of programming is the art of organizing complexity. — Dijkstra',
          'Any fool can write code that a computer can understand. Good programmers write code that humans can understand. — Fowler',
          'Talk is cheap. Show me the code. — Torvalds',
          'The most dangerous phrase in the language is "We have always done it this way." — Grace Hopper',
          'sudo make me a sandwich. — xkcd',
          'There are 10 types of people: those who understand binary, and those who do not.',
          'The best code is no code at all. — Jeff Atwood',
          'It works on my machine. — Every Developer',
          'First, solve the problem. Then, write the code. — John Johnson',
          "Code is like humor. When you have to explain it, it's bad. \u2014 Cory House",
          'Programs must be written for people to read, and only incidentally for machines to execute. — Abelson',
          'The only way to learn a new programming language is by writing programs in it. — Kernighan',
          'Premature optimization is the root of all evil. — Knuth',
          'Make it work, make it right, make it fast. — Kent Beck',
          "Sometimes it pays to stay in bed on Monday rather than spending the rest of the week debugging Monday\u2019s code. \u2014 Christopher Thompson",
        ];
        CMDS['fortune']=()=>fortunes[Math.floor(Math.random()*fortunes.length)];
      }
    },
    cowsay: {
      ver:'3.04', desc:'Generate ASCII art speech bubbles', size:'4 KB',
      deps:[], suggests:['fortune'],
      install() {
        // cowsay already exists as a builtin, this upgrades it with more cows
        const cows={
          cow:  '        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\ )\\/\\\n                ||----w |\n                ||     ||',
          tux:  '         \\\n          \\\n           .--.\n          |o_o |\n          |:_/ |\n         //   \\ \\\n        (|     | )\n        /\'\\_ _/`\\\n        \\___)=(___/',
          dragon:'         \\\n          \\\n            /\\_/\\    /\\_/\\\n           / o o \\  / o o \\\n          (  =^=  )(  =^=  )\n           \\     /  \\     /\n            \\___/    \\___/',
        };
        CMDS['cowsay']=(args)=>{
          const ci=args.indexOf('-f');const cow=ci!==-1?args[ci+1]:'cow';
          const filtered=args.filter((a,i)=>a!=='-f'&&i!==ci+1);
          const m=filtered.join(' ')||'Moo!';const b=m.length+2;
          const body=cows[cow]||cows.cow;
          return ` ${'_'.repeat(b)}\n< ${m} >\n ${'‾'.repeat(b)}\n${body}`;
        };
        CMDS['cowthink']=(args)=>{
          const m=args.join(' ')||'Hmm...';const b=m.length+2;
          return ` ${'_'.repeat(b)}\n( ${m} )\n ${'‾'.repeat(b)}\n${cows.cow.replace(/\\/g,'o')}`;
        };
      }
    },
    ffmpeg: {
      ver:'6.1', desc:'Multimedia framework (stub)', size:'45.2 MB',
      deps:[], suggests:[],
      install() {
        CMDS['ffmpeg']=(args)=>{
          if(args.includes('-version'))return 'ffmpeg version 6.1 Copyright (c) 2000-2023 the FFmpeg developers (HTMLinux stub)';
          const i=args.indexOf('-i');const o=args[args.length-1];
          if(i!==-1&&o){return `ffmpeg: ${args[i+1]} -> ${o}\n(stub: media conversion is not available in browser)`;}
          return 'ffmpeg: (stub) usage: ffmpeg -i input output\nMedia processing is not available in browser context.';
        };
      }
    },
    imagemagick: {
      ver:'7.1.1', desc:'Image manipulation tools (convert, identify)', size:'38.4 MB',
      deps:[], suggests:[],
      install() {
        CMDS['convert']=(args)=>`convert: (stub) ${args.join(' ')}\nImage conversion is not available in browser context.`;
        CMDS['identify']=(args)=>{
          if(!args[0])return 'identify: missing file';
          return `${args[0]} JPEG 800x600 800x600+0+0 8-bit sRGB 124KB 0.000u 0:00.000\n(stub: image metadata is not available)`;
        };
        CMDS['mogrify']=(args)=>`mogrify: (stub) image transformation not available in browser.`;
      }
    },
    sqlite3: {
      ver:'3.43.2', desc:'Lightweight SQL database engine', size:'1.8 MB',
      deps:[], suggests:[],
      install() {
        // In-memory SQLite-like engine using localStorage
        const dbs={};
        CMDS['sqlite3']=(args)=>{
          const dbFile=args[0]||':memory:';
          if(!dbs[dbFile])dbs[dbFile]={tables:{}};
          const db=dbs[dbFile];
          const sql=args.slice(1).join(' ').trim();
          if(!sql)return `SQLite version 3.43.2\nEnter ".help" for usage hints.\nConnected to ${dbFile}\n\n(pass SQL as argument: sqlite3 db.sqlite "SELECT * FROM table")`;
          try{
            const q=sql.toUpperCase().trim();
            if(q.startsWith('CREATE TABLE')){
              const m=sql.match(/CREATE TABLE\s+(\w+)\s*\((.*?)\)/i);
              if(m){db.tables[m[1]]={cols:m[2].split(',').map(c=>c.trim().split(/\s+/)[0]),rows:[]};return '';}
            }
            if(q.startsWith('INSERT INTO')){
              const m=sql.match(/INSERT INTO\s+(\w+)\s*(?:\((.*?)\))?\s*VALUES\s*\((.*?)\)/i);
              if(m){const t=db.tables[m[1]];if(!t)return `Error: no such table: ${m[1]}`;t.rows.push(m[3].split(',').map(v=>v.trim().replace(/^'|'$/g,'')));return '';}
            }
            if(q.startsWith('SELECT')){
              const m=sql.match(/SELECT\s+(.*?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.*))?/i);
              if(m){const t=db.tables[m[2]];if(!t)return `Error: no such table: ${m[2]}`;return t.rows.map(r=>r.join('|')).join('\n')||'';}
            }
            if(q.startsWith('DROP TABLE')){const tname=sql.split(/\s+/)[2];delete db.tables[tname];return '';}
            if(sql.startsWith('.tables'))return Object.keys(db.tables).join('\n');
            if(sql.startsWith('.schema')){return Object.entries(db.tables).map(([n,t])=>`CREATE TABLE ${n} (${t.cols.join(', ')});`).join('\n');}
            return `Error: near "${sql.slice(0,20)}": syntax error`;
          }catch(e){return `Error: ${e.message}`;}
        };
      }
    },
  };

  function makeGenericCliHandler(primary, pkgMeta={}) {
    const cmdName = primary;
    const desc = pkgMeta.desc || `${cmdName} command`;
    const version = pkgMeta.ver || '1.0.0';
    const helpLines = [
      `${cmdName} (HTMLinux package)`,
      `Usage: ${cmdName} [--help] [--version] [subcommand] [args...]`,
      `Description: ${desc}`,
      '',
      'Subcommands:',
      '  info      show package metadata',
      '  demo      run a demonstration action',
      '  status    show simulated runtime status',
    ];
    return (args=[]) => {
      if (!args.length || args[0] === '--help' || args[0] === 'help') return helpLines.join('\n');
      if (args[0] === '--version' || args[0] === '-V' || args[0] === 'version') return `${cmdName} ${version} (HTMLinux)`;
      if (args[0] === 'info') return `name=${cmdName}\nversion=${version}\ndescription=${desc}`;
      if (args[0] === 'status') return `${cmdName}: active (simulated), pid=${Math.floor(Math.random()*5000+1000)}`;
      if (args[0] === 'demo') return `${cmdName}: demo completed successfully`;
      return `${cmdName}: executed with args: ${args.join(' ')}`;
    };
  }

  function registerGenericPackage(pkgName, meta) {
    const cmdNames = (meta.cmds && meta.cmds.length) ? meta.cmds : [pkgName];
    REGISTRY[pkgName] = {
      ver: meta.ver || '1.0.0',
      desc: meta.desc || `${pkgName} package`,
      size: meta.size || `${(Math.random()*4+0.2).toFixed(1)} MB`,
      deps: meta.deps || [],
      suggests: meta.suggests || [],
      install() {
        for (const c of cmdNames) {
          CMDS[c] = makeGenericCliHandler(c, { ...meta, ver: meta.ver || '1.0.0' });
        }
      }
    };
  }

  const BULK_PACKAGES = [
    ['gcc','GNU C compiler'],['g++','GNU C++ compiler'],['clang','LLVM C language frontend'],['make','Build automation tool'],
    ['cmake','Cross-platform build system'],['ninja-build','Small build system with focus on speed',['ninja']],
    ['pkg-config','Manage compile and link flags'],['autoconf','Generate shell configure scripts'],['automake','GNU Standards-compliant Makefile generator'],
    ['libtool','Generic library support script'],['meson','Open source build system'],['gdb','GNU project debugger'],
    ['valgrind','Instrumentation framework for dynamic analysis'],['shellcheck','Shell script static analysis tool'],
    ['bat','Cat clone with wings'],['exa','Modern replacement for ls'],['fd-find','Simple and fast alternative to find',['fd']],
    ['duf','Disk usage/free utility'],['dust','More intuitive version of du'],['procs','Modern replacement for ps'],
    ['bottom','Graphical process/system monitor',['btm']],['hyperfine','Command-line benchmarking tool'],
    ['tokei','Count your code quickly'],['zoxide','Smarter cd command'],['starship','Cross-shell prompt'],
    ['tmux','Terminal multiplexer'],['screen','Terminal session manager'],['neovim','Hyperextensible Vim-based text editor',['nvim']],
    ['emacs','GNU Emacs text editor'],['micro','Modern and intuitive terminal-based text editor'],['helix','Post-modern modal text editor',['hx']],
    ['mc','Midnight Commander file manager'],['ranger','Vim-inspired file manager'],['nnn','Tiny and productive file manager'],
    ['httrack','Website copier/offline browser'],['lynx','Text web browser'],['w3m','Text-based web browser'],
    ['elinks','Full-featured text WWW browser'],['aria2','Download utility supporting HTTP/FTP/BitTorrent',['aria2c']],
    ['axel','Light command line download accelerator'],['rsync','Fast incremental file transfer utility'],
    ['socat','Multipurpose relay for bidirectional data transfer'],['tcpdump','Dump traffic on a network'],
    ['wireshark-cli','Network protocol analyzer (CLI tshark)',['tshark']],['ethtool','Display or change ethernet settings'],
    ['iperf3','Network bandwidth measurement tool'],['iftop','Display bandwidth usage on an interface'],['bmon','Bandwidth monitor and rate estimator'],
    ['speedtest-cli','Internet bandwidth speed test'],['openvpn','Virtual private network daemon/client'],
    ['wireguard-tools','Fast modern VPN tunnel tools',['wg']],['tor','Anonymizing overlay network client'],
    ['torsocks','Wrapper to route CLI apps through Tor'],['dnsutils','DNS lookup utilities',['hostx']],
    ['bind9-utils','BIND DNS development utilities',['named-checkzone']],['whois-cli','Whois client',['whoisx']],
    ['netcat-openbsd','TCP/IP swiss army knife',['netcat']],['mtr-tiny','Network diagnostic tool'],['arp-scan','ARP scanning and fingerprinting tool'],
    ['masscan','TCP port scanner'],['hydra','Network login cracker (educational stub)'],['john','Password cracker stub',['john']],
    ['hashcat','Advanced password recovery utility'],['aircrack-ng','WiFi security auditing tools'],['nftables','Packet filtering framework',['nft']],
    ['ufw','Uncomplicated firewall'],['fail2ban','Ban hosts that cause multiple authentication errors'],
    ['podman','Daemonless container engine'],['docker-cli','Docker command-line client',['docker']],
    ['docker-compose','Define and run multi-container applications',['compose']],['buildah','Container image build utility'],
    ['skopeo','Work with remote container images'],['kubectl','Kubernetes command-line tool'],['kustomize','Kubernetes native configuration management'],
    ['helm','Kubernetes package manager'],['kind','Kubernetes in Docker'],['minikube','Local Kubernetes'],
    ['terraform','Infrastructure as code software'],['ansible','Automation platform'],['packer','Create machine images'],
    ['vagrant','Build and manage virtual machine environments'],['qemu-utils','QEMU utilities'],['virt-manager-cli','Virtual machine management CLI',['virsh']],
    ['sqlite','SQLite command line shell',['sqlite']],['postgresql-client','PostgreSQL interactive terminal',['psql']],
    ['mysql-client','MySQL command line client',['mysql']],['redis-tools','Redis command line tools',['redis-cli']],
    ['mongodb-tools','MongoDB command line tools',['mongosh']],['clickhouse-client','ClickHouse command line client'],
    ['influx-cli','InfluxDB command line interface'],['jq-extra','Additional jq helpers',['joq']],
    ['yq','YAML processor'],['xsv','CSV indexer and slicer'],['csvkit','Utilities for converting to and working with CSV'],
    ['pandoc','Universal document converter'],['texlive-cli','TeX Live command line tools',['pdflatex']],
    ['graphviz','Graph visualization software'],['gnuplot','Portable command-line driven graphing utility'],
    ['imagemagick-cli','CLI image utilities',['magick']],['poppler-utils','PDF rendering utilities',['pdftotext']],
    ['ffprobe','Media stream analyzer'],['mediainfo','Convenient unified display of media metadata'],
    ['yt-dlp','Feature-rich command-line audio/video downloader'],['sox','Swiss Army knife of sound processing'],
    ['mpv-cli','Media player CLI wrapper',['mpv']],['feh','Lightweight image viewer'],
    ['openjdk','OpenJDK development kit',['java','javac']],['maven','Java project management tool',['mvn']],
    ['gradle','Open source build automation tool'],['go','Go programming language compiler'],['rustc','Rust compiler'],
    ['cargo','Rust package manager'],['deno','Secure runtime for JavaScript and TypeScript'],['bun','Fast all-in-one JavaScript runtime'],
    ['ruby','Ruby language interpreter'],['irb','Interactive Ruby shell'],['perl','Practical extraction and report language'],
    ['php-cli','PHP command-line interpreter',['php']],['r-base','GNU R statistical computing language',['R']],
    ['julia','High-level dynamic programming language'],['swift-cli','Swift compiler and runtime',['swift']],
    ['dotnet-sdk','Microsoft .NET SDK',['dotnet']],['mono-devel','Mono development tools',['mono']],
    ['elixir','Dynamic, functional language for building scalable apps'],['erlang','General-purpose programming language and runtime'],
    ['clojure','Dynamic Lisp language for the JVM'],['zig','General-purpose programming language and toolchain'],
    ['nim','Statically typed compiled systems programming language'],['ocaml','ML language implementation'],
    ['haskell-platform','Haskell tools and libraries',['ghci']],['lua-tools','Lua command line tools',['luac']],
    ['fish','Friendly interactive shell'],['zsh','Z shell'],['xonsh','Python-powered shell'],
    ['nushell','A new type of shell'],['direnv','Load and unload environment variables depending on current directory'],
    ['fzf-extra','Extra fuzzy finder tooling',['fzy']],['ripgrep-all','Search many formats with ripgrep',['rga']],
    ['silversearcher-ag','Code-searching tool similar to ack',['ag']],['ack','Search tool like grep optimized for programmers'],
    ['parallel','Build and execute shell command lines from standard input'],['entr','Run arbitrary commands when files change'],
    ['watchman','Watch files and trigger actions when they change'],['inotify-tools','Command-line utilities for inotify'],
    ['tree-extra','Enhanced tree utilities',['tre']],['tldr','Community-driven man pages'],['man-db-extra','Additional man page indexing tools',['mandb']],
    ['neofetch-extra','Additional fetch themes',['fetchx']],['fastfetch','System information tool written in C'],['btop','Resource monitor that shows usage and stats']
  ];

  for (const row of BULK_PACKAGES) {
    const [name, desc, cmds] = row;
    const seed = [...name].reduce((s,ch)=>s+ch.charCodeAt(0),0);
    registerGenericPackage(name, {
      desc,
      cmds: cmds || [name],
      ver: `1.${seed%10}.${(seed*7)%10}`,
      size: `${((seed%90)/10+0.5).toFixed(1)} MB`
    });
  }

  async function syncRemotePackagesViaWasm(shell) {
    const now = Date.now();
    const last = meta.cache?.wasmSyncTs || 0;
    if (now - last < 10 * 60 * 1000) return 0;
    let wasmReady = false;
    try {
      const bytes = new Uint8Array([
        0,97,115,109,1,0,0,0,1,5,1,96,0,1,127,3,2,1,0,7,8,1,4,112,105,110,103,0,0,10,6,1,4,0,65,1,11
      ]);
      const mod = await WebAssembly.instantiate(bytes);
      wasmReady = !!mod?.instance?.exports?.ping;
    } catch {}
    if (!wasmReady) {
      meta.cache.wasmSyncTs = now;
      localStorage.setItem(META_KEY,JSON.stringify(meta));
      return 0;
    }
    const urls = [
      'https://packages.htmlinux.local/index.json',
      'https://raw.githubusercontent.com/connorgentile113-png/HTMLinux/main/package-index.json'
    ];
    let added = 0;
    for (const u of urls) {
      try {
        const resp = await fetch(u);
        if (!resp.ok) continue;
        const payload = await resp.json();
        const pkgs = Array.isArray(payload) ? payload : payload.packages;
        if (!Array.isArray(pkgs)) continue;
        for (const p of pkgs) {
          if (!p?.name || REGISTRY[p.name]) continue;
          registerGenericPackage(p.name, {
            desc: p.desc || `${p.name} package`,
            ver: p.ver || '1.0.0',
            size: p.size || '1.0 MB',
            cmds: Array.isArray(p.cmds) && p.cmds.length ? p.cmds : [p.name],
            deps: Array.isArray(p.deps) ? p.deps : [],
            suggests: Array.isArray(p.suggests) ? p.suggests : []
          });
          added++;
        }
        break;
      } catch {}
    }
    meta.cache.wasmSyncTs = now;
    meta.cache.remotePackagesAdded = (meta.cache.remotePackagesAdded || 0) + added;
    localStorage.setItem(META_KEY,JSON.stringify(meta));
    if (added && shell?.writeln) shell.writeln(`Fetched ${added} additional packages via WASM index loader.`);
    return added;
  }

  function saveMeta() { localStorage.setItem(META_KEY,JSON.stringify(meta)); }
  function saveInst() { localStorage.setItem(KEY,JSON.stringify(inst)); }
  function logPkgHistory(action, packages=[]) {
    const row = { ts: Date.now(), action, packages:[...packages] };
    meta.history = [...(meta.history||[]), row].slice(-200);
    try { localStorage.setItem(HIST_KEY,JSON.stringify(meta.history)); } catch {}
    saveMeta();
    const line = `${new Date(row.ts).toISOString()} ${action}: ${packages.join(' ')}`;
    VFS.appendFile('/var/log/apt/history.log', line + '\n');
  }
  function generatePackageFiles(name) {
    return [
      `/usr/bin/${name}`,
      `/usr/share/doc/${name}/README`,
      `/usr/share/man/man1/${name}.1.gz`,
      `/var/lib/dpkg/info/${name}.list`
    ];
  }
  function parseSizeMB(sizeStr='0') { return parseFloat(String(sizeStr).replace(/[^\d.]/g,'')) || 0; }
  function resolveDepsRec(name, out, seen) {
    if (seen.has(name)) return;
    seen.add(name);
    const p = REGISTRY[name];
    if (!p) return;
    for (const d of (p.deps||[])) resolveDepsRec(d, out, seen);
    out.push(name);
  }

  return {
    load() {
      try{inst=JSON.parse(localStorage.getItem(KEY)||'{}');}catch{inst={};}
      try{meta=JSON.parse(localStorage.getItem(META_KEY)||'{"auto":{},"hold":{},"cache":{},"files":{},"history":[]}');}catch{meta={auto:{},hold:{},cache:{},files:{},history:[]};}
      try{if(!meta.history?.length)meta.history=JSON.parse(localStorage.getItem(HIST_KEY)||'[]');}catch{}
      if(!meta.auto)meta.auto={};
      if(!meta.hold)meta.hold={};
      if(!meta.cache)meta.cache={};
      if(!meta.files)meta.files={};
      if(!meta.history)meta.history=[];
      for(const n of Object.keys(inst)) if(REGISTRY[n]) REGISTRY[n].install();
    },
    async update(shell) {
      await syncRemotePackagesViaWasm(shell);
      shell.writeln(`\x1b[1mGet:1\x1b[0m https://packages.htmlinux.local stable InRelease`);
      await delay(150);
      shell.writeln(`\x1b[1mGet:2\x1b[0m https://packages.htmlinux.local stable/main amd64 Packages [${Object.keys(REGISTRY).length} packages]`);
      await delay(100);
      shell.writeln(`Reading package lists... \x1b[1mDone\x1b[0m`);
      shell.writeln(`Building dependency tree... \x1b[1mDone\x1b[0m`);
      shell.writeln(`Reading state information... \x1b[1mDone\x1b[0m`);
      const upgradable=Object.keys(inst).filter(n=>REGISTRY[n]);
      if(upgradable.length)shell.writeln(`${upgradable.length} package(s) can be upgraded.`);
      else shell.writeln(`All packages are up to date.`);
      meta.cache.lastUpdate=Date.now();
      logPkgHistory('update',[]);
      return '';
    },
    async install(names, shell, opts={}) {
      const pkgNames=Array.isArray(names)?names:[names];
      const requested=[...new Set(pkgNames.filter(Boolean))];
      const ordered=[];
      const seen=new Set();
      for(const name of requested) resolveDepsRec(name,ordered,seen);
      const depsOnly=ordered.filter(n=>!requested.includes(n));
      if(depsOnly.length) shell.writeln(`The following additional packages will be installed:\n  ${depsOnly.join(' ')}`);
      const toInstall=[];
      for(const name of ordered){
        const pkg=REGISTRY[name];
        if(!pkg){shell.writeln(`\x1b[1;31mE:\x1b[0m Unable to locate package ${name}`);continue;}
        if(meta.hold[name]){shell.writeln(`${name} is on hold and cannot be changed.`);continue;}
        if(inst[name]){shell.writeln(`${name} is already the newest version (${pkg.ver}).`);continue;}
        toInstall.push({name,pkg});
      }
      if(!toInstall.length)return '';
      shell.writeln(`Reading package lists... \x1b[1mDone\x1b[0m`);
      shell.writeln(`Building dependency tree... \x1b[1mDone\x1b[0m`);
      shell.writeln(`The following NEW packages will be installed:\n  ${toInstall.map(p=>p.name).join(' ')}`);
      const totalSize=toInstall.reduce((s,p)=>s+parseSizeMB(p.pkg.size),0);
      shell.writeln(`After this operation, ${totalSize.toFixed(1)} MB of additional disk space will be used.`);
      await delay(100);
      const installedNow=[];
      for(const {name,pkg} of toInstall){
        shell.writeln(`\x1b[1mGet:1\x1b[0m https://packages.htmlinux.local stable/${name} ${pkg.ver} [${pkg.size||'?'}]`);
        await delay(200);
        shell.writeln(`Selecting previously unselected package \x1b[1m${name}\x1b[0m.`);
        shell.writeln(`(Reading database ... 42420 files and directories currently installed.)`);
        shell.writeln(`Preparing to unpack .../archives/${name}_${pkg.ver}_all.deb ...`);
        await delay(150);
        shell.writeln(`Unpacking ${name} (${pkg.ver}) ...`);
        await delay(100);
        shell.writeln(`Setting up ${name} (${pkg.ver}) ...`);
        pkg.install();
        inst[name]={ver:pkg.ver,inst:Date.now()};
        saveInst();
        meta.auto[name]=opts.auto!==undefined?!!opts.auto:!requested.includes(name);
        meta.files[name]=generatePackageFiles(name);
        delete meta.hold[name];
        saveMeta();
        installedNow.push(name);
        // install suggested packages hint
        if(pkg.suggests?.length)
          shell.writeln(`\x1b[2mSuggested packages: ${pkg.suggests.join(' ')}\x1b[0m`);
      }
      shell.writeln(`Processing triggers for man-db (2.11.2) ...`);
      logPkgHistory('install',installedNow);
      return '';
    },
    remove(name,purge=false) {
      if(!name)return 'E: remove requires at least one package name';
      if(meta.hold[name])return `${name} is on hold and cannot be removed`;
      if(!inst[name])return `${name}: not installed`;
      delete inst[name]; delete CMDS[name];
      delete meta.auto[name];
      delete meta.hold[name];
      delete meta.files[name];
      saveInst();
      saveMeta();
      logPkgHistory(purge?'purge':'remove',[name]);
      return `Removing ${name}...\n(Reading database ... done)\n${purge?`Purging configuration files for ${name} ...\n`:''}dpkg: warning: while removing ${name}, directory '/usr/bin' not empty so not removed`;
    },
    list(arg) {
      const opts=Array.isArray(arg)?arg:(arg?[arg]:[]);
      let filter='';
      let installedOnly=false,availableOnly=false,namesOnly=false,upgradableOnly=false;
      let limit=Infinity,page=1;
      for(let i=0;i<opts.length;i++){
        const x=opts[i];
        if(x==='--installed')installedOnly=true;
        else if(x==='--available')availableOnly=true;
        else if(x==='--names-only'||x==='--all-names')namesOnly=true;
        else if(x==='--upgradable')upgradableOnly=true;
        else if((x==='--limit'||x==='-n')&&opts[i+1])limit=Math.max(1,parseInt(opts[++i])||50);
        else if(x==='--page'&&opts[i+1])page=Math.max(1,parseInt(opts[++i])||1);
        else if(!x.startsWith('-')&&!filter)filter=x;
      }
      const all=Object.keys(REGISTRY).sort();
      let rows=all.filter(n=>!filter||n.includes(filter));
      if(installedOnly)rows=rows.filter(n=>!!inst[n]);
      if(availableOnly)rows=rows.filter(n=>!inst[n]);
      if(upgradableOnly)rows=rows.filter(n=>inst[n]&&inst[n].ver!==REGISTRY[n].ver);
      const total=rows.length;
      const start=(page-1)*(limit===Infinity?total:limit);
      const end=limit===Infinity?rows.length:start+limit;
      rows=rows.slice(start,end);
      if(namesOnly)return rows.join('\n');
      const lines=[`Listing... ${rows.length}/${total} package(s) shown (catalog: ${all.length})`,''];
      for(const n of rows){
        const p=REGISTRY[n];
        const tags=[];
        if(inst[n])tags.push('\x1b[32minstalled\x1b[0m');
        else tags.push('available');
        if(meta.auto[n])tags.push('auto');
        if(meta.hold[n])tags.push('hold');
        lines.push(`\x1b[1m${n}\x1b[0m/htmlinux ${p.ver} all [${tags.join(', ')}]`);
        lines.push(`  ${p.desc}`);
      }
      return lines.join('\n');
    },
    search(q) {
      const query=String(q||'').toLowerCase();
      const r=[];
      for(const [n,p] of Object.entries(REGISTRY)){
        if(!query||n.toLowerCase().includes(query)||p.desc.toLowerCase().includes(query))
          r.push(`\x1b[1m${n}\x1b[0m/${inst[n]?'\x1b[32minstalled\x1b[0m':'available'} ${p.ver}\n  ${p.desc}`);
      }
      return r.length?r.join('\n\n'):`No results for '${q}'`;
    },
    show(name) {
      const p=REGISTRY[name];if(!p)return `\x1b[1;31mE:\x1b[0m No packages found matching ${name}`;
      const status=inst[name]?`install ok installed ${inst[name].ver}`:'deinstall ok not-installed';
      const auto=meta.auto[name]?'yes':'no';
      const hold=meta.hold[name]?'hold':'ok';
      return `Package: ${name}\nVersion: ${p.ver}\nPriority: optional\nSection: utils\nMaintainer: HTMLinux Maintainers <packages@htmlinux.local>\nInstalled-Size: ${p.size||'unknown'}\nDepends: ${p.deps?.join(', ')||'(none)'}\nSuggests: ${p.suggests?.join(', ')||'(none)'}\nAPT-Manual-Installed: ${auto==='yes'?'no':'yes'}\nPackage-State: ${hold}\nDescription: ${p.desc}\nStatus: ${status}`;
    },
    depends(name) {
      const p=REGISTRY[name];if(!p)return `E: No packages found matching ${name}`;
      if(!p.deps?.length)return `${name}\n  (no dependencies)`;
      return `${name}\n${p.deps.map(d=>`  Depends: ${d}`).join('\n')}`;
    },
    rdepends(name) {
      const r=Object.entries(REGISTRY).filter(([n,p])=>p.deps?.includes(name));
      if(!r.length)return `${name}\n  (no reverse dependencies)`;
      return `${name}\nReverse dependencies:\n${r.map(([n])=>`  Depends: ${n}`).join('\n')}`;
    },
    packageNames(prefix='') {
      return Object.keys(REGISTRY).filter(n=>n.startsWith(prefix)).sort().join('\n');
    },
    listFiles(name) {
      if(!name)return 'dpkg-query: error: --listfiles needs a package name argument';
      if(!inst[name])return `dpkg-query: package '${name}' is not installed`;
      return (meta.files[name]||generatePackageFiles(name)).join('\n');
    },
    history() {
      const h=(meta.history||[]).slice(-50).reverse();
      if(!h.length)return 'No apt history.';
      return h.map(x=>`${new Date(x.ts).toISOString()} ${x.action} ${x.packages.join(' ')}`).join('\n');
    },
    stats() {
      const total=Object.keys(REGISTRY).length;
      const installed=Object.keys(inst).length;
      const auto=Object.values(meta.auto||{}).filter(Boolean).length;
      const held=Object.keys(meta.hold||{}).length;
      return `Total package names: ${total}\nInstalled packages: ${installed}\nAuto-installed: ${auto}\nHeld packages: ${held}\nLast update: ${meta.cache?.lastUpdate?new Date(meta.cache.lastUpdate).toISOString():'never'}\nWASM sync additions: ${meta.cache?.remotePackagesAdded||0}`;
    },
    policy(name) {
      const names=name?[name]:Object.keys(REGISTRY).sort();
      return names.map(n=>{
        const p=REGISTRY[n];
        if(!p)return `${n}:\n  Installed: (none)\n  Candidate: (none)\n  Version table:\n *** (none) 100`;
        const installed=inst[n]?.ver||'(none)';
        return `${n}:\n  Installed: ${installed}\n  Candidate: ${p.ver}\n  Version table:\n *** ${p.ver} 500\n        500 https://packages.htmlinux.local stable/main amd64 Packages`;
      }).join('\n');
    },
    clean(auto=false) {
      const removed=auto?Math.floor(Math.random()*3):Math.floor(Math.random()*7+3);
      return `Reading package lists... Done\n${auto?'Autoclean':'Clean'} complete.\nRemoved ${removed} package file(s) from cache.`;
    },
    download(name,cwd='/home/user') {
      if(!name)return 'E: download requires a package name';
      const p=REGISTRY[name];
      if(!p)return `E: Unable to locate package ${name}`;
      const file=`${name}_${p.ver}_all.deb`;
      VFS.writeFile(VFS.norm(file,cwd),`DEB PACKAGE\nname=${name}\nversion=${p.ver}\n`,cwd);
      return `Get:1 https://packages.htmlinux.local stable/${name} ${p.ver} [${p.size||'?' }]\nFetched 1 file.\nSaved to ./${file}`;
    },
    source(name,cwd='/home/user') {
      if(!name)return 'E: source requires a package name';
      const p=REGISTRY[name];
      if(!p)return `E: Unable to find a source package for ${name}`;
      const dir=VFS.norm(`${name}-${p.ver}`,cwd);
      VFS.mkdir(dir);
      VFS.writeFile(`${dir}/README.source`,`Source package: ${name}\nVersion: ${p.ver}\nDescription: ${p.desc}\n`);
      VFS.writeFile(`${dir}/debian.control`,`Package: ${name}\nVersion: ${p.ver}\nArchitecture: all\nDescription: ${p.desc}\n`);
      return `NOTICE: '${name}' packaging is simulated in HTMLinux.\nSuccessfully unpacked source package in ${name}-${p.ver}/`;
    },
    changelog(name) {
      if(!name)return 'E: changelog requires a package name';
      const p=REGISTRY[name];
      if(!p)return `E: Unable to locate package ${name}`;
      return `${name} (${p.ver}) stable; urgency=medium\n\n  * Rebuilt for HTMLinux package registry.\n  * Updated browser-safe wrappers and docs.\n\n -- HTMLinux Maintainers <packages@htmlinux.local>  ${new Date().toUTCString()}`;
    },
    mark(action,names=[]) {
      if(!action||!['auto','manual','hold','unhold'].includes(action))return 'apt mark: usage: apt mark [auto|manual|hold|unhold] <package...>';
      if(!names.length)return 'apt mark: no packages specified';
      const touched=[];
      for(const name of names){
        if(!REGISTRY[name])continue;
        if(action==='auto')meta.auto[name]=true;
        if(action==='manual')meta.auto[name]=false;
        if(action==='hold')meta.hold[name]=true;
        if(action==='unhold')delete meta.hold[name];
        touched.push(name);
      }
      saveMeta();
      if(!touched.length)return 'No changes made.';
      logPkgHistory(`mark-${action}`,touched);
      return touched.map(n=>{
        if(action==='auto')return `${n} set to automatically installed.`;
        if(action==='manual')return `${n} set to manually installed.`;
        if(action==='hold')return `${n} set on hold.`;
        return `Canceled hold on ${n}.`;
      }).join('\n');
    },
    autoremove() {
      const removable=Object.keys(inst).filter(n=>meta.auto[n]);
      if(!removable.length)return 'Reading package lists... Done\n0 packages removed.';
      for(const n of removable){delete inst[n];delete CMDS[n];delete meta.auto[n];delete meta.hold[n];}
      saveInst();
      saveMeta();
      logPkgHistory('autoremove',removable);
      return `Reading package lists... Done\nThe following packages will be REMOVED:\n  ${removable.join(' ')}\n${removable.length} package(s) removed.`;
    },
    async reinstall(names,shell) {
      const list=Array.isArray(names)?names:[names];
      const toReinstall=list.filter(n=>inst[n]&&REGISTRY[n]);
      if(!toReinstall.length)return '0 packages reinstalled.';
      shell.writeln(`Reinstalling packages: ${toReinstall.join(' ')}`);
      for(const n of toReinstall){
        const p=REGISTRY[n];
        shell.writeln(`Unpacking ${n} (${p.ver}) over (${inst[n].ver}) ...`);
        await delay(100);
        shell.writeln(`Setting up ${n} (${p.ver}) ...`);
        p.install();
      }
      logPkgHistory('reinstall',toReinstall);
      return `${toReinstall.length} package(s) reinstalled.`;
    },
    async upgradeAll(shell,full=false) {
      const toUpgrade=Object.keys(inst).filter(n=>REGISTRY[n]&&!meta.hold[n]);
      if(!toUpgrade.length)return 'All packages are up to date.';
      shell.writeln(`The following packages will be upgraded:\n  ${toUpgrade.join(' ')}`);
      await delay(300);
      for(const name of toUpgrade){
        const pkg=REGISTRY[name];
        shell.writeln(`Unpacking ${name} (${pkg.ver}) over (${inst[name].ver||pkg.ver}) ...`);
        await delay(100);
        shell.writeln(`Setting up ${name} (${pkg.ver}) ...`);
        pkg.install();
        inst[name]={ver:pkg.ver,inst:Date.now()};
      }
      saveInst();
      if(full){
        const autoCandidates=Object.keys(REGISTRY).filter(n=>!inst[n]&&meta.auto[n]);
        if(autoCandidates.length){
          await this.install(autoCandidates.slice(0,1),shell,{auto:true});
        }
      }
      logPkgHistory(full?'full-upgrade':'upgrade',toUpgrade);
      return `${toUpgrade.length} upgraded, 0 newly installed, 0 to remove.`;
    },
  };
})();

// ================================================================
// Python & JS interpreters
// ================================================================
function runPython(code) {
  try {
    const lines=code.split('\n');
    const out=[];
    const vars={};
    function evalE(expr) {
      expr=expr.trim();
      if(!expr)return undefined;
      if((expr.startsWith('"')&&expr.endsWith('"'))||(expr.startsWith("'")&&expr.endsWith("'")))return expr.slice(1,-1);
      if(expr==='True')return true; if(expr==='False')return false; if(expr==='None')return null;
      if(/^-?\d+(\.\d+)?$/.test(expr))return parseFloat(expr);
      if(expr.startsWith('[')&&expr.endsWith(']'))return expr.slice(1,-1).split(',').map(e=>evalE(e.trim()));
      if(/^[a-zA-Z_]\w*$/.test(expr))return expr in vars?vars[expr]:undefined;
      try {
        const js=expr.replace(/\bTrue\b/g,'true').replace(/\bFalse\b/g,'false').replace(/\bNone\b/g,'null').replace(/\*\*/g,'**');
        return Function(...Object.keys(vars),`"use strict";return(${js})`)(...Object.values(vars));
      } catch{return expr;}
    }
    for(const raw of lines){
      const line=raw.trim();
      if(!line||line.startsWith('#'))continue;
      if(line.startsWith('print(')){
        const inner=line.slice(6,-1);
        const parts=inner.split(',').map(p=>p.trim());
        const vals=parts.map(p=>{const v=evalE(p);return v===null?'None':v===undefined?'':String(v);});
        out.push(vals.join(' ')); continue;
      }
      if(/^[a-zA-Z_]\w*\s*=/.test(line)&&!line.includes('==')){
        const eq=line.indexOf('=');
        vars[line.slice(0,eq).trim()]=evalE(line.slice(eq+1).trim()); continue;
      }
      const v=evalE(line);
      if(v!==undefined&&v!==null&&String(v))out.push(String(v));
    }
    return out.join('\n');
  } catch(e){return `Traceback:\n  SyntaxError: ${e.message}`;}
}

function runJS(code) {
  const logs=[];
  const con={
    log:(...a)=>logs.push(a.map(v=>typeof v==='object'?JSON.stringify(v):String(v)).join(' ')),
    error:(...a)=>logs.push('\x1b[1mERROR: '+a.join(' ')+'\x1b[0m'),
    warn:(...a)=>logs.push('WARN: '+a.join(' ')),
    info:(...a)=>logs.push(a.join(' ')),
    dir:(...a)=>logs.push(JSON.stringify(a[0],null,2)),
    table:(a)=>{
      if(Array.isArray(a)){const keys=Object.keys(a[0]||{});logs.push(keys.join('\t'));for(const r of a)logs.push(keys.map(k=>r[k]).join('\t'));}
      else logs.push(JSON.stringify(a));
    },
  };
  try {
    const r=Function('console','require',`"use strict";${code}`)(con,(m)=>{throw new Error(`Cannot require '${m}'`);});
    if(r!==undefined)logs.push(String(r));
  } catch(e){logs.push(`\x1b[1m${e.name}: ${e.message}\x1b[0m`);}
  return logs.join('\n');
}

// ================================================================
// HTOP overlay
// ================================================================
function showHtop() {
  const ov=$('htop-ov'), body=$('htop-body');
  ov.classList.add('on'); TERM.lock();
  let tick=0;
  const procs=[
    {pid:1,user:'root',pri:20,ni:0,cpu:0.0,mem:0.1,cmd:'init',time:'0:00.12'},
    {pid:2,user:'root',pri:20,ni:0,cpu:0.0,mem:0.0,cmd:'kthreadd',time:'0:00.00'},
    {pid:100,user:'root',pri:-20,ni:0,cpu:0.0,mem:0.0,cmd:'migration/0',time:'0:00.03'},
    {pid:200,user:'root',pri:20,ni:0,cpu:0.1,mem:0.3,cmd:'systemd-journald',time:'0:00.41'},
    {pid:450,user:'www-data',pri:20,ni:0,cpu:0.2,mem:1.1,cmd:'nginx: worker',time:'0:01.22'},
    {pid:800,user:'user',pri:20,ni:0,cpu:0.0,mem:0.8,cmd:'dbus-daemon',time:'0:00.05'},
    {pid:1000,user:'user',pri:20,ni:0,cpu:0,mem:0,cmd:'bash',time:'0:00.08'},
    {pid:1001,user:'user',pri:20,ni:0,cpu:0,mem:0,cmd:'htop',time:'0:00.01'},
  ];
  const render=()=>{
    tick++;
    const cpu=Math.random()*8+1;
    const mem=performance.memory;
    const usedMB=mem?mem.usedJSHeapSize/1048576:64;
    const totalMB=mem?mem.jsHeapSizeLimit/1048576:512;
    const memPct=usedMB/totalMB*100;
    const BAR=50;
    const cpuFill=Math.round(cpu/100*BAR);
    const memFill=Math.round(memPct/100*BAR);
    const cpuBar='|'.repeat(cpuFill)+' '.repeat(BAR-cpuFill);
    const memBar='|'.repeat(memFill)+' '.repeat(BAR-memFill);
    const swap=' '.repeat(BAR);
    const upS=Math.floor((Date.now()-BOOT_T)/1000);
    const upStr=`${Math.floor(upS/3600)}:${String(Math.floor((upS%3600)/60)).padStart(2,'0')}:${String(upS%60).padStart(2,'0')}`;

    procs[6].cpu=(Math.random()*3).toFixed(1);
    procs[0].cpu=(Math.random()*0.5).toFixed(1);

    let h='';
    h+=`  CPU[${cpuBar}${cpu.toFixed(1)}%]   Tasks: ${procs.length}, ${tick%3===0?2:1} thr; ${tick%5===0?1:0} running\n`;
    h+=`  Mem[${memBar}${usedMB.toFixed(0)}M/${totalMB.toFixed(0)}M]  Load avg: ${(Math.random()*0.5).toFixed(2)} ${(Math.random()*0.3).toFixed(2)} ${(Math.random()*0.2).toFixed(2)}\n`;
    h+=`  Swp[${swap}0K/0K]       Uptime: ${upStr}\n\n`;
    h+=`\x1b[7m  PID USER      PRI  NI  VIRT   RES   SHR S  CPU%  MEM%   TIME+  Command         \x1b[0m\n`;
    for(const p of procs){
      const cpuV=parseFloat(p.cpu);
      const w=cpuV>5?'\x1b[1m':cpuV>2?'':'\x1b[2m';
      h+=`${w}${String(p.pid).padStart(6)} ${p.user.padEnd(9)} ${String(p.pri).padStart(3)} ${String(p.ni).padStart(3)}`;
      h+=` ${String(Math.round((cpuV+1)*1024)).padStart(6)} ${String(Math.round(usedMB*10)).padStart(5)} `;
      h+=` ${String(Math.round(usedMB*5)).padStart(5)} S ${String(p.cpu).padStart(5)} ${String((usedMB/totalMB*100).toFixed(1)).padStart(5)}`;
      h+=`  ${p.time.padStart(8)} ${p.cmd}\x1b[0m\n`;
    }
    body.innerHTML = ANSI.parse(h);
  };
  render();
  const iv=setInterval(render,800);
  const onK=(e)=>{
    if(e.key==='q'||e.key==='F10'||(e.ctrlKey&&e.key==='c')){
      clearInterval(iv); ov.classList.remove('on');
      document.removeEventListener('keydown',onK);
      TERM.unlock(); TERM.updatePrompt(); TERM.focus();
      document.dispatchEvent(new Event('htop-close'));
    }
  };
  document.addEventListener('keydown',onK);
}

// ================================================================
// CRON scheduler
// ================================================================
window.CRON = (() => {
  const KEY='hl_cron';
  let jobs=[];
  let running=false;

  function parseCron(spec) {
    const parts=spec.trim().split(/\s+/);
    if(parts.length<5)return null;
    return {min:parts[0],hour:parts[1],dom:parts[2],mon:parts[3],dow:parts[4]};
  }

  function matches(field, val) {
    if(field==='*')return true;
    if(field.includes(','))return field.split(',').some(f=>matches(f,val));
    if(field.includes('/')) { const[base,step]=field.split('/'); const s=parseInt(step); return matches(base,val)&&val%s===0; }
    if(field.includes('-')) { const[a,b]=field.split('-'); return val>=parseInt(a)&&val<=parseInt(b); }
    return parseInt(field)===val;
  }

  function check() {
    const now=new Date();
    for(const job of jobs) {
      const c=parseCron(job.spec);
      if(!c)continue;
      if(matches(c.min,now.getMinutes())&&matches(c.hour,now.getHours())&&
         matches(c.dom,now.getDate())&&matches(c.mon,now.getMonth()+1)&&
         matches(c.dow,now.getDay())) {
        Shell.exec(job.cmd).then(r=>{ if(r)VFS.appendFile('/var/log/syslog', `CRON: ${job.cmd}: ${r}\n`); });
      }
    }
  }

  return {
    load() { try{jobs=JSON.parse(localStorage.getItem(KEY)||'[]');}catch{jobs=[];} },
    save() { localStorage.setItem(KEY,JSON.stringify(jobs)); },
    start() { if(!running){running=true;setInterval(check,60000);} },
    add(spec, cmd) { jobs.push({spec,cmd,id:Date.now()}); this.save(); },
    list() { return jobs.map((j,i)=>`${i+1}\t${j.spec} ${j.cmd}`).join('\n'); },
    remove(i) { jobs.splice(i,1); this.save(); },
  };
})();

// ================================================================
// USER DATABASE
// ================================================================
window.UserDB = (() => {
  const KEY = 'hl_users_v1';
  const DEF = {
    users: [
      {uid:0,   gid:0,    name:'root',   home:'/root',      shell:'/bin/bash',         groups:['root'],             pw:'root', gecos:'root'},
      {uid:33,  gid:33,   name:'www-data',home:'/var/www',  shell:'/usr/sbin/nologin', groups:['www-data'],         pw:'*',    gecos:'www-data'},
      {uid:1000,gid:1000, name:'user',   home:'/home/user', shell:'/bin/bash',         groups:['user','sudo','adm'],pw:'user', gecos:'User,,,'},
    ],
    groups: [
      {gid:0,  name:'root',     members:['root']},
      {gid:4,  name:'adm',      members:['user']},
      {gid:27, name:'sudo',     members:['user']},
      {gid:33, name:'www-data', members:['www-data']},
      {gid:1000,name:'user',    members:['user']},
    ],
  };
  let db = null;
  const syncEtc = () => {
    VFS.writeFile('/etc/passwd', db.users.map(u=>`${u.name}:x:${u.uid}:${u.gid}:${u.gecos||''}:${u.home}:${u.shell}`).join('\n')+'\n');
    VFS.writeFile('/etc/shadow', db.users.map(u=>`${u.name}:${u.pw==='*'?'*':'$6$'+btoa(u.name+u.pw).slice(0,43)}:19500:0:99999:7:::`).join('\n')+'\n');
    VFS.writeFile('/etc/group', db.groups.map(g=>`${g.name}:x:${g.gid}:${g.members.join(',')}`).join('\n')+'\n');
  };
  const save = () => { localStorage.setItem(KEY, JSON.stringify(db)); syncEtc(); };
  return {
    load() { try { db=JSON.parse(localStorage.getItem(KEY)); } catch {} if(!db){db=JSON.parse(JSON.stringify(DEF));save();}else syncEtc(); },
    getUsers:     ()=>[...db.users],
    getGroups:    ()=>[...db.groups],
    getUser:      n =>db.users.find(u=>u.name===n)||null,
    getUserByUid: u =>db.users.find(x=>x.uid===u)||null,
    getGroup:     n =>db.groups.find(g=>g.name===n)||null,
    getGroupByGid:g =>db.groups.find(x=>x.gid===g)||null,
    checkPw:(n,pw)=>{const u=db.users.find(u=>u.name===n);return u&&u.pw!=='*'&&u.pw===pw;},
    addUser(opts){
      const maxUid=Math.max(...db.users.map(u=>u.uid),999);
      const uid=opts.uid??(maxUid<1000?1000:maxUid+1), gid=opts.gid??uid;
      if(!db.groups.find(g=>g.gid===gid))db.groups.push({gid,name:opts.name,members:[opts.name]});
      const u={uid,gid,name:opts.name,home:opts.home??`/home/${opts.name}`,shell:opts.shell??'/bin/bash',groups:[opts.name,...(opts.groups||[])],pw:opts.pw??'',gecos:opts.gecos??''};
      db.users.push(u);
      VFS.mkdir(u.home);
      for(const f of(VFS.readdir('/etc/skel')||[]))VFS.copyFile(f.path,u.home+'/'+f.name);
      save();return u;
    },
    removeUser(n,rmHome=false){
      const u=db.users.find(u=>u.name===n);if(!u)return false;
      db.users=db.users.filter(u=>u.name!==n);
      for(const g of db.groups)g.members=g.members.filter(m=>m!==n);
      db.groups=db.groups.filter(g=>!(g.name===n&&g.members.length===0));
      if(rmHome)VFS.rmdir(u.home,true);
      save();return true;
    },
    modifyUser(n,ch){
      const u=db.users.find(u=>u.name===n);if(!u)return false;
      if(ch.gecos!==undefined)u.gecos=ch.gecos;if(ch.shell!==undefined)u.shell=ch.shell;
      if(ch.home!==undefined)u.home=ch.home;if(ch.pw!==undefined&&ch.pw)u.pw=ch.pw;
      if(ch.locked!==undefined)u.locked=ch.locked;
      save();return true;
    },
    setGroups(uname,groups){
      for(const g of db.groups){const on=groups.includes(g.name);if(on&&!g.members.includes(uname))g.members.push(uname);else if(!on)g.members=g.members.filter(m=>m!==uname);}
      const u=db.users.find(u=>u.name===uname);if(u)u.groups=[...groups];
      save();
    },
    addGroup(n,gid){if(db.groups.find(g=>g.name===n))return false;const max=Math.max(...db.groups.map(g=>g.gid),999);db.groups.push({gid:gid??(max+1),name:n,members:[]});save();return true;},
    removeGroup(n){if(db.groups.find(g=>g.name===n&&g.gid<100))return false;db.groups=db.groups.filter(g=>g.name!==n);for(const u of db.users)u.groups=u.groups.filter(x=>x!==n);save();return true;},
  };
})();

// ================================================================
// USER MANAGER TUI
// ================================================================
window.UserMgr = (() => {
  const escH=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let ov,listEl,detailEl,sel=null,onClose=null;
  const status=(msg,err=false)=>{const el=document.getElementById('um-status');if(el){el.textContent=msg;el.style.color=err?'#ff6b6b':'#4caf50';setTimeout(()=>{if(el)el.textContent='';},3000);}};
  const renderList=()=>{
    listEl.innerHTML='';
    for(const u of UserDB.getUsers()){
      const d=document.createElement('div');d.className='um-row'+(sel?.name===u.name?' sel':'');
      d.innerHTML=`<div>${escH(u.name)}${u.locked?'<span style="font-size:10px;color:#666;margin-left:4px">[locked]</span>':''}</div><div style="font-size:11px;color:#666">uid=${u.uid}</div>`;
      d.onclick=()=>{sel=u;renderList();renderDetail();};
      listEl.appendChild(d);
    }
  };
  const renderDetail=()=>{
    if(!sel){detailEl.innerHTML='<p style="color:#666;padding:12px">Select a user</p>';return;}
    const u=UserDB.getUser(sel.name)||sel;
    const shells=['/bin/bash','/bin/sh','/bin/dash','/usr/sbin/nologin'];
    detailEl.innerHTML=`<div style="padding:14px 16px;font-size:12px">
      <div style="margin-bottom:12px;font-weight:700;border-bottom:1px solid #1c1c1c;padding-bottom:6px">Editing: ${escH(u.name)}</div>
      <div class="um-field"><label>Full Name</label><input id="um-gecos" value="${escH(u.gecos||'')}"></div>
      <div class="um-field"><label>Home</label><input id="um-home" value="${escH(u.home)}"></div>
      <div class="um-field"><label>Shell</label><select id="um-shell">${shells.map(s=>`<option value="${s}"${u.shell===s?' selected':''}>${s}</option>`).join('')}</select></div>
      <div class="um-field"><label>Locked</label><input type="checkbox" id="um-locked"${u.locked?' checked':''}></div>
      <div style="margin:10px 0 6px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#555">Groups</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">${UserDB.getGroups().map(g=>`<span class="grp-tag${u.groups?.includes(g.name)?' on':''}" data-grp="${escH(g.name)}" onclick="this.classList.toggle('on')" style="cursor:pointer;font-size:11px;padding:1px 6px;border:1px solid ${u.groups?.includes(g.name)?'#e8e8e8':'#444'};${u.groups?.includes(g.name)?'background:#e8e8e8;color:#000;':''}">${escH(g.name)}</span>`).join('')}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="um-btn" onclick="UserMgr.save()">Save</button>
        <button class="um-btn" onclick="UserMgr.changePw()">Password</button>
        <button class="um-btn" onclick="UserMgr.mkHome()">Create Home</button>
        <button class="um-btn" style="color:#888;border-color:#444" onclick="UserMgr.delUser()">Delete</button>
      </div>
      <div id="um-status" style="margin-top:8px;min-height:18px;font-size:11px;color:#888"></div>
    </div>`;
  };
  const onKey=e=>{
    if(e.key==='q'||e.key==='Escape')UserMgr.close();
    else if(e.key==='n'){e.preventDefault();UserMgr.newUser();}
    else if(e.key==='s'){e.preventDefault();if(sel)UserMgr.save();}
    else if(e.key==='p'){e.preventDefault();if(sel)UserMgr.changePw();}
    else if(e.key==='d'){e.preventDefault();if(sel)UserMgr.delUser();}
  };
  return {
    open(cb){
      onClose=cb||null;
      if(!ov){ov=document.getElementById('um-ov');listEl=document.getElementById('um-list');detailEl=document.getElementById('um-detail');}
      sel=UserDB.getUsers().find(u=>u.uid===ENV.uid)||UserDB.getUsers()[0];
      ov.style.display='flex';TERM.lock();renderList();renderDetail();
      document.addEventListener('keydown',onKey);
    },
    save(){
      if(!sel)return;
      const groups=[...detailEl.querySelectorAll('.grp-tag.on')].map(t=>t.dataset.grp);
      UserDB.setGroups(sel.name,groups);
      UserDB.modifyUser(sel.name,{gecos:document.getElementById('um-gecos')?.value,home:document.getElementById('um-home')?.value,shell:document.getElementById('um-shell')?.value,locked:document.getElementById('um-locked')?.checked});
      sel=UserDB.getUser(sel.name);renderList();status('Saved.');
    },
    changePw(){
      if(!sel)return;
      const p1=prompt(`New password for ${sel.name}:`);if(!p1)return;
      const p2=prompt('Confirm:');if(p1!==p2){status('Mismatch.',true);return;}
      UserDB.modifyUser(sel.name,{pw:p1});status('Password changed.');
    },
    mkHome(){if(!sel)return;VFS.mkdir(sel.home);for(const f of(VFS.readdir('/etc/skel')||[]))VFS.copyFile(f.path,sel.home+'/'+f.name);status(`${sel.home} created.`);},
    newUser(){
      const n=prompt('Username:');if(!n||!/^[a-z_][a-z0-9_-]*$/.test(n)){status('Invalid name.',true);return;}
      if(UserDB.getUser(n)){status('Already exists.',true);return;}
      const gecos=prompt('Full name:',''),pw=prompt('Password:','');
      UserDB.addUser({name:n,gecos:gecos||'',pw:pw||''});
      sel=UserDB.getUser(n);renderList();renderDetail();status(`User '${n}' created.`);
    },
    delUser(){
      if(!sel||sel.uid<1000){status('Cannot delete system users.',true);return;}
      if(!confirm(`Delete '${sel.name}'?`))return;
      const rmH=confirm('Remove home directory?');
      UserDB.removeUser(sel.name,rmH);sel=UserDB.getUsers()[0];renderList();renderDetail();status('Deleted.');
    },
    close(){ov.style.display='none';document.removeEventListener('keydown',onKey);TERM.unlock();TERM.updatePrompt();TERM.focus();if(onClose)onClose();},
    isActive:()=>ov?.style.display==='flex',
  };
})();

// scope aliases
var PKG = window.PKG;
var CRON = window.CRON;
var UserDB = window.UserDB;
var UserMgr = window.UserMgr;

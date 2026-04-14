# HTMLinux

A full Linux terminal emulator that runs entirely in your browser — no server, no backend, no install.

## Features

- **Real filesystem** — persistent VFS stored in localStorage, survives page refreshes
- **150+ commands** — coreutils, networking, kernel/admin, package, and fun commands
- **Nano editor** — full GNU nano clone with syntax keybindings
- **Full apt emulator** — `apt`, `apt-get`, and `apt-cache` with update/install/reinstall/remove/purge/policy/mark/autoremove/clean/download/source/changelog
- **Git** — `init`, `clone`, `add`, `commit`, `log`, `branch`, `checkout`, `stash`, `remote` — clone fetches real files from public GitHub repos
- **Python & Node REPL** — interactive interpreters via `python` or `node`
- **User management** — `useradd`, `userdel`, `passwd`, `su`, `sudo`, and a full TUI via `users`
- **Cron jobs** — `crontab -e` to schedule commands
- **htop** — process viewer overlay
- **Shell scripting** — pipes `|`, redirects `>` `>>`, `&&` `||`, `$()` substitution, variables

## Usage

Just open `htmlinux.html` in any browser. No installation required.

The loader fetches the latest JS modules from GitHub on every page load, with a bundled offline fallback if the network is unavailable.

## Hosting on Google Docs / Google Sites

1. Open Google Sites
2. Create a new page
3. Insert → Embed → paste the raw GitHub Pages URL of `htmlinux.html`

Or host directly on GitHub Pages:
1. Push `htmlinux.html` to your repo
2. Enable GitHub Pages in repo Settings → Pages → Branch: main
3. Access at `https://username.github.io/repo/htmlinux.html`

## File Structure

```
htmlinux.html     ← single-file loader (open this in your browser)
core.js           ← VFS · ENV · ANSI · History · TERM
nano.js           ← Nano editor
commands.js       ← all built-in commands (~80 commands)
system.js         ← PKG · git · curl · wget · CRON · UserDB · UserMgr
shell.js          ← Shell interpreter · input handler · boot sequence
```

## Commands

| Category | Commands |
|---|---|
| Navigation | `cd` `pwd` `ls` `ll` `la` `tree` |
| Files | `cat` `head` `tail` `touch` `mkdir` `rm` `cp` `mv` `ln` `chmod` `chown` `stat` |
| Text | `grep` `sed` `awk` `sort` `uniq` `wc` `tr` `cut` `diff` `nano` |
| System | `ps` `kill` `free` `df` `du` `uname` `uptime` `dmesg` `htop` |
| Network | `curl` `wget` `ping` `ifconfig` `ip` `ss` `dig` `nslookup` |
| Packages | `apt install/remove/list/search` |
| Git | `git clone/init/add/commit/log/branch/checkout/stash` |
| Users | `useradd` `userdel` `passwd` `su` `sudo` `who` `id` `users` |
| Fun | `cowsay` `fortune` `banner` `matrix` |
| Browser | `download` `upload` `reboot` `reset_fs` |

## Credits

Built with vanilla JavaScript. No frameworks, no dependencies.  
Inspired by real Linux — BusyBox, GNU coreutils, bash.

## License

MIT

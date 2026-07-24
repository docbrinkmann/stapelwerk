/** Deploy/export handoff: modal, targets, environment guides, compose preview. */
export const deployEn = {
  // Deploy / Export modal shell
  'deploy.title': 'Deploy / Export',
  'deploy.modal.ariaLabel': 'Deploy or export stack',
  'deploy.modal.subtitle': 'Run your stack anywhere — portable compose plus step-by-step instructions.',
  'deploy.copyCommand': 'Copy command',
  'deploy.copyFile': 'Copy {file}',
  'deploy.guide.heading': 'Environment guide',
  'deploy.env.raspberryPi': 'Raspberry Pi',
  'deploy.env.homeServer': 'Home Server',
  'deploy.env.vps': 'VPS',

  // Generated-secrets box (modal + live preview)
  'deploy.secrets.title': 'Generated passwords — save these',
  'deploy.secrets.modalHint':
    'These are inlined in the compose and mirrored in the downloadable .env. Store them somewhere safe — you’ll need them to access your services.',
  'deploy.secrets.previewHint':
    'These are generated fresh for the preview and are already inlined in the compose above. Store them somewhere safe.',
  'deploy.secrets.copyEnv': 'Copy .env',
  'deploy.secrets.copyValue': 'Copy value',
  'deploy.secrets.copyAll': 'Copy all',

  // Live compose preview
  'deploy.preview.empty': 'Add services to see a live docker-compose preview.',
  'deploy.preview.copyYaml': 'Copy YAML',

  // Handoff targets (UI steps; commands/filenames stay literal in code)
  'deploy.target.compose.title': 'Plain docker compose',
  'deploy.target.compose.summary': 'Run it directly on any host with Docker installed.',
  'deploy.target.compose.step1': 'Download docker-compose.yml and .env into an empty folder.',
  'deploy.target.compose.step2': 'Open a terminal in that folder.',
  'deploy.target.compose.step3': 'Start the stack.',
  'deploy.target.compose.step4': 'Check it came up.',
  'deploy.target.portainer.summary': 'Paste the compose into Portainer’s web stack editor.',
  'deploy.target.portainer.step1': 'Open Portainer and go to Stacks → Add stack.',
  'deploy.target.portainer.step2': 'Give the stack a name.',
  'deploy.target.portainer.step3': 'Choose the Web editor and paste the compose below.',
  'deploy.target.portainer.step3Detail':
    'The generated passwords are already inlined, so nothing else is required.',
  'deploy.target.portainer.step4': 'Click Deploy the stack.',
  'deploy.target.coolify.summary': 'Add it as a Docker Compose resource in Coolify.',
  'deploy.target.coolify.step1': 'In your project, click + New → Resource → Docker Compose.',
  'deploy.target.coolify.step2': 'Paste the compose below into the editor.',
  'deploy.target.coolify.step3': 'Review the environment variables.',
  'deploy.target.coolify.step3Detail':
    'Values are inlined; move any you prefer into Coolify’s Environment Variables tab if you want them managed there.',
  'deploy.target.coolify.step4': 'Click Deploy.',
  'deploy.target.dokploy.summary': 'Create a Compose service in Dokploy.',
  'deploy.target.dokploy.step1': 'Click Create → Compose.',
  'deploy.target.dokploy.step2': 'Paste the compose below into the Compose editor.',
  'deploy.target.dokploy.step3': 'Review the environment variables (already inlined).',
  'deploy.target.dokploy.step4': 'Click Deploy.',
  'deploy.target.openship.summary': 'Add it as a Docker Compose deployment in Openship.',
  'deploy.target.openship.step1': 'In Openship (dashboard or CLI), create a new Docker Compose deployment.',
  'deploy.target.openship.step2': 'Paste the compose below (the generated passwords are already inlined).',
  'deploy.target.openship.step3': 'Review the environment variables if you want them managed in Openship.',
  'deploy.target.openship.step4': 'Ship it.',
  'deploy.target.compose.step5': 'Deploy to a remote host from your machine (optional).',
  'deploy.target.compose.step5Detail':
    'The bundle also ships deploy.sh — run "./deploy.sh user@your-server" and it copies the compose over your own SSH and starts it. Your machine drives your server; we never see the host or your key.',

  // Environment guide: Raspberry Pi
  'deploy.guide.pi.title': 'Deploy to a Raspberry Pi',
  'deploy.guide.pi.intro':
    'Run your stack on a Raspberry Pi at home. Mind the arm64 architecture, run everything off an SSD if you can, and back the SD card up.',
  'deploy.guide.pi.archTitle': 'Check CPU architecture (arm64)',
  'deploy.guide.pi.archFlagged':
    'A Raspberry Pi (3/4/5, 64-bit OS) runs the arm64 architecture. These services in your stack look amd64-only and may fail to start on a Pi: {services}. Find an arm64-compatible image/tag for them before deploying.',
  'deploy.guide.pi.archGeneral':
    'A Raspberry Pi (3/4/5, 64-bit OS) runs the arm64 architecture. Most popular images publish arm64 variants, but verify each image supports arm64 (or arm32 on 32-bit OS) before deploying — an amd64-only image will fail to start.',
  'deploy.guide.pi.dockerTitle': 'Install / verify Docker',
  'deploy.guide.pi.dockerBody':
    'Install Docker Engine and add your user to the docker group, then verify it runs.',
  'deploy.guide.pi.filesTitle': 'Place the compose files',
  'deploy.guide.pi.filesBody':
    'Copy docker-compose.yml and .env into a folder on the Pi (e.g. ~/stacks/mystack). Or, from your own machine, run the bundle’s deploy.sh — it copies the compose to the Pi over your own SSH and starts it. Your machine drives the Pi; we never see your key.',
  'deploy.guide.pi.startTitle': 'Start the stack',
  'deploy.guide.pi.startBody':
    'Bring it up in the background and confirm the containers are healthy.',
  'deploy.guide.pi.reachTitle': 'Reach your services / add TLS',
  'deploy.guide.pi.reachPorts': 'On your LAN the services will be at:\n{ports}',
  'deploy.guide.pi.reachBody':
    'For clean hostnames and HTTPS, put a reverse proxy in front (Caddy or Nginx Proxy Manager). Caddy gives you automatic HTTPS with a one-line config.',
  'deploy.guide.pi.note1':
    'Prefer booting from an SSD/USB drive — SD cards wear out under database write load.',
  'deploy.guide.pi.note2':
    'Back up your SD card / data volumes regularly (e.g. `dd` image, or copy the volume folders).',

  // Environment guide: Home Server
  'deploy.guide.home.title': 'Deploy to a Home Server',
  'deploy.guide.home.intro':
    'Run your stack on an always-on machine on your LAN (NUC, old desktop, NAS). Give it a stable address, put a reverse proxy in front, and back up your volumes.',
  'deploy.guide.home.dockerTitle': 'Install Docker',
  'deploy.guide.home.dockerBody': 'Install Docker Engine + the compose plugin for your distro.',
  'deploy.guide.home.addressTitle': 'Give the server a stable address',
  'deploy.guide.home.addressBody':
    'Assign a static IP (or a DHCP reservation on your router) and a hostname so links keep working after reboots.',
  'deploy.guide.home.startTitle': 'Place the compose files and start',
  'deploy.guide.home.startBody':
    'Copy docker-compose.yml and .env onto the server, then start the stack. Or run the bundle’s deploy.sh from your own machine — it copies the compose over your own SSH and brings it up (your machine drives the server; we never see your key).',
  'deploy.guide.home.proxyTitle': 'Reverse proxy + TLS on the LAN',
  'deploy.guide.home.proxyBody':
    'Front the stack with Caddy or Nginx Proxy Manager for tidy hostnames like https://app.home.lan. For trusted certificates on a LAN, use a real domain with DNS-01 (Let’s Encrypt) so you don’t depend on public port 80/443.',
  'deploy.guide.home.proxyPorts': 'Direct (no proxy) the services are at:\n{ports}',
  'deploy.guide.home.backupTitle': 'Volumes & backups',
  'deploy.guide.home.backupBody':
    'Your data lives in the named volumes / bind mounts from the compose. Snapshot or copy them on a schedule (and test a restore). Databases: back up with a dump, not a live file copy.',
  'deploy.guide.home.note1':
    'Keep the host and images updated: `docker compose pull && docker compose up -d`.',
  'deploy.guide.home.note2':
    'Don’t expose the server directly to the internet unless you mean to — keep it LAN-only or behind a VPN.',

  // Environment guide: VPS
  'deploy.guide.vps.title': 'Deploy to a VPS',
  'deploy.guide.vps.intro':
    'Run your stack on a public cloud VPS (Hetzner, DigitalOcean, …). Lock down the firewall, terminate TLS at a reverse proxy, and never expose your database.',
  'deploy.guide.vps.firewallTitle': 'Install Docker & harden the firewall',
  'deploy.guide.vps.firewallBody':
    'Install Docker, then allow only SSH + HTTP/HTTPS with ufw. Everything else stays closed; containers talk to each other on the internal compose network.',
  'deploy.guide.vps.startTitle': 'Place the compose files and start',
  'deploy.guide.vps.startBody':
    'Copy docker-compose.yml and .env to the server, then start the stack. Or run the bundle’s deploy.sh from your own machine — it copies the compose over your own SSH and brings it up (your machine drives the server; we never see your key).',
  'deploy.guide.vps.proxyTitle': 'Reverse proxy + Let’s Encrypt (auto-HTTPS)',
  'deploy.guide.vps.proxyBody':
    'Point your domain’s DNS at the VPS, then put Caddy in front — it fetches and renews Let’s Encrypt certificates automatically. Only Caddy binds 80/443; your app stays internal.',
  'deploy.guide.vps.dbTitle': 'Do NOT expose your database',
  'deploy.guide.vps.dbBody':
    'Remove any published host port for databases/caches (Postgres 5432, Redis 6379, …) — they only need to be reachable by other containers on the compose network, not the public internet. Publish only the web/reverse-proxy port.',
  'deploy.guide.vps.updateTitle': 'Keep it updated',
  'deploy.guide.vps.updateBody': 'Apply OS security updates and refresh images regularly.',
  'deploy.guide.vps.note1':
    'Use SSH keys (not passwords) and consider disabling root SSH login.',
  'deploy.guide.vps.note2':
    'A leaked database port is the most common self-hosting breach — double-check nothing but 22/80/443 is open.',

  // Save stack modal
  'deploy.save.title': 'Save Your Stack',
  'deploy.save.nameLabel': 'Stack Name *',
  'deploy.save.namePlaceholder': 'My Development Stack',
  'deploy.save.descriptionPlaceholder': 'Describe what this stack is for...',
  'deploy.save.publicLabel': 'Make this stack public (visible to other users)',
  'deploy.save.summary': 'Stack Summary',
  'deploy.save.serviceCountOne': '{count} service:',
  'deploy.save.serviceCountOther': '{count} services:',
  'deploy.save.serviceFallback': 'Service',
  'deploy.save.error': 'Failed to save stack: {message}',
  'deploy.save.saving': 'Saving...',
  'deploy.save.submit': 'Save Stack',
} as const

export const deployDe: Record<keyof typeof deployEn, string> = {
  // Deploy / Export modal shell
  'deploy.title': 'Deployen / Exportieren',
  'deploy.modal.ariaLabel': 'Stack deployen oder exportieren',
  'deploy.modal.subtitle': 'Betreibe deinen Stack überall — portables Compose plus Schritt-für-Schritt-Anleitung.',
  'deploy.copyCommand': 'Befehl kopieren',
  'deploy.copyFile': '{file} kopieren',
  'deploy.guide.heading': 'Umgebungs-Guide',
  'deploy.env.raspberryPi': 'Raspberry Pi',
  'deploy.env.homeServer': 'Home-Server',
  'deploy.env.vps': 'VPS',

  // Generated-secrets box (modal + live preview)
  'deploy.secrets.title': 'Generierte Passwörter — speichere sie ab',
  'deploy.secrets.modalHint':
    'Sie sind bereits im Compose enthalten und in der herunterladbaren .env gespiegelt. Bewahre sie sicher auf — du brauchst sie für den Zugriff auf deine Services.',
  'deploy.secrets.previewHint':
    'Sie werden frisch für die Vorschau generiert und sind bereits im Compose oben enthalten. Bewahre sie sicher auf.',
  'deploy.secrets.copyEnv': '.env kopieren',
  'deploy.secrets.copyValue': 'Wert kopieren',
  'deploy.secrets.copyAll': 'Alle kopieren',

  // Live compose preview
  'deploy.preview.empty': 'Füge Services hinzu, um eine live docker-compose-Vorschau zu sehen.',
  'deploy.preview.copyYaml': 'YAML kopieren',

  // Handoff targets
  'deploy.target.compose.title': 'Docker Compose direkt',
  'deploy.target.compose.summary': 'Starte den Stack direkt auf jedem Host mit installiertem Docker.',
  'deploy.target.compose.step1': 'Lade docker-compose.yml und .env in einen leeren Ordner herunter.',
  'deploy.target.compose.step2': 'Öffne ein Terminal in diesem Ordner.',
  'deploy.target.compose.step3': 'Starte den Stack.',
  'deploy.target.compose.step4': 'Prüfe, ob alles läuft.',
  'deploy.target.portainer.summary': 'Füge das Compose in Portainers Web-Stack-Editor ein.',
  'deploy.target.portainer.step1': 'Öffne Portainer und gehe zu Stacks → Add stack.',
  'deploy.target.portainer.step2': 'Gib dem Stack einen Namen.',
  'deploy.target.portainer.step3': 'Wähle den Web editor und füge das untenstehende Compose ein.',
  'deploy.target.portainer.step3Detail':
    'Die generierten Passwörter sind bereits enthalten — mehr ist nicht nötig.',
  'deploy.target.portainer.step4': 'Klicke auf Deploy the stack.',
  'deploy.target.coolify.summary': 'Füge den Stack in Coolify als Docker-Compose-Ressource hinzu.',
  'deploy.target.coolify.step1': 'Klicke in deinem Projekt auf + New → Resource → Docker Compose.',
  'deploy.target.coolify.step2': 'Füge das untenstehende Compose in den Editor ein.',
  'deploy.target.coolify.step3': 'Prüfe die Umgebungsvariablen.',
  'deploy.target.coolify.step3Detail':
    'Die Werte sind bereits enthalten; verschiebe sie bei Bedarf in Coolifys Environment-Variables-Tab, wenn du sie dort verwalten willst.',
  'deploy.target.coolify.step4': 'Klicke auf Deploy.',
  'deploy.target.dokploy.summary': 'Lege in Dokploy einen Compose-Service an.',
  'deploy.target.dokploy.step1': 'Klicke auf Create → Compose.',
  'deploy.target.dokploy.step2': 'Füge das untenstehende Compose in den Compose-Editor ein.',
  'deploy.target.dokploy.step3': 'Prüfe die Umgebungsvariablen (bereits enthalten).',
  'deploy.target.dokploy.step4': 'Klicke auf Deploy.',
  'deploy.target.openship.summary': 'Füge den Stack als Docker-Compose-Deployment in Openship hinzu.',
  'deploy.target.openship.step1': 'Lege in Openship (Dashboard oder CLI) ein neues Docker-Compose-Deployment an.',
  'deploy.target.openship.step2': 'Füge das untenstehende Compose ein (die generierten Passwörter sind bereits enthalten).',
  'deploy.target.openship.step3': 'Prüfe die Umgebungsvariablen, falls du sie in Openship verwalten willst.',
  'deploy.target.openship.step4': 'Ship it.',
  'deploy.target.compose.step5': 'Optional: Deploy auf einen Remote-Host von deinem Rechner aus.',
  'deploy.target.compose.step5Detail':
    'Das Bundle enthält auch ein deploy.sh — führe "./deploy.sh user@your-server" aus und es kopiert die Compose über dein eigenes SSH und startet den Stack. Dein Rechner steuert deinen Server; wir sehen weder Host noch Key.',

  // Environment guide: Raspberry Pi
  'deploy.guide.pi.title': 'Auf einem Raspberry Pi deployen',
  'deploy.guide.pi.intro':
    'Betreibe deinen Stack zu Hause auf einem Raspberry Pi. Achte auf die arm64-Architektur, lass alles möglichst von einer SSD laufen und sichere die SD-Karte.',
  'deploy.guide.pi.archTitle': 'CPU-Architektur prüfen (arm64)',
  'deploy.guide.pi.archFlagged':
    'Ein Raspberry Pi (3/4/5, 64-Bit-OS) nutzt die arm64-Architektur. Diese Services in deinem Stack sehen amd64-only aus und starten auf einem Pi womöglich nicht: {services}. Suche vor dem Deploy ein arm64-kompatibles Image/Tag für sie.',
  'deploy.guide.pi.archGeneral':
    'Ein Raspberry Pi (3/4/5, 64-Bit-OS) nutzt die arm64-Architektur. Die meisten populären Images gibt es als arm64-Variante — prüfe aber vor dem Deploy für jedes Image, ob es arm64 (bzw. arm32 auf 32-Bit-OS) unterstützt. Ein amd64-only-Image startet nicht.',
  'deploy.guide.pi.dockerTitle': 'Docker installieren / prüfen',
  'deploy.guide.pi.dockerBody':
    'Installiere Docker Engine, füge deinen User zur docker-Gruppe hinzu und prüfe dann, ob es läuft.',
  'deploy.guide.pi.filesTitle': 'Compose-Dateien ablegen',
  'deploy.guide.pi.filesBody':
    'Kopiere docker-compose.yml und .env in einen Ordner auf dem Pi (z. B. ~/stacks/mystack). Oder führe das deploy.sh aus dem Bundle auf deinem eigenen Rechner aus — es kopiert die Compose über dein eigenes SSH auf den Pi und startet sie. Dein Rechner steuert den Pi; wir sehen deinen Key nie.',
  'deploy.guide.pi.startTitle': 'Stack starten',
  'deploy.guide.pi.startBody':
    'Starte ihn im Hintergrund und prüfe, ob die Container gesund hochkommen.',
  'deploy.guide.pi.reachTitle': 'Services erreichen / TLS hinzufügen',
  'deploy.guide.pi.reachPorts': 'In deinem LAN erreichst du die Services unter:\n{ports}',
  'deploy.guide.pi.reachBody':
    'Für saubere Hostnamen und HTTPS setze einen Reverse Proxy davor (Caddy oder Nginx Proxy Manager). Caddy gibt dir automatisches HTTPS mit einer Ein-Zeilen-Config.',
  'deploy.guide.pi.note1':
    'Boote möglichst von einer SSD/USB-Platte — SD-Karten verschleißen unter Datenbank-Schreiblast.',
  'deploy.guide.pi.note2':
    'Sichere SD-Karte / Daten-Volumes regelmäßig (z. B. per `dd`-Image oder Kopie der Volume-Ordner).',

  // Environment guide: Home Server
  'deploy.guide.home.title': 'Auf einem Home-Server deployen',
  'deploy.guide.home.intro':
    'Betreibe deinen Stack auf einer dauerhaft laufenden Maschine in deinem LAN (NUC, alter Desktop, NAS). Gib ihr eine feste Adresse, setze einen Reverse Proxy davor und sichere deine Volumes.',
  'deploy.guide.home.dockerTitle': 'Docker installieren',
  'deploy.guide.home.dockerBody': 'Installiere Docker Engine + das Compose-Plugin für deine Distro.',
  'deploy.guide.home.addressTitle': 'Dem Server eine feste Adresse geben',
  'deploy.guide.home.addressBody':
    'Vergib eine statische IP (oder eine DHCP-Reservierung im Router) und einen Hostnamen, damit Links auch nach Reboots funktionieren.',
  'deploy.guide.home.startTitle': 'Compose-Dateien ablegen und starten',
  'deploy.guide.home.startBody':
    'Kopiere docker-compose.yml und .env auf den Server und starte dann den Stack. Oder führe das deploy.sh aus dem Bundle auf deinem eigenen Rechner aus — es kopiert die Compose über dein eigenes SSH und startet den Stack (dein Rechner steuert den Server; wir sehen deinen Key nie).',
  'deploy.guide.home.proxyTitle': 'Reverse Proxy + TLS im LAN',
  'deploy.guide.home.proxyBody':
    'Setze Caddy oder Nginx Proxy Manager vor den Stack — für saubere Hostnamen wie https://app.home.lan. Für vertrauenswürdige Zertifikate im LAN nutze eine echte Domain mit DNS-01 (Let’s Encrypt), damit du nicht auf öffentlich erreichbare Ports 80/443 angewiesen bist.',
  'deploy.guide.home.proxyPorts': 'Direkt (ohne Proxy) erreichst du die Services unter:\n{ports}',
  'deploy.guide.home.backupTitle': 'Volumes & Backups',
  'deploy.guide.home.backupBody':
    'Deine Daten liegen in den Named Volumes / Bind Mounts aus dem Compose. Erstelle regelmäßig Snapshots oder Kopien (und teste ein Restore). Datenbanken: per Dump sichern, nicht als Kopie der laufenden Dateien.',
  'deploy.guide.home.note1':
    'Halte Host und Images aktuell: `docker compose pull && docker compose up -d`.',
  'deploy.guide.home.note2':
    'Exponiere den Server nicht direkt ins Internet, wenn du es nicht bewusst willst — halte ihn LAN-only oder hinter einem VPN.',

  // Environment guide: VPS
  'deploy.guide.vps.title': 'Auf einem VPS deployen',
  'deploy.guide.vps.intro':
    'Betreibe deinen Stack auf einem öffentlichen Cloud-VPS (Hetzner, DigitalOcean, …). Sperre die Firewall zu, terminiere TLS am Reverse Proxy und exponiere niemals deine Datenbank.',
  'deploy.guide.vps.firewallTitle': 'Docker installieren & Firewall härten',
  'deploy.guide.vps.firewallBody':
    'Installiere Docker und erlaube mit ufw nur SSH + HTTP/HTTPS. Alles andere bleibt zu; Container sprechen über das interne Compose-Netzwerk miteinander.',
  'deploy.guide.vps.startTitle': 'Compose-Dateien ablegen und starten',
  'deploy.guide.vps.startBody':
    'Kopiere docker-compose.yml und .env auf den Server und starte dann den Stack. Oder führe das deploy.sh aus dem Bundle auf deinem eigenen Rechner aus — es kopiert die Compose über dein eigenes SSH und startet den Stack (dein Rechner steuert den Server; wir sehen deinen Key nie).',
  'deploy.guide.vps.proxyTitle': 'Reverse Proxy + Let’s Encrypt (Auto-HTTPS)',
  'deploy.guide.vps.proxyBody':
    'Richte den DNS deiner Domain auf den VPS und setze Caddy davor — es holt und erneuert Let’s-Encrypt-Zertifikate automatisch. Nur Caddy bindet 80/443; deine App bleibt intern.',
  'deploy.guide.vps.dbTitle': 'Datenbank NICHT exponieren',
  'deploy.guide.vps.dbBody':
    'Entferne jeden veröffentlichten Host-Port für Datenbanken/Caches (Postgres 5432, Redis 6379, …) — sie müssen nur für andere Container im Compose-Netzwerk erreichbar sein, nicht fürs öffentliche Internet. Veröffentliche nur den Web-/Reverse-Proxy-Port.',
  'deploy.guide.vps.updateTitle': 'Aktuell halten',
  'deploy.guide.vps.updateBody': 'Spiele OS-Sicherheitsupdates ein und aktualisiere Images regelmäßig.',
  'deploy.guide.vps.note1':
    'Nutze SSH-Keys (keine Passwörter) und erwäge, den Root-Login per SSH zu deaktivieren.',
  'deploy.guide.vps.note2':
    'Ein geleakter Datenbank-Port ist die häufigste Self-Hosting-Panne — prüfe doppelt, dass außer 22/80/443 nichts offen ist.',

  // Save stack modal
  'deploy.save.title': 'Stack speichern',
  'deploy.save.nameLabel': 'Stack-Name *',
  'deploy.save.namePlaceholder': 'Mein Entwicklungs-Stack',
  'deploy.save.descriptionPlaceholder': 'Beschreibe, wofür dieser Stack gedacht ist...',
  'deploy.save.publicLabel': 'Stack öffentlich machen (für andere Nutzer sichtbar)',
  'deploy.save.summary': 'Stack-Übersicht',
  'deploy.save.serviceCountOne': '{count} Service:',
  'deploy.save.serviceCountOther': '{count} Services:',
  'deploy.save.serviceFallback': 'Service',
  'deploy.save.error': 'Stack konnte nicht gespeichert werden: {message}',
  'deploy.save.saving': 'Wird gespeichert...',
  'deploy.save.submit': 'Stack speichern',
}

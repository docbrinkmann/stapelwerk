/** Marketing surface: landing page, docs page, auth screens, marketing header. */
export const landingEn = {
  // Marketing header
  'landing.navSignIn': 'Sign In',
  'landing.getStarted': 'Get Started',
  'landing.mainNavAria': 'Main navigation',
  'landing.toggleMobileMenu': 'Toggle mobile menu',
  'landing.closeMobileMenu': 'Close mobile menu',

  // Hero
  'landing.heroAria': 'Introduction',
  'landing.heroBadge': 'Open source · runs on your own hardware',
  'landing.heroTitle': 'Build a Docker stack that actually runs.',
  'landing.heroSubtitlePre':
    'Pick from a curated catalog, get compatibility and resource checks as you go, and export a clean',
  'landing.heroSubtitlePost': '— or hand it straight to Coolify, Portainer or Dokploy.',
  'landing.heroCtaStart': 'Start building',
  'landing.heroCtaCatalog': 'Browse the catalog',
  'landing.featureCatalogTitle': 'A curated catalog',
  'landing.featureCatalogBody':
    'Self-hostable services that ship with real image, environment and volume metadata — so the export actually starts.',
  'landing.featureChecksTitle': 'Checked as you build',
  'landing.featureChecksBody':
    'Port and volume conflicts flagged live, plus a resource budget that tells you whether it fits your Pi or server.',
  'landing.featureYoursTitle': 'Yours to keep',
  'landing.featureYoursBody':
    'A clean compose file you own — run it anywhere, or hand it straight to Coolify, Portainer, Dokploy or Openship.',

  // Landing footer
  'landing.footerTagline': 'Stapelwerk — a guided composer for self-hosted Docker stacks.',
  'landing.footerServices': 'Services',
  'landing.footerDocs': 'Docs',
  'landing.signIn': 'Sign in',

  // Docs / help page
  'landing.docsTitle': 'Help & Docs',
  'landing.docsIntroPre':
    'Stapelwerk helps you compose a curated, compatibility-checked Docker stack and export a ready-to-run',
  'landing.docsIntroPost': '.',
  'landing.docsTocAria': 'On this page',
  'landing.docsNavGettingStarted': 'Getting started',
  'landing.docsNavCatalog': 'Service catalog',
  'landing.docsNavSupport': 'Getting help',
  'landing.docsStep1Browse': 'Browse the service catalog',
  'landing.docsStep1Middle': ' or start from a ',
  'landing.docsStep1Template': 'template in the Stack Builder',
  'landing.docsStep2':
    'Add the services you need to a stack. The builder flags port and volume conflicts as you go.',
  'landing.docsStep3':
    'Configure each service — environment variables, ports and volumes. Required secrets are generated for you.',
  'landing.docsStep4Pre': 'Export the generated',
  'landing.docsStep4Mid': ' plus an',
  'landing.docsStep4Post': ' and a deploy.sh, or hand it off to Portainer/Coolify/Dokploy/Openship.',
  'landing.docsStep5':
    'Optionally deploy to a remote host with the bundled deploy.sh — it runs on your machine and drives your server over your own SSH (we never hold your key) — or deploy directly to a Docker host from the stack\'s Deploy tab and watch live logs.',
  'landing.docsCatalogTitle': 'Understanding the service catalog',
  'landing.docsCatalogIntro':
    'The catalog is a curated set of self-hostable services grouped by category (databases, media, networking, monitoring, …). Each service ships with real image, environment and volume metadata so the exported compose file actually runs. When you add services, Stapelwerk checks:',
  'landing.docsCheckCompatTerm': 'Compatibility',
  'landing.docsCheckCompatBody':
    'warns about combinations that clash (e.g. two reverse proxies on the same port).',
  'landing.docsCheckBudgetTerm': 'Resource budget',
  'landing.docsCheckBudgetBody':
    'sums CPU/RAM so you can tell whether the stack fits your Pi or server.',
  'landing.docsCheckConfigTerm': 'Required configuration',
  'landing.docsCheckConfigBody':
    'surfaces the secrets and volumes a service needs to start cleanly.',
  'landing.docsSupportP1':
    "Every stack can generate its own README and troubleshooting notes from its Documentation view — that is the best place to start when a deployment misbehaves. Check the Deploy tab's live logs for the exact error from the Docker host.",
  'landing.docsSupportP2':
    "Still stuck? Review your service configuration for missing required variables, confirm the host has enough free memory for the stack, and make sure the target ports aren't already in use.",

  // 403 page
  'landing.forbiddenTitle': 'Access denied',
  'landing.forbiddenBody':
    'You don’t have permission to view this page. It may require an admin account, or you may need to sign in.',
  'landing.forbiddenHelp': 'Get help',
  'landing.forbiddenHome': 'Go home',

  // Sign-in page
  'landing.signinTitle': 'Sign in to Stapelwerk',
  'landing.signinSubtitle': 'Compose, manage and export your Docker stacks',
  'landing.signinErrorMissing': 'Please enter your email and password.',
  'landing.signinErrorInvalid': 'Invalid email or password. Please try again.',
  'landing.signinEmail': 'Email',
  'landing.signinEmailPlaceholder': 'you@example.com',
  'landing.signinPassword': 'Password',
  'landing.signinDemo': 'Demo account:',
} as const

export const landingDe: Record<keyof typeof landingEn, string> = {
  // Marketing header
  'landing.navSignIn': 'Anmelden',
  'landing.getStarted': 'Jetzt starten',
  'landing.mainNavAria': 'Hauptnavigation',
  'landing.toggleMobileMenu': 'Menü öffnen/schließen',
  'landing.closeMobileMenu': 'Menü schließen',

  // Hero
  'landing.heroAria': 'Einführung',
  'landing.heroBadge': 'Open Source · läuft auf deiner eigenen Hardware',
  'landing.heroTitle': 'Bau einen Docker-Stack, der wirklich läuft.',
  'landing.heroSubtitlePre':
    'Wähle aus einem kuratierten Katalog, erhalte Kompatibilitäts- und Ressourcen-Checks beim Bauen und exportiere eine saubere',
  'landing.heroSubtitlePost': '— oder übergib sie direkt an Coolify, Portainer oder Dokploy.',
  'landing.heroCtaStart': 'Jetzt bauen',
  'landing.heroCtaCatalog': 'Katalog durchstöbern',
  'landing.featureCatalogTitle': 'Ein kuratierter Katalog',
  'landing.featureCatalogBody':
    'Self-hostbare Services mit echten Image-, Environment- und Volume-Metadaten — damit der Export wirklich startet.',
  'landing.featureChecksTitle': 'Geprüft, während du baust',
  'landing.featureChecksBody':
    'Port- und Volume-Konflikte werden live markiert, dazu ein Ressourcen-Budget, das dir zeigt, ob der Stack auf deinen Pi oder Server passt.',
  'landing.featureYoursTitle': 'Gehört dir',
  'landing.featureYoursBody':
    'Eine saubere Compose-Datei, die dir gehört — starte sie, wo du willst, oder übergib sie direkt an Coolify, Portainer, Dokploy oder Openship.',

  // Landing footer
  'landing.footerTagline': 'Stapelwerk — ein geführter Composer für self-hosted Docker-Stacks.',
  'landing.footerServices': 'Services',
  'landing.footerDocs': 'Doku',
  'landing.signIn': 'Anmelden',

  // Docs / help page
  'landing.docsTitle': 'Hilfe & Doku',
  'landing.docsIntroPre':
    'Stapelwerk hilft dir, einen kuratierten Docker-Stack mit Kompatibilitäts-Checks zusammenzustellen und eine startklare',
  'landing.docsIntroPost': ' zu exportieren.',
  'landing.docsTocAria': 'Auf dieser Seite',
  'landing.docsNavGettingStarted': 'Erste Schritte',
  'landing.docsNavCatalog': 'Service-Katalog',
  'landing.docsNavSupport': 'Hilfe bekommen',
  'landing.docsStep1Browse': 'Durchstöbere den Service-Katalog',
  'landing.docsStep1Middle': ' oder starte mit einem ',
  'landing.docsStep1Template': 'Template im Stack Builder',
  'landing.docsStep2':
    'Füge die Services, die du brauchst, einem Stack hinzu. Der Builder markiert Port- und Volume-Konflikte direkt beim Bauen.',
  'landing.docsStep3':
    'Konfiguriere jeden Service — Umgebungsvariablen, Ports und Volumes. Benötigte Secrets werden für dich generiert.',
  'landing.docsStep4Pre': 'Exportiere die generierte',
  'landing.docsStep4Mid': ' plus eine',
  'landing.docsStep4Post': ' und ein deploy.sh — oder übergib sie an Portainer/Coolify/Dokploy/Openship.',
  'landing.docsStep5':
    'Optional deployst du auf einen Remote-Host mit dem beigelegten deploy.sh — es läuft auf deinem Rechner und steuert deinen Server über dein eigenes SSH (wir halten nie deinen Key) — oder direkt vom Deploy-Tab auf einen Docker-Host, mit Live-Logs.',
  'landing.docsCatalogTitle': 'So funktioniert der Service-Katalog',
  'landing.docsCatalogIntro':
    'Der Katalog ist eine kuratierte Sammlung self-hostbarer Services, gruppiert nach Kategorie (Datenbanken, Medien, Netzwerk, Monitoring, …). Jeder Service bringt echte Image-, Environment- und Volume-Metadaten mit, damit die exportierte Compose-Datei wirklich läuft. Wenn du Services hinzufügst, prüft Stapelwerk:',
  'landing.docsCheckCompatTerm': 'Kompatibilität',
  'landing.docsCheckCompatBody':
    'warnt vor Kombinationen, die sich beißen (z. B. zwei Reverse Proxies auf demselben Port).',
  'landing.docsCheckBudgetTerm': 'Ressourcen-Budget',
  'landing.docsCheckBudgetBody':
    'summiert CPU/RAM, damit du siehst, ob der Stack auf deinen Pi oder Server passt.',
  'landing.docsCheckConfigTerm': 'Erforderliche Konfiguration',
  'landing.docsCheckConfigBody':
    'zeigt die Secrets und Volumes, die ein Service für einen sauberen Start braucht.',
  'landing.docsSupportP1':
    'Jeder Stack kann in seiner Dokumentations-Ansicht ein eigenes README samt Troubleshooting-Notizen generieren — der beste Startpunkt, wenn ein Deployment zickt. Den genauen Fehler vom Docker-Host siehst du in den Live-Logs im Deploy-Tab.',
  'landing.docsSupportP2':
    'Kommst du nicht weiter? Prüfe deine Service-Konfiguration auf fehlende Pflichtvariablen, stell sicher, dass der Host genug freien Arbeitsspeicher für den Stack hat, und dass die Ziel-Ports nicht schon belegt sind.',

  // 403 page
  'landing.forbiddenTitle': 'Zugriff verweigert',
  'landing.forbiddenBody':
    'Du hast keine Berechtigung für diese Seite. Eventuell brauchst du ein Admin-Konto oder musst dich erst anmelden.',
  'landing.forbiddenHelp': 'Zur Hilfe',
  'landing.forbiddenHome': 'Zur Startseite',

  // Sign-in page
  'landing.signinTitle': 'Anmelden bei Stapelwerk',
  'landing.signinSubtitle': 'Erstelle, verwalte und exportiere deine Docker-Stacks',
  'landing.signinErrorMissing': 'Bitte gib deine E-Mail-Adresse und dein Passwort ein.',
  'landing.signinErrorInvalid': 'E-Mail oder Passwort ist falsch. Bitte versuch es erneut.',
  'landing.signinEmail': 'E-Mail',
  'landing.signinEmailPlaceholder': 'name@beispiel.de',
  'landing.signinPassword': 'Passwort',
  'landing.signinDemo': 'Demo-Zugang:',
}

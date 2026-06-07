# Installation

## Web-Version: Nicht empfohlen

> ⚠️ **Wichtiger Hinweis:** Die Web-Version unter **[app.learn-smart.app](https://app.learn-smart.app)** leidet unter erheblichen Performance-Problemen. Flutter-Web ist für eine interaktive, animationsreiche Lern-App wie SLAM nicht optimal geeignet — Ladezeiten und Renderingverzögerungen beeinträchtigen das Lernerlebnis spürbar. **Wir empfehlen dringend die native Installation auf Android oder iOS.**

---

## Android

### Voraussetzungen
- Android-Gerät mit Android 6.0 (Marshmallow) oder neuer
- Freier Speicherplatz: ca. 100 MB

### Schritt-für-Schritt

1. **APK herunterladen**  
   Öffne die [Releases-Seite](https://github.com/Seminarkurs-Lernapp-Mathematik/slam-app/releases) auf deinem Android-Gerät oder Computer und lade die neueste **`app-release.apk`** herunter.

2. **Installation aus unbekannten Quellen erlauben**  
   Da die App nicht aus dem Play Store kommt, muss diese Berechtigung einmalig aktiviert werden:
   - Android 8.0+: Die Nachfrage erscheint automatisch beim Öffnen der APK-Datei. Tippe auf **„Einstellungen"** und aktiviere „Diese Quelle erlauben".
   - Ältere Android-Versionen: **Einstellungen → Sicherheit → Unbekannte Quellen** einschalten.

3. **APK öffnen und installieren**  
   Öffne den Download-Ordner, tippe auf die APK-Datei und bestätige die Installation.

4. **App starten**  
   SLAM erscheint jetzt im App-Drawer. Beim ersten Start mit dem Schulkonto (`@mvl-gym.de`) anmelden.

---

## iOS (Sideloading)

Da SLAM nicht im App Store verfügbar ist, muss die App per **Sideloading** auf das iPhone geladen werden. Dabei signiert ein Desktop-Tool die IPA-Datei mit deiner kostenlosen Apple-ID, bevor sie installiert wird.

### Voraussetzungen
- iPhone mit iOS 15 oder neuer
- Apple-ID (kostenlos, kein bezahltes Developer-Konto nötig)
- USB-Kabel (Lightning oder USB-C)
- PC/Mac mit Internetzugang

### ⚠️ 7-Tage-Signierungslimit

Mit einer **kostenlosen Apple-ID** ist die installierte App nur **7 Tage gültig** — danach startet sie nicht mehr. Die App muss dann erneut signiert werden (gleicher Vorgang, kein Datenverlust). Mit einem bezahlten Apple Developer Account (99 €/Jahr) gilt das Zertifikat ein Jahr.

---

### Windows & Linux — Sideloadly

[Sideloadly](https://sideloadly.io) ist das einfachste und zuverlässigste Tool für Windows und Linux.

**1. IPA herunterladen**  
Lade die neueste **`app-unsigned.ipa`** von der [Releases-Seite](https://github.com/Seminarkurs-Lernapp-Mathematik/slam-app/releases) auf deinen Computer herunter.

**2. Sideloadly installieren**  
Gehe auf [sideloadly.io](https://sideloadly.io) und lade die Installer für Windows (`.exe`) oder Linux (`.deb` / `.AppImage`) herunter. Installiere Sideloadly auf deinem Computer.

**3. iPhone anschließen**  
Verbinde dein iPhone per USB mit dem Computer. Wenn das iPhone fragt: auf **„Vertrauen"** tippen und ggf. den Passcode eingeben.

**4. IPA installieren**  
- Starte Sideloadly.
- Ziehe die `app-unsigned.ipa` in das Sideloadly-Fenster (oder klicke auf das App-Icon und wähle die Datei aus).
- Stelle sicher, dass dein iPhone als Zielgerät ausgewählt ist.
- Gib deine **Apple-ID** (E-Mail-Adresse) ein.
- Klicke auf **Start**.
- Wenn nach dem Passwort gefragt wird: Apple-ID-Passwort eingeben. Für Accounts mit Zwei-Faktor-Authentifizierung ggf. ein App-spezifisches Passwort unter [appleid.apple.com](https://appleid.apple.com) erstellen.

**5. Dem Entwickler vertrauen**  
Nach der Installation auf dem iPhone:  
**Einstellungen → Allgemein → VPN & Geräteverwaltung** → den Eintrag mit deiner Apple-ID antippen → **„Vertrauen"** bestätigen.

Die App ist jetzt startbereit.

---

### macOS — Sideloadly (empfohlen)

Sideloadly gibt es auch für macOS. Die Schritte sind identisch mit der Windows/Linux-Anleitung oben — lade einfach die macOS-Version von [sideloadly.io](https://sideloadly.io) herunter.

#### Alternative: Xcode

Falls du Xcode bereits installiert hast, kannst du die IPA auch direkt darüber auf das Gerät laden:

1. iPhone per USB anschließen.
2. Xcode öffnen → **Window → Devices and Simulators**.
3. Dein iPhone in der linken Leiste auswählen.
4. Unter **„Installed Apps"** auf das **+**-Symbol klicken und die `app-unsigned.ipa` auswählen.
5. Danach ebenfalls unter **Einstellungen → Allgemein → VPN & Geräteverwaltung** dem Zertifikat vertrauen.

---

## Häufige Probleme

| Problem | Lösung |
|:--------|:-------|
| Android: „App nicht installiert" | Ausreichend Speicherplatz prüfen; ggf. eine ältere SLAM-Version zuerst deinstallieren |
| iOS: App startet nach 7 Tagen nicht mehr | App über Sideloadly erneut installieren (gleicher Vorgang, Daten bleiben erhalten) |
| Sideloadly: Authentifizierungsfehler | Zwei-Faktor-Code prüfen; ggf. App-spezifisches Passwort unter appleid.apple.com erstellen |
| iOS: „Nicht vertrauenswürdiger Entwickler" | Einstellungen → Allgemein → VPN & Geräteverwaltung → Zertifikat antippen → Vertrauen |
| App öffnet sich, bleibt auf Ladebildschirm | Internetverbindung prüfen; Backend läuft unter api.learn-smart.app |

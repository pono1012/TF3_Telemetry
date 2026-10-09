<div align="center">

# 🚅 Transport Fever 3 — Live Telemetry & Fleet Cockpit Suite

**Echtzeit-Telemetrie, Flotten-Monitoring und Finanz-Analytics für Transport Fever 3 direkt aus der C++ Game-Engine.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Transport Fever 3](https://img.shields.io/badge/Game-Transport%20Fever%203-orange.svg)](https://www.transportfever2.com)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-yellow.svg)](https://www.python.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows-lightgrey.svg)]()
[![Zero Lag](https://img.shields.io/badge/Engine%20Overhead-Zero%20Lag%20(%3C0.1ms)-brightgreen.svg)]()

<br/>

![TF3 Live Telemetry Banner](docs/screenshots/mod_preview_banner.jpg)

</div>

---

## 🌟 Überblick

Die **TF3 Telemetrie & Cockpit Suite** ist ein modernes, zweitbildschirmfähiges Live-Dashboard und Analyse-Tool für **Transport Fever 3**. 
Mithilfe eines nativen In-Game Engine-Hooks werden Fahrzeugbewegungen, Linienauslastungen, Finanzen, Wartungszustände und Terminalstaus ohne spürbare Performance-Einbußen extrahiert und live im Web-Browser oder auf dem Tablet angezeigt.

---

## 📸 Screenshots

<div align="center">

### 📊 Modernes Live-Cockpit (Executive Dashboard)
*Echtzeit-Kennzahlen, Kontostand, Liquidität, Netzwerkauslastung und smarte Fahrzeug-Verschiebungsvorschläge.*

![Live Executive Dashboard](docs/screenshots/dashboard_overview.png)

<br/>

### 📋 Detaillierte Linien- & Flotten-Übersicht
*Filter nach Verkehrsträgern (Schiene, Straße, Wasser, Luft), Live-Füllstand, Taktzeiten und Fahrzeugkondition.*

![Linien-Übersicht](docs/screenshots/dashboard_lines.png)

<br/>

### 📈 Finanz- & Trend-Analysen
*3600-Tick Treasury-Historie, Darlehenszinsen und Auslastungsverläufe.*

![Analytics & Charts](docs/screenshots/dashboard_analytics.png)

</div>

---

## ⚡ Key Features

* **⚡ Nativer Game-Engine Hook (Zero-Lag)**:
  * Minimaler Overhead durch adaptive Tickraten (5s bei Stillstand/Pause, 2s im Spielgeschehen) und $O(1)$ In-Memory Caching.
* **🌐 Web-Dashboard & Tablet-Modus**:
  * Läuft im Web-Browser auf `http://localhost:3000`.
  * Integrierter **QR-Code & LAN-IP-Erkennung** für nahtlose Nutzung auf iPad, Tablet oder Zweitmonitor.
* **🚚 5-Kategorien Flotten-Klassifizierung**:
  * 🚚 **Güter & LKW** (Road Cargo)
  * 🚌 **ÖPNV & Busse / Trams** (Road Passenger)
  * 🚆 **Eisenbahn & Züge** (Rail)
  * 🚢 **Schifffahrt & Fähren** (Water)
  * ✈️ **Luftfahrt & Flugzeuge** (Air)
* **🔧 Wartung, Alter & Strafkosten**:
  * Erfasst den Fahrzeugzustand von `0%` bis `100%` (`getVehicleMaintenanceState`).
  * Berechnet reale Betriebskostenstrafen (`+15%` bis `+25%`) durch Überalterung.
  * Automatische Benachrichtigung bei schlechtem Fuhrpark-Zustand.
* **⚠️ Stau- & Engpass-Erkennung**:
  * Erkennt Staus (`0 km/h` bei beladenen Fahrzeugen auf freier Strecke).
  * Zeigt wartende Passagiere und Frachtstücke an Haltestellen & Terminals.
  * Warnung vor 100% Leerfahrten.
* **💡 Smarter Fahrzeug-Berater**:
  * Schlägt automatische Fahrzeugverschiebungen von schwach ausgelasteten Linien (< 20%) auf überfüllte Linien mit Engpässen vor ($0 Investition).
* **💾 Persistente Historie**:
  * Zeichnet bis zu 3600 Datenpunkte des Cashflows und der Liquidität für Verlaufsdiagramme auf.

---

## 📁 Repository-Struktur

```text
TF3_Telemetry/
├── companion-mod/              # Transport Fever 3 In-Game Mods
│   ├── tf3_telemetry/          # Unser nativer Telemetrie-Collector (Engine Hook)
│   │   ├── _metadata/          # In-Game Icon (0.png) & modinfo.json
│   │   ├── content/            # Lua Engine Scripts (telemetry.script.lua, ...)
│   │   ├── mod.json            # Mod-Manifest
│   │   └── README.md
│   └── auto_line_namer/        # Modifizierter Auto-Line-Namer (Alphabetische Stadt-Sortierung)
├── docs/                       # Dokumentation & Assets
│   └── screenshots/            # Hochauflösende Screenshots & Banner
├── public/                     # Web-Cockpit Frontend
│   ├── css/                    # Glassmorphism Styles & Responsive Layouts
│   ├── js/                     # Dashboard-Logik, WebSocket Client & Charts
│   └── index.html              # Cockpit Single-Page-App
├── server.js                   # Node.js Express & WebSocket Live-Server
├── start_cockpit.bat           # 1-Klick Starter für das Web-Dashboard
├── install_mod.bat             # 1-Klick Installer für den TF3 In-Game Mod
├── create_telemetry_mod.py     # Automatisierter Mod-Deployer & Engine-Hook-Generator
├── live_monitor.py             # Optionaler Python SQLite-Logger & Data-Mining-Engine
├── debug_monitor.py            # Optionales Terminal-basiertes ANSI Live-Dashboard
├── validate_lua.py             # Linter für In-Game Lua Script-Integrität
├── package.json                # Node.js Paket-Definition
├── LICENSE                     # MIT Lizenz
└── README.md                   # Projektdokumentation
```

---

## 🚀 Installation & Schnellstart

### Schritt 1: In-Game Mod installieren

Wähle **eine** der beiden Installationsmethoden:

#### Methode A — Automatisch per 1-Klick (Empfohlen)
Doppelklicke auf [`install_mod.bat`](install_mod.bat) (oder führe `python create_telemetry_mod.py` aus).
> *Das Skript erkennt automatisch gängige Installationspfade von Transport Fever 3 und kopiert den Mod einsatzbereit in das Spiel.*

#### Methode B — Manuell per Drag & Drop
Kopiere den Ordner [`companion-mod/tf3_telemetry`](companion-mod/tf3_telemetry) in dein Transport Fever 3 Mod-Verzeichnis:
* **Steam:** `Steam/steamapps/common/Transport Fever 3/mods/tf3_telemetry`
* **Release / Manuell:** `<Spielordner>/Transport Fever 3/mods/release/tf3_telemetry`

*Danach im Spiel:* Spielstand laden, in den Mod-Einstellungen **"TF3 Live Telemetrie & Cockpit"** aktivieren und Spiel starten.

---

### Schritt 2: Web-Cockpit starten

1. **Voraussetzung:** [Node.js](https://nodejs.org/) (Version 18 oder neuer) ist installiert.
2. Doppelklicke auf [`start_cockpit.bat`](start_cockpit.bat).
   * *Alternativ über das Terminal:*
     ```bash
     npm install
     npm start
     ```
3. Dein Browser öffnet sich automatisch unter:
   ```text
   http://localhost:3000
   ```
4. **Tablet / Zweitbildschirm:** Klicke oben rechts auf den Button **"Tablet / Mobil"** und scanne den angezeigten QR-Code mit deinem Smartphone oder Tablet im selben WLAN-Netzwerk!

---

### Schritt 3 (Optional): Terminal-Monitore nutzen

Falls du Telemetrie-Daten direkt in der Windows PowerShell / Konsole analysieren möchtest:

```powershell
# Live-Terminal Monitor mit farbigen ANSI-Tabellen
python debug_monitor.py

# Data-Mining Engine mit SQLite Speicherung
python live_monitor.py
```

---

## ⚙️ Konfiguration & Umgebungsvariablen

Das Dashboard funktioniert **Out-of-the-Box** ohne manuelle Konfiguration. Für besondere Setups stehen folgende optionale Umgebungsvariablen zur Verfügung:

| Variable | Beschreibung | Standardwert |
| :--- | :--- | :--- |
| `PORT` | Webserver-Port | `3000` |
| `TF3_STDOUT_PATH` | Manuell definierter Pfad zur `stdout.txt` der TF3 Engine | *Automatische Erkennung (GSE Saves / Steam / Docs)* |
| `TF3_MOD_DIR` | Manuell definierter Mod-Zielpfad für den Deployer | *Automatische Erkennung* |

---

## 📦 Enthaltene Mods & Credits

* **`tf3_telemetry`** *(Eigene Entwicklung)*:
  * Nativer C++ Hook und Datenschnittstelle für Transport Fever 3.
  * Entwickelt von **pono1012**.
  * Lizenz: [MIT](LICENSE).

* **`auto_line_namer`** *(Fork / Anpassung)*:
  * Basiert auf dem beliebten Mod von **Dave W (BeautifulCheez)** (mod.io ID `6414403`) und **Erkan Ercan**.
  * **Anpassung:** Städtenamen wurden an den Anfang des Schemas gestellt (`{townNames} - ...`), damit bei alphabetischer Sortierung im Spiel alle Linien derselben Stadt übersichtlich gruppiert sind.
  * Lizenz: MIT License (siehe [`companion-mod/auto_line_namer/LICENSE`](companion-mod/auto_line_namer/LICENSE)).

---

## 🤝 Beitragen & Lizenz

Beiträge, Fehlerberichte und Feature-Vorschläge sind herzlich willkommen! 
Erstelle gerne ein [Issue](https://github.com/pono1012/TF3_Telemetry/issues) oder sende einen Pull Request.

Dieses Projekt steht unter der **[MIT Lizenz](LICENSE)**.

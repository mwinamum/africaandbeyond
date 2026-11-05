# Carnivores Safaris local demo

Run with Node.js 22 or later and network access to LodgeBridge.

```powershell
node preview.cjs
```

Open http://127.0.0.1:8767/. The Node server is required for live tours, itineraries, enquiries and tracking. The preview binds to loopback and serves noindex headers.

Catalogue reads use the default LodgeBridge tenant. Enquiry submissions use the existing live reservations integration and may create a record or trigger email. Keep the generated submission ledger private and outside the public document root.

## Localisation

The language selector lists every completed saved language version, including the original English, German, French, Italian and Swahili versions.
Visitors' explicit saved choices take priority. Otherwise Cloudflare country detection chooses the regional default, followed by browser language and English.
Country mappings and language aliases are defined in locale-store.cjs.
The website proxy accepts a lang query parameter on tour list and detail endpoints.
For example, /api/tours?lang=fr returns French tour content.

Tour translations are combined from tour-translations.json, generated-locales.json and translation-overrides.json by tour-localisation.cjs.
They cover the current 22 tours and 81 itinerary days. Source text, identifiers and numeric booking data stay in LodgeBridge. New or edited source text without a matching translation uses the English source and returns translationMissingFields so the site can show a fallback notice.
The translations are drafts for language review.

## Open-source translation batches

The demo uses LibreTranslate's Argos engine locally to generate saved interface and tour translations. Traditional Chinese is produced from Simplified Chinese using OpenCC script conversion.
The isolated engine and downloaded models use the ignored work/ directory. The website runs from its saved translations without installing the engine.
The website serves saved results from generated-locales.json. It does not require the translation engine to be running while visitors browse.

Run ./refresh-locales.ps1 from this folder to fetch the active catalogue and regenerate translations for every available English-to-target model.
Unchanged phrases use the existing local cache. Each language is published atomically after its interface and all tour content are complete.
The public selector reads the completed language list from /api/locale.
Country mappings and language aliases are in locale-store.cjs.
Wording corrections belong in translation-overrides.json. Restart the preview after editing those overrides.
Machine translations remain drafts for native-speaker review, and model language coverage is finite.


### Installing the optional translation engine

Use Python 3.11 to create an isolated environment and install the pinned dependencies.

~~~powershell
py -3.11 -m venv work/translate-env
work/translate-env/Scripts/python.exe -m pip install -r translation-requirements.txt
./refresh-locales.ps1
~~~

An existing engine in another directory can be used with ./refresh-locales.ps1 -WorkDirectory <absolute-directory>.
For the original Codex workspace, the existing engine directory is ../../work relative to this repository.

Git excludes local models, Python environments, logs, credentials files and the enquiry submission ledger.

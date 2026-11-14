# BLACKWELL OPERATIONS · online

De online versie gebruikt het bestaande BLACKWELL Supabase-project voor echte teamlogin, gedeelde gegevens en toegangsregels. De bestaande hoofdpagina blijft buiten deze map.

## Publicatiepad

De website staat onder `/operations/` in de repository `Bagap-YT/blackwell-one`. De eigenaar en medewerkers loggen in met hun teamgebruikersnaam en wachtwoord. Een medewerkeraccount wordt door de eigenaar aangemaakt vanuit **Medewerkers**.

## Beveiliging

- De browser gebruikt alleen de publishable Supabase-key. Er staat geen service-role key in de website.
- Producten, drafts, verkopen en taken worden via RLS beperkt tot ingelogde leden met Operations-toegang.
- Prijswijzigingen en accountbeheer worden server-side op eigenaarrol gecontroleerd.
- Sales worden via een databasefunctie vastgelegd; voorraad wordt daarbij atomair verlaagd.
- Listing drafts worden alleen opgeslagen. Er is geen publicatie-integratie.

## Bestanden

- `index.html`, `styles.css`, `app.js`: de webapp.
- `functions/manage-employee/index.ts`: beveiligde functie voor medewerkeraccounts.
- De databasewijzigingen zijn toegepast op het bestaande BLACKWELL Supabase-project.

De aparte lokale versie van BLACKWELL OPERATIONS blijft beschikbaar in de naastliggende map `BLACKWELL-OPERATIONS`.


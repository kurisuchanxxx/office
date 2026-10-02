# Piano: l'ufficio degli agenti di Ctrl Studio

Deciso con Christian il 2 ottobre 2026. Questa pagina e' il punto di partenza per chi apre la repo: cosa e' gia' fatto, cosa si fa adesso, cosa dopo.

## Da dove viene

ctrlOS e' il gestionale interno di Ctrl Studio (repo `ctrlos`, Next.js su Vercel, database Supabase). Dentro c'e' la **Flotta**: 18 agenti AI che girano dietro un bottone, cioe' chiamate all'API con un prompt, senza terminale. A parte c'e' la routine `flotta-mattina`, una sessione Claude Code pianificata che ogni mattina alle 6 manda avanti la catena Reach sul computer di Christian.

In ctrlOS c'era una **Vista Sistema** 3D (un villaggio, un edificio per modulo). E' stata tolta il 24 agosto 2026: era una vetrina, nessuno la apriva per lavorare, e three.js rallentava la build. Questo ufficio deve evitare la stessa fine: vale solo se lo si apre per lavorare.

Perche' non sta dentro ctrlOS: agent-office e' un server Node che tiene aperti terminali veri (node-pty) con Claude Code dentro. Su Vercel non puo' girare. Deve stare sul computer di Christian o su un server nostro.

Fino al 15 ottobre 2026 ctrlOS e' in un mese di consolidamento, senza sezioni nuove. Per questo i passi 1 e 2 stanno qui e non toccano il gestionale, se non per un indirizzo di sola lettura. L'idea e' registrata in `ctrlos/docs/IDEE_RIMANDATE.md` (voce del 02/10/2026).

## Stato al 2 ottobre 2026

- Copia dell'originale al commit `157b176` (1 ottobre 2026). `origin` = questa repo. Il remote `upstream` in questa copia non c'e': prima del primo aggiornamento va aggiunto con `git remote add upstream https://github.com/AgentSystemLabs/agent-office.git`.
- Verificato su Windows 11 con Node 24.14 e npm 11.9: `npm install` (che fa anche la build) passa, `npm run typecheck` passa. `npm test` su Windows non e' verde, e non per colpa nostra: dei 600 test ne passano 543 (vedi sotto). A ottobre l'ufficio si veste da Halloween da solo (si cambia da ⚙️).
- Si avvia dall'app desktop di Claude con `preview_start` e la configurazione `office` di [`.claude/launch.json`](../../.claude/launch.json): `node bin/agent-office.js --host 127.0.0.1 --port 4600 --no-open`, lanciato da un PowerShell che prima rilegge il PATH dal registro, cosi' l'ufficio trova anche programmi installati dopo l'avvio dell'app (`gh`). Fermando l'anteprima si ferma anche l'ufficio (provato). Ascolta solo su `127.0.0.1:4600` (controllato con `netstat`). I dati dell'ufficio stanno in `~/agent-office/.agent-office/`, i piani vengono clonati in `~/agent-office/<owner>/<repo>`.
- Su Windows il misuratore dei limiti dell'abbonamento (sessione di 5 ore e settimana) non funziona: `src/server/limits.ts` lancia `claude.CMD` con `spawn` senza shell, e Node lo rifiuta (`spawn EINVAL`, nel log come «unhandled rejection»). Il resto dell'ufficio va avanti. Difetto dell'originale, non corretto qui.
- La password la genera l'ufficio al primo avvio e la tiene in `~/agent-office/.agent-office/config.json` (campo `password`, accanto al suo hash). Avviato senza terminale, l'ufficio la stampa anche nel suo log: chi legge i log dell'anteprima la vede, quindi le sessioni li leggono solo filtrati sugli errori. Per cambiarla: fermare l'ufficio, `node bin/agent-office.js --reset-password`, riavviare.
- CLI di GitHub (`gh`) 2.102.0 installata con `winget install --id GitHub.cli -e --source winget` (senza `--source winget` si ferma su un errore di certificato del catalogo `msstore`) e collegata all'account `kurisuchanxxx` con `gh auth login --web` (permessi `repo`, `read:org`, `gist`). Git continua a usare Git Credential Manager; `gh` mette le sue credenziali da solo nei suoi clone e push.
- `npm audit` segnala 9 vulnerabilita' nelle dipendenze (7 moderate, 2 alte), quasi tutte strumenti di build. Da guardare prima di metterlo su un server.
- Il rilascio automatico dell'originale (`.github/workflows/release.yml`) qui parte solo a mano: a ogni push avrebbe consumato minuti di Actions per pubblicare versioni che nessuno installa.
- Non e' stato assunto nessun lavoratore: ognuno consuma l'abbonamento Claude di chi lo lancia.

### I test su Windows

Comando usato: `node --import tsx --import=#tests/css --test --test-force-exit --test-timeout=120000 "tests/*.test.ts"`. Con `npm test` e basta la suite non finisce mai: su Windows `dsh.test.ts` e `workers.test.ts` lasciano vivi i processi figli (finti agenti e `conhost.exe` di ConPTY) e il loro processo resta aperto. Con la cartella temporanea scritta per esteso (`$env:TEMP = (Get-Item $env:TEMP).FullName`, perche' il nome corto `KURISU~1` fa fallire i confronti fra percorsi): 600 test, 543 passati, 57 falliti, in meno di due minuti. I 57 hanno tutti una causa di ambiente:

- **Programmi finti scritti per la shell** (`#!/bin/sh`, senza estensione o `.cmd`): il finto `gh` di `clone.test.ts` e `repos.test.ts`, i finti agenti di `workers.test.ts` (lo stato non arriva mai), `office-workers` e `office-queue` non trovati, uno `spawn EINVAL`. Sono la maggior parte.
- **Cartelle temporanee che Windows non lascia cancellare** mentre un processo le tiene aperte (`dsh.test.ts`, `EPERM`).
- **Fine riga CRLF**: Git per Windows qui scarica i file con CRLF (`core.autocrlf=true`, `.gitattributes` fissa LF solo per `*.sh`), e `client-registry.test.ts` e `maps.test.ts` leggono i sorgenti con espressioni che si aspettano LF.
- **Collegamenti simbolici**: `codex-usage.test.ts` crea un symlink, che su Windows richiede la modalita' sviluppatore o l'amministratore.

Il controllo di sicurezza che rifiuta un file fuori dalla cartella passando da una junction (`changes.test.ts`) invece passa. Per i prossimi aggiornamenti: si confrontano i fallimenti con questo elenco, e conta solo quello che e' nuovo.

### I piani

Tre piani, aggiunti a ufficio spento con `node bin/agent-office.js setup --project kurisuchanxxx/ctrlos --project kurisuchanxxx/ink --project kurisuchanxxx/outreach` (fa quello che fa l'ascensore, senza browser). I cloni stanno in `~/agent-office/kurisuchanxxx/<repo>`, separati dalle cartelle sul Desktop, e ognuno ha la sua `.agent-office/` esclusa da git.

| Piano | Repo | Ramo | Note |
|---|---|---|---|
| 1 | `kurisuchanxxx/ctrlos` | `main` | Il clone non ha `.env.local` ne' `.claude/settings.local.json` della copia sul Desktop: i lavoratori leggono e scrivono il codice, ma non arrivano al database. |
| 2 | `kurisuchanxxx/ink` | `master` | Repo privata creata il 2 ottobre da `D:\utente\Desktop\ink` (`gh repo create --private --source --remote origin --push`). Su GitHub c'e' solo la storia committata; le modifiche in corso sul Desktop sono rimaste li'. |
| 3 | `kurisuchanxxx/outreach` | `master` | Repo privata creata il 2 ottobre. Prima non aveva nessun commit: il primo (`701aa15`, 148 file) l'ha fatto la sessione su richiesta di Christian; `.env.local` e `supabase/.db-url` restano fuori perche' ignorati. |

Perche' repo private e non cartelle locali: l'ascensore aggiunge solo repo GitHub (`Building.add` in `src/server/building.ts`). Una cartella locale diventa piano solo avviando l'ufficio dentro di lei (un piano solo, con i dati dell'ufficio nella cartella) o con una voce scritta a mano in `floors.json` (il codice la carica, ma senza bacheche issue e PR, su una strada non documentata che un aggiornamento puo' rompere). Christian ha scelto le repo private.

Le cartelle sul Desktop di `ink` e `outreach` ora hanno `origin` su GitHub: il lavoro dei lavoratori ci arriva con `git pull` dopo il merge della PR.

### Cosa si e' trovato sui punti da verificare del passo 1

- **flotta-mattina.** E' un'attivita' pianificata dell'app desktop di Claude, ogni giorno alle 6:00, e lavora in `D:\utente\Desktop\ctrlos` con il suo `.env.local` e i permessi di `.claude/settings.local.json`. L'ufficio non ha un pianificatore: nessun orario, la coda parte solo quando qualcuno aggiunge un compito, e l'indirizzo per aggiungerne (`/office/queue`, solo da `127.0.0.1`) lo usano soltanto gli agenti delle bacheche col loro token. Per farla partire nell'ufficio servirebbe un modulo nostro che alle 6 mette il compito in coda sul piano `ctrlos`, e al clone servirebbero quei due file, che oggi stanno solo sul Desktop. Le 10 corse dal 23 settembre al 2 ottobre risultano tutte riuscite, ma in 4 (23, 24, 26 e 28 settembre) l'ultima attivita' arriva ore dopo la partenza; verificato solo il 28: la fase dei mockup e' durata 8 ore e mezza, «PC in sospensione o permesso rimasto in attesa». E' proprio il caso in cui la luce rossa servirebbe. Per il passo 1 resta dov'e'; il numero «quante mattine resta ferma» si legge gia' dalle corse della routine. Se ne riparla nel passo 2.
- **Terminali su Windows.** Su Windows l'ufficio non usa l'host dei terminali (`PtyHost.connect()` in `src/server/ptys.ts` esce subito con `win32`): i terminali dei lavoratori girano dentro il processo dell'ufficio. Se l'ufficio si ferma (Ctrl+C, `preview_stop`, un crash, un aggiornamento) le sessioni Claude si chiudono con lui. Al riavvio un lavoratore riprende la conversazione con `claude --resume` (tasto R, o da solo se era a meta' turno e l'ufficio si e' chiuso in modo ordinato), ma il comando che stava girando si perde. Su Linux e macOS invece l'host le tiene vive per 30 minuti. Prova fatta il 2 ottobre: un PowerShell in node-pty (ConPTY, come i lavoratori) per 8 minuti, 1,5 MB di output, ridimensionato ogni 10 secondi (47 volte), con lo schermo tenuto da `@xterm/headless` come fa l'ufficio: nessuna pausa sopra i 214 ms, memoria ferma intorno ai 95 MB, chiusura pulita. Non provata: una sessione Claude vera di ore dentro l'ufficio, perche' serve assumere un lavoratore. In pratica: l'ufficio resta acceso finche' ci sono lavoratori, e non si riavvia a meta' lavoro.

## Passo 1: usarlo per le sessioni Claude Code (adesso)

Obiettivo: capire in una settimana se l'ufficio si apre davvero.

1. Installare e collegare GitHub: `winget install --id GitHub.cli -e --source winget`, poi `gh auth login`. Fatto il 2 ottobre.
2. Avviare: `npm install`, poi `node bin/agent-office.js` (oppure `npm install -g .` e da li' `agent-office`). Resta su `127.0.0.1`: chi entra puo' far eseguire comandi come Christian, quindi niente `--host 0.0.0.0`. Dall'app desktop di Claude: `preview_start` con la configurazione `office` di `.claude/launch.json`.
3. Aggiungere i piani dall'ascensore: `ctrlos`, `ink`, `outreach`. L'ufficio li clona in `~/agent-office/<owner>/<repo>`, separati dalle copie in `D:\utente\Desktop\...` dove Christian lavora con altre sessioni: va bene cosi', e' meglio che i lavoratori non scrivano nella stessa cartella. Ogni piano tiene il suo stato in una cartella `.agent-office/` dentro il clone. Fatto il 2 ottobre (vedi «I piani» sopra).
4. Lavorarci: un compito a scrivania, worktree proprio quando si lavora in parallelo, la luce rossa dice chi aspetta, `/lite` dal telefono.

Da verificare in questo passo:

- La routine `flotta-mattina` oggi gira come attivita' pianificata dell'app desktop di Claude, non dentro l'ufficio. Non ho trovato nell'ufficio un pianificatore: i lavori partono a mano o dalla coda. Capire se conviene farla partire nell'ufficio (si vedrebbe la luce rossa quando si blocca) o lasciarla dov'e'.
- Come si comporta il terminale condiviso su Windows (node-pty con ConPTY) con sessioni lunghe.

## Passo 2: il piano «Flotta» (dopo il passo 1, se l'ufficio si usa)

Obiettivo: i 18 agenti della Flotta seduti alle scrivanie, con lo stato vero preso da ctrlOS.

**Lato ctrlOS, solo lettura.** Una rotta `GET /api/flotta/cron/stato` sul modello di `web/app/api/flotta/cron/ricerca/route.ts`: header `Authorization: Bearer <token>` controllato con `bearerValido` di `web/lib/bearer.ts`, con un token dedicato e revocabile da solo (non il `CRON_SECRET`, non l'`AGENTE_TOKEN`). Il prefisso `/api/flotta/cron/` e' quello che ctrlOS lascia passare senza sessione (`web/lib/supabase/middleware.ts`). Restituisce, per ogni agente di `AGENTI` in `web/lib/flotta.ts`:

- `chiave`, `nome`, `sezione` (`sorveglianza`, `produzione`, `contatto`), `href` (la pagina dell'agente nel gestionale);
- `coda`: quante cose aspettano una persona, da `codeAgenti()` in `web/lib/flotta-stato.ts` (lo stesso numero che mostra `/flotta`, cosi' i due non raccontano cose diverse);
- `ultimoRun`: `ok`, `created_at`, `messaggio` dall'ultima riga di `agent_runs` per quella chiave.

Niente dati di clienti o lead: solo nomi di agenti e numeri. In ctrlOS questo e' «collegare pezzi che ci sono gia'», non una sezione nuova.

**Lato ufficio.** Un modulo nostro, in cartelle nostre, che chiede quella rotta dal server ogni minuto (indirizzo e token in variabili d'ambiente, mai nel codice) e la mostra:

- un piano «Flotta» con tre gruppi di scrivanie, uno per sezione, col cartello sopra (l'ufficio ha gia' i cartelli sulle scrivanie);
- luce rossa quando `coda > 0` o l'ultimo run e' fallito, il lavoratore che salta quando ha appena finito bene, grigio quando non gira da 30 giorni;
- un clic (o **E**) apre la pagina `href` dell'agente in ctrlOS, perche' l'azione si fa li'.

La parte da studiare per prima: oggi un lavoratore dell'ufficio e' sempre un terminale. Va capito come mettere alla scrivania un lavoratore senza terminale (partire da `src/client/features/workers/`, `src/server/workers/` e da come un piano e' legato a una cartella in `src/server/floor.ts`), senza riscrivere i file dell'originale.

## Passo 3: dentro ctrlOS (dopo il 15 ottobre, solo se i numeri dicono si')

Se l'ufficio si apre ogni giorno, in ctrlOS si aggiunge un link «Ufficio» nella Flotta, oppure una vista 2D come `/lite`. Niente 3D dentro ctrlOS: e' il motivo per cui la Vista Sistema e' stata tolta.

## I numeri da guardare

- Quante volte a settimana Christian apre l'ufficio di sua iniziativa.
- Quante mattine `flotta-mattina` resta ferma ad aspettare una risposta, prima e dopo.

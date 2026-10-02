# Piano: l'ufficio degli agenti di Ctrl Studio

Deciso con Christian il 2 ottobre 2026. Questa pagina e' il punto di partenza per chi apre la repo: cosa e' gia' fatto, cosa si fa adesso, cosa dopo.

## Da dove viene

ctrlOS e' il gestionale interno di Ctrl Studio (repo `ctrlos`, Next.js su Vercel, database Supabase). Dentro c'e' la **Flotta**: 18 agenti AI che girano dietro un bottone, cioe' chiamate all'API con un prompt, senza terminale. A parte c'e' la routine `flotta-mattina`, una sessione Claude Code pianificata che ogni mattina alle 6 manda avanti la catena Reach sul computer di Christian.

In ctrlOS c'era una **Vista Sistema** 3D (un villaggio, un edificio per modulo). E' stata tolta il 24 agosto 2026: era una vetrina, nessuno la apriva per lavorare, e three.js rallentava la build. Questo ufficio deve evitare la stessa fine: vale solo se lo si apre per lavorare.

Perche' non sta dentro ctrlOS: agent-office e' un server Node che tiene aperti terminali veri (node-pty) con Claude Code dentro. Su Vercel non puo' girare. Deve stare sul computer di Christian o su un server nostro.

Fino al 15 ottobre 2026 ctrlOS e' in un mese di consolidamento, senza sezioni nuove. Per questo i passi 1 e 2 stanno qui e non toccano il gestionale, se non per un indirizzo di sola lettura. L'idea e' registrata in `ctrlos/docs/IDEE_RIMANDATE.md` (voce del 02/10/2026).

## Stato al 2 ottobre 2026

- Copia dell'originale al commit `157b176` (1 ottobre 2026). `origin` = questa repo, `upstream` = l'originale.
- Verificato su Windows 11 con Node 24: `npm install` (che fa anche la build) passa, l'ufficio parte su `127.0.0.1:4600` e si entra. A ottobre si veste da Halloween da solo (si cambia da ⚙️).
- Manca la CLI di GitHub (`gh`): senza, l'ascensore non elenca le repo e non si aggiungono piani. Si e' provato solo con una cartella locale passata a mano (`node bin/agent-office.js <cartella>`).
- `npm audit` segnala 9 vulnerabilita' nelle dipendenze (7 moderate, 2 alte), quasi tutte strumenti di build. Da guardare prima di metterlo su un server.
- Il rilascio automatico dell'originale (`.github/workflows/release.yml`) qui parte solo a mano: a ogni push avrebbe consumato minuti di Actions per pubblicare versioni che nessuno installa.
- Non e' stato assunto nessun lavoratore: ognuno consuma l'abbonamento Claude di chi lo lancia.

## Passo 1: usarlo per le sessioni Claude Code (adesso)

Obiettivo: capire in una settimana se l'ufficio si apre davvero.

1. Installare e collegare GitHub: `winget install GitHub.cli`, poi `gh auth login`.
2. Avviare: `npm install`, poi `node bin/agent-office.js` (oppure `npm install -g .` e da li' `agent-office`). Resta su `127.0.0.1`: chi entra puo' far eseguire comandi come Christian, quindi niente `--host 0.0.0.0`.
3. Aggiungere i piani dall'ascensore: `ctrlos`, `ink`, `outreach`. L'ufficio li clona in `~/agent-office/<owner>/<repo>`, separati dalle copie in `D:\utente\Desktop\...` dove Christian lavora con altre sessioni: va bene cosi', e' meglio che i lavoratori non scrivano nella stessa cartella. Ogni piano tiene il suo stato in una cartella `.agent-office/` dentro il clone.
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

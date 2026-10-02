# office (copia di Ctrl Studio di agent-office)

Questa repo e' la copia privata di Ctrl Studio di [AgentSystemLabs/agent-office](https://github.com/AgentSystemLabs/agent-office) (licenza MIT, il file `LICENSE` resta com'e'). Serve a una cosa: un ufficio dove si vede quali agenti stanno lavorando e quali aspettano una persona, prima per le sessioni Claude Code, poi per la Flotta di ctrlOS. Il piano, passo per passo, e' in [`docs/ctrl/PIANO.md`](docs/ctrl/PIANO.md): leggilo prima di cambiare qualcosa.

Chi lavora qui parla italiano, e anche le risposte sono in italiano. Il codice e i commenti seguono lo stile inglese del progetto originale, cosi' gli aggiornamenti da sopra si fondono senza attriti.

## Regole nostre

- Niente trattini lunghi, in nessun testo (chat, documenti, interfaccia).
- Niente servizi a pagamento nuovi: open source, meglio se gira nel browser o sul nostro computer.
- Il nostro lavoro sta in file e cartelle nostre (`docs/ctrl/`, una cartella `ctrl` dentro `src/client/features/` o `src/server/`, mappe JSON in `.agent-office/maps/`). I file dell'originale si toccano il meno possibile, perche' ogni modifica li' diventa un conflitto al prossimo aggiornamento.
- Si committa su `main` di questa repo quando Christian lo chiede. Niente PR verso l'originale.

## Aggiornarsi dall'originale

`origin` e' questa repo (`kurisuchanxxx/office`), `upstream` e' l'originale. Per prendere le novita':

```bash
git fetch upstream
git merge upstream/main
```

Il progetto originale cambia spesso e rompe le cose senza avvisare: dopo ogni merge `npm install`, `npm run typecheck`, `npm test`, e una prova dal vivo.

## Le regole dell'originale

Valgono quelle tecniche di `AGENTS.md`: le funzioni nuove entrano dai registri come moduli propri (vedi `docs/code-layout.md`) e mai in `main.ts`, `server.ts`, lo store o `protocol.ts`; `tests/size.test.ts` deve restare verde; ogni finestra ha la ✕ in alto a destra e con ✕ o Esc si torna alla visuale col mouse; si verifica con `npm run typecheck`, `npm test`, `npm run build`.

NON valgono, perche' parlano del flusso dell'autore originale: aprire una PR per ogni modifica, lavorare sempre in un worktree, e la regola su quali PR unire.

@AGENTS.md

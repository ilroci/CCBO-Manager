# Certificati CA aggiuntivi (opzionale)

Se la rete ispeziona l'HTTPS (proxy aziendali, Cisco Umbrella, Zscaler...), durante la
build delle immagini `npm`, `apk` e Prisma non riescono a scaricare nulla:
`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`.

Metti qui il certificato radice del proxy in formato PEM con estensione `.crt`: in fase
di build viene aggiunto al trust store delle immagini. Su una rete normale lascia la
cartella vuota e la build funziona lo stesso. I `.crt` sono esclusi da git.

Per capire quale CA firma il traffico:

```bash
echo | openssl s_client -connect registry.npmjs.org:443 -showcerts 2>/dev/null | grep -E 's:|i:'
```

Da WSL, per esportare il certificato dall'archivio di Windows (esempio con Cisco Umbrella,
sostituisci il thumbprint con quello trovato in `Cert:\LocalMachine\Root`):

```bash
powershell.exe -NoProfile -Command "\$c = Get-Item Cert:\LocalMachine\Root\C5091132E9ADF8AD3E33932AE60A5C8FA939E824; '-----BEGIN CERTIFICATE-----'; [Convert]::ToBase64String(\$c.RawData, 'InsertLineBreaks'); '-----END CERTIFICATE-----'" \
  | tr -d '\r' > docker/certs/cisco-umbrella-root.crt
```

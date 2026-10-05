import { isAuthenticated } from "../state/auth-store.js";

const OPERATOR = {
  name: "Markus Haack",
  street: "Immischweg 3",
  city: "04279 Leipzig",
  email: "info@markus-haack.de",
};

function externalLink(href, label) {
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

/** Links an article of the DSGVO on dejure.org. */
function dsgvo(article, label = `Art. ${article} DSGVO`) {
  return externalLink(`https://dejure.org/gesetze/DSGVO/${article}.html`, label);
}

export function renderRechtliches(container) {
  // Reachable logged out (from the login screen), where there is no Mehr to go back to.
  const back = isAuthenticated()
    ? `<a class="back-link" href="#/mehr">‹ Mehr</a>`
    : `<a class="back-link" href="#/heute">‹ Anmelden</a>`;

  container.innerHTML = `
    <div class="view view--detail">
      ${back}
      <h1 class="view-title">Rechtliches</h1>

      <section class="legal" aria-labelledby="impressum">
        <h2 id="impressum">Impressum</h2>
        <p>Angaben gemäß § 5 DDG</p>
        <p>
          ${OPERATOR.name}<br>
          ${OPERATOR.street}<br>
          ${OPERATOR.city}
        </p>
        <p>E-Mail: <a href="mailto:${OPERATOR.email}">${OPERATOR.email}</a></p>
        <p>
          bessere.schule ist ein privates, nicht-kommerzielles Projekt. Es ist eine
          inoffizielle App und nicht mit beste.schule oder deren Betreiber verbunden.
        </p>
      </section>

      <section class="legal" aria-labelledby="datenschutz">
        <h2 id="datenschutz">Datenschutz</h2>

        <h3>Das Wichtigste in Kürze</h3>
        <p>
          bessere.schule hat keinen eigenen Server, der deine Schuldaten verarbeitet.
          Noten, Stundenplan, Mitteilungen und alle anderen Daten aus beste.schule
          lädt dein Browser direkt von beste.schule. Sie werden nur auf deinem Gerät
          angezeigt und nie an uns oder an Dritte übertragen. Es werden keine Cookies
          gesetzt.
        </p>
        <p>
          Personenbezogene Daten verarbeiten wir nur, soweit es für eine
          funktionsfähige und nutzerfreundliche App erforderlich ist. „Verarbeitung"
          meint dabei nach ${dsgvo(4, "Art. 4 Nr. 2 DSGVO")} jeden Vorgang im
          Zusammenhang mit personenbezogenen Daten, etwa das Erheben, Speichern,
          Abfragen, Übermitteln oder Löschen. Im Folgenden erfährst du Art, Umfang,
          Zweck, Dauer und Rechtsgrundlage der Verarbeitung sowie, welche Dienste
          Dritter dabei Daten in eigener Verantwortung verarbeiten.
        </p>

        <h3>I. Verantwortlicher</h3>
        <p>Verantwortlicher Anbieter dieser App im datenschutzrechtlichen Sinne ist:</p>
        <p>
          ${OPERATOR.name}<br>
          ${OPERATOR.street}<br>
          ${OPERATOR.city}<br>
          E-Mail: <a href="mailto:${OPERATOR.email}">${OPERATOR.email}</a>
        </p>

        <h3>II. Deine Rechte</h3>
        <p>
          Wir selbst speichern keine Daten über dich. Soweit Dienste, die wir
          einsetzen, kurzzeitig Verbindungsdaten verarbeiten (siehe unten), hast du das
          Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und
          Datenübertragbarkeit (${dsgvo(15, "Art. 15–20 DSGVO")}) sowie auf Beschwerde
          bei einer Aufsichtsbehörde (${dsgvo(77)}).
          <strong>
            Außerdem kannst du jeder Verarbeitung auf Grundlage von Art. 6 Abs. 1
            lit. f DSGVO widersprechen (${dsgvo(21)}).
          </strong>
          Eine E-Mail an <a href="mailto:${OPERATOR.email}">${OPERATOR.email}</a> genügt.
        </p>

        <h3>III. Informationen zur Datenverarbeitung</h3>
        <p>
          Daten, die bei der Nutzung der App verarbeitet werden, werden gelöscht oder
          gesperrt, sobald der Zweck der Speicherung entfällt und keine gesetzlichen
          Aufbewahrungspflichten entgegenstehen, soweit unten nichts anderes angegeben ist.
        </p>

        <h4>Hosting</h4>
        <p>
          Die Dateien der App werden über Cloudflare Pages ausgeliefert (Cloudflare,
          Inc., 101 Townsend St, San Francisco, CA 94107, USA). Beim Aufruf verarbeitet
          Cloudflare technisch notwendige Verbindungsdaten wie IP-Adresse, Zeitpunkt,
          angefragte Datei und Browserkennung, um die Seite auszuliefern und vor
          Angriffen zu schützen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser
          berechtigtes Interesse ist ein sicherer und zuverlässiger Betrieb. Cloudflare
          ist nach dem EU-US Data Privacy Framework zertifiziert.
        </p>

        <h4>Anmeldung und Daten aus beste.schule</h4>
        <p>
          Die Anmeldung läuft über OAuth direkt bei beste.schule; dein Passwort gibst
          du nur dort ein. Das Zugangstoken speichert dein Browser: mit „Angemeldet
          bleiben" dauerhaft im lokalen Speicher, sonst nur bis zum Schließen des Tabs.
          Abgerufene Daten werden nur im Arbeitsspeicher des geöffneten Tabs
          zwischengespeichert. Beim Abmelden wird das Token gelöscht. Für die
          Verarbeitung bei beste.schule gilt deren
          ${externalLink("https://beste.schule/privacy", "Datenschutzerklärung")}.
        </p>

        <h4>Einstellungen und Offline-Nutzung</h4>
        <p>
          Deine Einstellungen (Darstellung, Tageswechsel) speichert dein Browser lokal.
          Damit die App auch offline startet, legt sie ihre eigenen Programmdateien im
          Browser-Cache ab — keine Schuldaten. Diese Speicherung ist für die von dir
          gewünschte Funktion unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG).
        </p>

        <h4>Ferientermine</h4>
        <p>
          Für die Namen und Zeiträume der Schulferien ruft die App
          ${externalLink("https://schulferien-api.de", "schulferien-api.de")} auf. Dabei
          wird nur das Bundesland abgefragt; technisch bedingt erhält der Server deine
          IP-Adresse. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.
        </p>

        <h4>Reichweitenmessung mit Pirsch</h4>
        <p>
          Um zu sehen, wie viele Menschen die App nutzen, verwenden wir
          ${externalLink("https://pirsch.io", "Pirsch Analytics")} (Emvi Software GmbH,
          Deutschland). Pirsch kommt ohne Cookies aus und speichert keine IP-Adressen:
          aus IP-Adresse, Browserkennung und einem täglich wechselnden Zufallswert wird
          ein anonymer Wert gebildet, mit dem sich Besuche zählen, aber keine Personen
          wiedererkennen lassen. Erfasst werden nur der Seitenaufruf sowie Browser,
          Betriebssystem, Gerätetyp und Land — nie Daten aus beste.schule.
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.
        </p>

        <p class="legal-date">Stand: Oktober 2026</p>
      </section>
    </div>`;
}

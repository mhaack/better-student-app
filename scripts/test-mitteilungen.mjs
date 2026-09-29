// Announcements (Mitteilungen): mapper, the Markdown subset, attachment
// extraction and the Heute/unread selection. Raw items mirror the shape the
// live API returns (docs/api-notes.md); the texts are made up.
import assert from "node:assert/strict";
import { mapAnnouncement } from "../public/js/api/mappers.js";
import { renderMessage, splitAttachments, messagePreview } from "../public/js/domain/markdown.js";
import { prepareMitteilungen } from "../public/js/data/mitteilungen.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

function rawAnnouncement(overrides = {}) {
  return {
    id: 2982,
    title: "Belehrung Sportunterricht",
    message: "Liebe Erziehungsberechtigte,\n\nbitte lesen Sie die Belehrung.\n\nDie Fachschaft Sport  \n\n[Belehrung.pdf](/attachments/463)",
    read_from: "2026-08-17",
    read_to: "2027-09-01",
    write_from: "2026-08-01",
    write_to: "2026-10-01",
    for: "guardian",
    need_confirmation_from_student: 0,
    need_confirmation_from_guardian: 1,
    read_students_count: 0,
    read_guardians_count: 1,
    single_group: false,
    type: { id: 520, name: "Elternbrief", color: null, default: 0, default_for: "student" },
    teacher: { id: 1, local_id: "MUE", forename: "Anna", name: "Müller", tags: [] },
    ...overrides,
  };
}

// --- mapper ---------------------------------------------------------------

test("mapAnnouncement: date comes from read_from (there is no created_at)", () => {
  const a = mapAnnouncement(rawAnnouncement());
  assert.equal(a.date, "2026-08-17");
  assert.equal(a.visibleUntil, "2027-09-01");
});

test("mapAnnouncement: read state comes from the viewer-scoped read counts", () => {
  assert.equal(mapAnnouncement(rawAnnouncement()).readCount, 1);
  assert.equal(mapAnnouncement(rawAnnouncement({ read_guardians_count: 0 })).readCount, 0);
  assert.equal(mapAnnouncement(rawAnnouncement({ read_guardians_count: 0, read_students_count: 1 })).readCount, 1);
  // Without the include the counts are absent — treat as unread, not crash.
  const { read_guardians_count, read_students_count, ...bare } = rawAnnouncement();
  assert.equal(mapAnnouncement(bare).readCount, 0);
});

test("mapAnnouncement: title, body, type, author, confirmation flag", () => {
  const a = mapAnnouncement(rawAnnouncement());
  assert.equal(a.id, 2982);
  assert.equal(a.title, "Belehrung Sportunterricht");
  assert.match(a.body, /^Liebe Erziehungsberechtigte,/);
  assert.equal(a.type, "Elternbrief");
  assert.equal(a.author, "Anna Müller");
  assert.equal(a.needsConfirmation, true);
});

test("mapAnnouncement: no teacher include, no confirmation", () => {
  const a = mapAnnouncement(
    rawAnnouncement({ teacher: undefined, need_confirmation_from_guardian: 0, need_confirmation_from_student: 0 })
  );
  assert.equal(a.author, null);
  assert.equal(a.needsConfirmation, false);
});

// --- Markdown subset --------------------------------------------------------

test("renderMessage: paragraphs on blank lines, <br> on single newlines", () => {
  assert.equal(renderMessage("Eins\n\nZwei\nDrei"), "<p>Eins</p><p>Zwei<br>Drei</p>");
});

test("renderMessage: Markdown hard break (two trailing spaces) is a plain <br>", () => {
  assert.equal(renderMessage("Mit freundlichen Grüßen  \nDie Schulleitung"), "<p>Mit freundlichen Grüßen<br>Die Schulleitung</p>");
});

test("renderMessage: CRLF behaves like LF", () => {
  assert.equal(renderMessage("Eins\r\n\r\nZwei"), "<p>Eins</p><p>Zwei</p>");
});

test("renderMessage: **bold**", () => {
  assert.equal(renderMessage("**Wichtig:** morgen frei"), "<p><strong>Wichtig:</strong> morgen frei</p>");
});

test("renderMessage: HTML in the body is escaped, never interpreted", () => {
  assert.equal(
    renderMessage('<script>alert(1)</script> & <b onclick="x">'),
    "<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &lt;b onclick=&quot;x&quot;&gt;</p>"
  );
});

test("renderMessage: relative link resolves against beste.schule", () => {
  assert.equal(
    renderMessage("[Plan](/files/plan)"),
    '<p><a href="https://beste.schule/files/plan" target="_blank" rel="noopener noreferrer">Plan</a></p>'
  );
});

test("renderMessage: absolute https link is kept, & in the URL escaped", () => {
  assert.equal(
    renderMessage("Siehe [Seite](https://example.org/a?b=1&c=2)."),
    '<p>Siehe <a href="https://example.org/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">Seite</a>.</p>'
  );
});

test("renderMessage: javascript: and data: links stay plain text", () => {
  assert.equal(renderMessage("[klick](javascript:alert(1))"), "<p>[klick](javascript:alert(1))</p>");
  assert.equal(renderMessage("[x](data:text/html,hi)"), "<p>[x](data:text/html,hi)</p>");
});

test("renderMessage: link text is escaped", () => {
  assert.equal(
    renderMessage("[<img src=x>](https://example.org)"),
    '<p><a href="https://example.org/" target="_blank" rel="noopener noreferrer">&lt;img src=x&gt;</a></p>'
  );
});

test("renderMessage: bare URL is linked, trailing punctuation stays outside", () => {
  assert.equal(
    renderMessage("Infos unter https://example.org/info."),
    '<p>Infos unter <a href="https://example.org/info" target="_blank" rel="noopener noreferrer">https://example.org/info</a>.</p>'
  );
});

test("renderMessage: flattened '- a, - b' lists and other syntax stay literal", () => {
  assert.equal(renderMessage("empfehlen wir: - in Gruppen, - Notruf 110."), "<p>empfehlen wir: - in Gruppen, - Notruf 110.</p>");
  assert.equal(renderMessage("# Titel _kursiv_"), "<p># Titel _kursiv_</p>");
});

test("renderMessage: empty body renders nothing", () => {
  assert.equal(renderMessage(""), "");
  assert.equal(renderMessage("\n\n  \n"), "");
});

// --- attachments ------------------------------------------------------------

test("splitAttachments: /attachments/:id links become attachments and leave the body", () => {
  const { body, attachments } = splitAttachments(rawAnnouncement().message);
  assert.deepEqual(attachments, [{ id: 463, name: "Belehrung.pdf", url: "https://beste.schule/attachments/463" }]);
  assert.equal(body, "Liebe Erziehungsberechtigte,\n\nbitte lesen Sie die Belehrung.\n\nDie Fachschaft Sport");
});

test("splitAttachments: absolute beste.schule attachment URL, duplicates collapsed", () => {
  const { attachments } = splitAttachments(
    "[A.pdf](https://beste.schule/attachments/7) und nochmal [A.pdf](/attachments/7)"
  );
  assert.deepEqual(attachments, [{ id: 7, name: "A.pdf", url: "https://beste.schule/attachments/7" }]);
});

test("splitAttachments: other links stay in the body", () => {
  const { body, attachments } = splitAttachments("Siehe [Seite](https://example.org/attachments/1).");
  assert.deepEqual(attachments, []);
  assert.equal(body, "Siehe [Seite](https://example.org/attachments/1).");
});

// --- preview ------------------------------------------------------------------

test("messagePreview: skips the salutation, strips Markdown, one line", () => {
  const preview = messagePreview("Liebe Eltern,\n\n**Morgen** fällt der\nUnterricht aus. [Plan](/attachments/1)");
  assert.equal(preview, "Morgen fällt der Unterricht aus. Plan");
});

test("messagePreview: keeps the first paragraph when it isn't a salutation", () => {
  assert.equal(messagePreview("**Information zur Lage**\n\nLiebe Eltern,"), "Information zur Lage Liebe Eltern,");
});

test("messagePreview: long text is cut with an ellipsis", () => {
  const preview = messagePreview("x".repeat(500));
  assert.equal(preview.length, 160);
  assert.ok(preview.endsWith("…"));
});

// --- selection ---------------------------------------------------------------

const TODAY = new Date(2026, 8, 29); // 29.09.2026

function mapped(overrides) {
  return mapAnnouncement(rawAnnouncement(overrides));
}

test("prepareMitteilungen: newest first, id breaks ties", () => {
  const { items } = prepareMitteilungen(
    [
      mapped({ id: 1, read_from: "2026-08-17" }),
      mapped({ id: 2, read_from: "2026-09-23" }),
      mapped({ id: 3, read_from: "2026-09-23" }),
    ],
    TODAY
  );
  assert.deepEqual(items.map((i) => i.id), [3, 2, 1]);
});

test("prepareMitteilungen: read, attachments and preview per item", () => {
  const [item] = prepareMitteilungen([mapped()], TODAY).items;
  assert.equal(item.read, true);
  assert.equal(item.attachments.length, 1);
  assert.doesNotMatch(item.body, /attachments/);
  assert.equal(item.preview, "bitte lesen Sie die Belehrung. Die Fachschaft Sport");
});

test("prepareMitteilungen: fresh = unread and at most 14 days old", () => {
  const { fresh, unreadCount } = prepareMitteilungen(
    [
      mapped({ id: 1, read_from: "2026-09-23", read_guardians_count: 0 }), // unread, 6 days
      mapped({ id: 2, read_from: "2026-09-15", read_guardians_count: 0 }), // unread, exactly 14 days
      mapped({ id: 3, read_from: "2026-09-14", read_guardians_count: 0 }), // unread, 15 days — too old for Heute
      mapped({ id: 4, read_from: "2026-09-28", read_guardians_count: 1 }), // read
    ],
    TODAY
  );
  assert.deepEqual(fresh.map((i) => i.id), [1, 2]);
  assert.equal(unreadCount, 3);
});

test("prepareMitteilungen: nothing new → empty fresh list", () => {
  const { fresh, unreadCount } = prepareMitteilungen([mapped()], TODAY);
  assert.deepEqual(fresh, []);
  assert.equal(unreadCount, 0);
});

console.log(`\n${passed} passed`);

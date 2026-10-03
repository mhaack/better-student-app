// The Markdown subset of announcement bodies: safe HTML, attachments, previews.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { renderMessage, splitAttachments, messagePreview } from "../../public/js/domain/markdown.js";
import { rawAnnouncement } from "../support/announcements.mjs";

describe("renderMessage", () => {
  test("paragraphs on blank lines, <br> on single newlines", () => {
    assert.equal(renderMessage("Eins\n\nZwei\nDrei"), "<p>Eins</p><p>Zwei<br>Drei</p>");
  });

  test("Markdown hard break (two trailing spaces) is a plain <br>", () => {
    assert.equal(renderMessage("Mit freundlichen Grüßen  \nDie Schulleitung"), "<p>Mit freundlichen Grüßen<br>Die Schulleitung</p>");
  });

  test("CRLF behaves like LF", () => {
    assert.equal(renderMessage("Eins\r\n\r\nZwei"), "<p>Eins</p><p>Zwei</p>");
  });

  test("**bold**", () => {
    assert.equal(renderMessage("**Wichtig:** morgen frei"), "<p><strong>Wichtig:</strong> morgen frei</p>");
  });

  test("HTML in the body is escaped, never interpreted", () => {
    assert.equal(
      renderMessage('<script>alert(1)</script> & <b onclick="x">'),
      "<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &lt;b onclick=&quot;x&quot;&gt;</p>"
    );
  });

  test("relative link resolves against beste.schule", () => {
    assert.equal(
      renderMessage("[Plan](/files/plan)"),
      '<p><a href="https://beste.schule/files/plan" target="_blank" rel="noopener noreferrer">Plan</a></p>'
    );
  });

  test("absolute https link is kept, & in the URL escaped", () => {
    assert.equal(
      renderMessage("Siehe [Seite](https://example.org/a?b=1&c=2)."),
      '<p>Siehe <a href="https://example.org/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">Seite</a>.</p>'
    );
  });

  test("javascript: and data: links stay plain text", () => {
    assert.equal(renderMessage("[klick](javascript:alert(1))"), "<p>[klick](javascript:alert(1))</p>");
    assert.equal(renderMessage("[x](data:text/html,hi)"), "<p>[x](data:text/html,hi)</p>");
  });

  test("link text is escaped", () => {
    assert.equal(
      renderMessage("[<img src=x>](https://example.org)"),
      '<p><a href="https://example.org/" target="_blank" rel="noopener noreferrer">&lt;img src=x&gt;</a></p>'
    );
  });

  test("bare URL is linked, trailing punctuation stays outside", () => {
    assert.equal(
      renderMessage("Infos unter https://example.org/info."),
      '<p>Infos unter <a href="https://example.org/info" target="_blank" rel="noopener noreferrer">https://example.org/info</a>.</p>'
    );
  });

  test("flattened '- a, - b' lists and other syntax stay literal", () => {
    assert.equal(renderMessage("empfehlen wir: - in Gruppen, - Notruf 110."), "<p>empfehlen wir: - in Gruppen, - Notruf 110.</p>");
    assert.equal(renderMessage("# Titel _kursiv_"), "<p># Titel _kursiv_</p>");
  });

  test("empty body renders nothing", () => {
    assert.equal(renderMessage(""), "");
    assert.equal(renderMessage("\n\n  \n"), "");
  });
});

describe("splitAttachments", () => {
  test("/attachments/:id links become attachments and leave the body", () => {
    const { body, attachments } = splitAttachments(rawAnnouncement().message);
    assert.deepEqual(attachments, [{ id: 463, name: "Belehrung.pdf", url: "https://beste.schule/attachments/463" }]);
    assert.equal(body, "Liebe Erziehungsberechtigte,\n\nbitte lesen Sie die Belehrung.\n\nDie Fachschaft Sport");
  });

  test("absolute beste.schule attachment URL, duplicates collapsed", () => {
    const { attachments } = splitAttachments(
      "[A.pdf](https://beste.schule/attachments/7) und nochmal [A.pdf](/attachments/7)"
    );
    assert.deepEqual(attachments, [{ id: 7, name: "A.pdf", url: "https://beste.schule/attachments/7" }]);
  });

  test("other links stay in the body", () => {
    const { body, attachments } = splitAttachments("Siehe [Seite](https://example.org/attachments/1).");
    assert.deepEqual(attachments, []);
    assert.equal(body, "Siehe [Seite](https://example.org/attachments/1).");
  });
});

describe("messagePreview", () => {
  test("skips the salutation, strips Markdown, one line", () => {
    const preview = messagePreview("Liebe Eltern,\n\n**Morgen** fällt der\nUnterricht aus. [Plan](/attachments/1)");
    assert.equal(preview, "Morgen fällt der Unterricht aus. Plan");
  });

  test("keeps the first paragraph when it isn't a salutation", () => {
    assert.equal(messagePreview("**Information zur Lage**\n\nLiebe Eltern,"), "Information zur Lage Liebe Eltern,");
  });

  test("long text is cut with an ellipsis", () => {
    const preview = messagePreview("x".repeat(500));
    assert.equal(preview.length, 160);
    assert.ok(preview.endsWith("…"));
  });
});

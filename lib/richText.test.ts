import { describe, expect, it } from "vitest";
import { htmlToDiscordMarkdown, isRichTextEmpty, looksLikeHtml, plainTextToHtml, sanitizeRichText, toEditorContent } from "./richText";

describe("looksLikeHtml", () => {
  it("distingue texto plano de HTML", () => {
    expect(looksLikeHtml("Just plain text.")).toBe(false);
    expect(looksLikeHtml("<p>Rich text.</p>")).toBe(true);
  });
});

describe("plainTextToHtml", () => {
  it("separa párrafos en blanco y convierte saltos de línea sueltos", () => {
    expect(plainTextToHtml("First paragraph.\n\nSecond paragraph.")).toBe("<p>First paragraph.</p><p>Second paragraph.</p>");
    expect(plainTextToHtml("Line one\nLine two")).toBe("<p>Line one<br>Line two</p>");
  });

  it("escapa caracteres especiales de HTML", () => {
    expect(plainTextToHtml("Tom & Jerry <fight>")).toBe("<p>Tom &amp; Jerry &lt;fight&gt;</p>");
  });

  it("da un string vacío para texto vacío", () => {
    expect(plainTextToHtml("")).toBe("");
    expect(plainTextToHtml("   ")).toBe("");
  });
});

describe("toEditorContent", () => {
  it("deja el HTML tal cual, pero convierte el texto plano", () => {
    expect(toEditorContent("<p>Already rich.</p>")).toBe("<p>Already rich.</p>");
    expect(toEditorContent("Plain.")).toBe("<p>Plain.</p>");
  });
});

describe("isRichTextEmpty", () => {
  it("trata un párrafo vacío de Tiptap como vacío, no como texto real", () => {
    expect(isRichTextEmpty("")).toBe(true);
    expect(isRichTextEmpty("<p></p>")).toBe(true);
    expect(isRichTextEmpty("<p>   </p>")).toBe(true);
  });

  it("cualquier texto real cuenta como no vacío", () => {
    expect(isRichTextEmpty("<p>Hi</p>")).toBe(false);
    expect(isRichTextEmpty("<h1>Title</h1>")).toBe(false);
  });
});

describe("sanitizeRichText", () => {
  it("deja pasar las etiquetas que produce la barra de herramientas", () => {
    const html = "<h1>Title</h1><p>Some <strong>bold</strong> and <em>italic</em> and <s>struck</s> text.</p><blockquote>Quote</blockquote><ul><li>One</li></ul><ol><li>Two</li></ol>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("deja pasar el color de texto pero nada más en el estilo", () => {
    expect(sanitizeRichText('<p><span style="color: #c4d82e">lime</span></p>')).toBe('<p><span style="color:#c4d82e">lime</span></p>');
  });

  it("descarta scripts, atributos peligrosos y etiquetas fuera de la lista", () => {
    expect(sanitizeRichText('<script>alert(1)</script><p onclick="evil()">Hi</p><img src="x">')).toBe("<p>Hi</p>");
    // El selector de color del editor solo produce hex (components/admin/RichTextEditor.tsx::COLOR_SWATCHES) —
    // cualquier otra propiedad de estilo (aquí, un intento de "position:fixed") se descarta igual.
    expect(sanitizeRichText('<p><span style="color:#d6293e;position:fixed">x</span></p>')).toBe('<p><span style="color:#d6293e">x</span></p>');
  });

  it("deja pasar la píldora de mención de rol (data-role-id)", () => {
    expect(sanitizeRichText('<p><span data-role-id="123456789">@Mods</span></p>')).toBe('<p><span data-role-id="123456789">@Mods</span></p>');
  });
});

describe("htmlToDiscordMarkdown", () => {
  it("traduce encabezados, negrita, cursiva y tachado a la sintaxis real de Discord", () => {
    expect(htmlToDiscordMarkdown("<h1>Title</h1><h2>Subtitle</h2>")).toBe("# Title\n\n## Subtitle");
    expect(htmlToDiscordMarkdown("<p>Some <strong>bold</strong> and <em>italic</em> and <s>struck</s> text.</p>")).toBe(
      "Some **bold** and *italic* and ~~struck~~ text.",
    );
  });

  it("descarta el color de texto pero conserva el texto de dentro", () => {
    expect(htmlToDiscordMarkdown('<p>Look at this <span style="color:#c4d82e">lime word</span>.</p>')).toBe("Look at this lime word.");
  });

  it("convierte citas y listas con y sin numerar", () => {
    expect(htmlToDiscordMarkdown("<blockquote>Line one\nLine two</blockquote>")).toBe("> Line one\n> Line two");
    expect(htmlToDiscordMarkdown("<ul><li>One</li><li>Two</li></ul>")).toBe("- One\n- Two");
    expect(htmlToDiscordMarkdown("<ol><li>First</li><li>Second</li></ol>")).toBe("1. First\n2. Second");
  });

  it("negrita y cursiva anidadas se resuelven las dos", () => {
    expect(htmlToDiscordMarkdown("<p><strong><em>both</em></strong></p>")).toBe("***both***");
  });

  it("separa párrafos con una línea en blanco y deshace las entidades HTML", () => {
    expect(htmlToDiscordMarkdown("<p>First &amp; foremost.</p><p>Second.</p>")).toBe("First & foremost.\n\nSecond.");
  });

  it("convierte una píldora de mención de rol en el token real que Discord pinga", () => {
    expect(htmlToDiscordMarkdown('<p>Hey <span data-role-id="123456789">@Mods</span>, look!</p>')).toBe("Hey <@&123456789>, look!");
  });

  it("un @everyone en texto plano se deja tal cual — Discord lo reconoce solo", () => {
    expect(htmlToDiscordMarkdown("<p>Attention @everyone!</p>")).toBe("Attention @everyone!");
  });
});

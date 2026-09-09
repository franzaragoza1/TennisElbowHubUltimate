"use client";

import { useEditor, useEditorState, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Placeholder } from "@tiptap/extension-placeholder";
import { useState } from "react";
import { AtSign, Bold, Heading1, Heading2, Italic, List, ListOrdered, Palette, Quote, Strikethrough } from "lucide-react";
import type { DiscordRoleOption } from "@/lib/discordBot/guildRoles";
import { escapeHtml, toEditorContent } from "@/lib/richText";

// Accesos rápidos de un click: el acento del sitio (CLAUDE.md §6) más un puñado de
// colores de estado ya usados en el resto de la UI (--up/--down/--blue-500). Pedido
// explícito: además de estos, el espectro completo vía un <input type="color"> nativo
// justo al lado (ColorPicker más abajo) — estos cinco no son el único límite.
const COLOR_SWATCHES = ["#c4d82e", "#2f8fff", "#0a9b4e", "#d6293e", "#e7e9ee"];

function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // Sin esto, el click roba el foco del editor ANTES del onClick — la selección de
      // texto se pierde y toggleBold()/etc. no tiene sobre qué actuar.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded transition-colors ${
        active ? "bg-accent-500 text-navy-900" : "text-ink hover:bg-paper"
      }`}
    >
      {children}
    </button>
  );
}

function ColorPicker({ onPick, onClear }: { onPick: (color: string) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <ToolbarButton label="Text color" onClick={() => setOpen((o) => !o)}>
        <Palette className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      {open && (
        <>
          {/* Capa para cerrar el desplegable al hacer click fuera, sin depender de un
           * listener global de document — mismo criterio ligero que el resto del sitio. */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 z-20 mt-1 flex items-center gap-2 rounded-lg border border-rule bg-paper p-2 shadow-lg">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(c);
                  setOpen(false);
                }}
                aria-label={`Color ${c}`}
                className="h-7 w-7 shrink-0 rounded-full border border-rule"
                style={{ backgroundColor: c }}
              />
            ))}
            <span className="mx-0.5 h-4 w-px shrink-0 bg-rule" />
            {/* Espectro completo — a diferencia de los botones de arriba, SIN
             * onMouseDown={preventDefault}: el diálogo nativo de color es en sí mismo
             * una interacción que necesita el foco de verdad para abrirse, y
             * `editor.chain().focus()` en el propio onChange ya recupera el foco del
             * editor sin perder la selección de texto (ProseMirror la conserva
             * internamente aunque el DOM haya estado enfocado en otro sitio mientras
             * tanto). */}
            <input
              type="color"
              onChange={(e) => {
                onPick(e.target.value);
                setOpen(false);
              }}
              aria-label="Custom color"
              title="Custom color"
              className="h-7 w-7 shrink-0 cursor-pointer rounded border border-rule bg-transparent p-0"
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="text-eyebrow ml-1 shrink-0 text-[10px] text-muted-label hover:text-ink"
            >
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Color de marca de Discord — mismo tono que usa la propia app para resaltar una
// mención, así que la píldora se reconoce de un vistazo dentro del editor. Puro
// adorno visual aquí: el color en sí se descarta al traducir a Markdown de Discord
// (lib/richText.ts::convertInlineMarksToDiscord), igual que cualquier otro span de
// color — lo que de verdad pinga es el `data-role-id` (rol) o el texto literal
// "@everyone" (Discord reconoce esa palabra clave el mismo, sin marcado especial).
const MENTION_COLOR = "#5865f2";

/** Desplegable de menciones del discurso de premios — "@everyone" siempre disponible,
 * más los roles reales del servidor si `options` trae alguno (lib/discordBot/
 * guildRoles.ts, puede venir vacío si el bot no está configurado). Pedido explícito:
 * "In the speech admins can tag, either roles or everyone". */
function MentionPicker({ options, onInsertEveryone, onInsertRole }: { options: DiscordRoleOption[]; onInsertEveryone: () => void; onInsertRole: (role: DiscordRoleOption) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <ToolbarButton label="Mention" onClick={() => setOpen((o) => !o)}>
        <AtSign className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 z-20 mt-1 max-h-56 w-48 overflow-y-auto rounded-lg border border-rule bg-paper p-1 shadow-lg">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onInsertEveryone();
                setOpen(false);
              }}
              className="w-full rounded px-2 py-1.5 text-left text-sm text-ink hover:bg-paper-tint"
            >
              @everyone
            </button>
            {options.length > 0 && <span className="my-1 block h-px bg-rule" />}
            {options.map((role) => (
              <button
                key={role.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onInsertRole(role);
                  setOpen(false);
                }}
                className="w-full truncate rounded px-2 py-1.5 text-left text-sm text-ink hover:bg-paper-tint"
              >
                @{role.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Editor de texto enriquecido compartido — noticias (components/admin/NewsForm.tsx) y
 * el discurso de premios (components/admin/sections/AwardsSection.tsx), pedido
 * explícito del propietario ("add a proper text editor"). Guarda su HTML en un
 * `<input type="hidden" name={name}>` para encajar SIN cambios en el patrón de envío
 * ya existente de esos formularios (`new FormData(e.currentTarget)` sobre un
 * `<form onSubmit>` normal) — el propio campo de texto nunca tuvo que dejar de ser
 * "un input más dentro del form" para el resto del código que lo rodea.
 *
 * `mentionOptions`: solo el discurso de premios lo pasa (AwardsSection.tsx) — noticias
 * nunca se publica en Discord (ver lib/richText.ts, htmlToDiscordMarkdown no tiene
 * ningún consumidor de noticias), así que el botón de mención se omite del todo ahí en
 * vez de enseñar una función que no haría nada.
 */
export function RichTextEditor({
  name,
  initialContent,
  placeholder,
  mentionOptions,
}: {
  name: string;
  initialContent: string;
  placeholder?: string;
  mentionOptions?: DiscordRoleOption[];
}) {
  const editor = useEditor({
    immediatelyRender: false, // evita el desajuste de hidratación de Next.js — el editor se monta solo en cliente
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      TextStyle,
      Color,
      Placeholder.configure({ placeholder: placeholder ?? "Write something…" }),
    ],
    content: toEditorContent(initialContent),
    editorProps: {
      attributes: {
        class: "rich-text min-h-[180px] rounded-b-lg border border-t-0 border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-blue-500",
      },
    },
  });

  // useEditorState (no un simple editor.isActive(...) leído en el render): Tiptap no
  // es estado de React por sí solo — sin suscribirse así a cada transacción, ni la
  // barra de herramientas (qué botón sale activo) ni el <input type="hidden"> de abajo
  // se enterarían de una tecla nueva o de mover el cursor.
  const state = useEditorState({
    editor,
    selector: (ctx) => ({
      html: ctx.editor?.getHTML() ?? "",
      isH1: ctx.editor?.isActive("heading", { level: 1 }) ?? false,
      isH2: ctx.editor?.isActive("heading", { level: 2 }) ?? false,
      isBold: ctx.editor?.isActive("bold") ?? false,
      isItalic: ctx.editor?.isActive("italic") ?? false,
      isStrike: ctx.editor?.isActive("strike") ?? false,
      isQuote: ctx.editor?.isActive("blockquote") ?? false,
      isBulletList: ctx.editor?.isActive("bulletList") ?? false,
      isOrderedList: ctx.editor?.isActive("orderedList") ?? false,
    }),
  });

  if (!editor || !state) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-rule bg-paper-tint px-1.5 py-1.5">
        <ToolbarButton label="Heading 1" active={state.isH1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Heading 2" active={state.isH2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-rule" />
        <ToolbarButton label="Bold" active={state.isBold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={state.isItalic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" active={state.isStrike} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Quote" active={state.isQuote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-rule" />
        <ToolbarButton label="Bullet list" active={state.isBulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={state.isOrderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-rule" />
        <ColorPicker
          onPick={(c) => editor.chain().focus().setColor(c).run()}
          onClear={() => editor.chain().focus().unsetColor().run()}
        />
        {mentionOptions && (
          <>
            <span className="mx-1 h-4 w-px bg-rule" />
            <MentionPicker
              options={mentionOptions}
              onInsertEveryone={() => editor.chain().focus().insertContent(`<span style="color:${MENTION_COLOR}">@everyone</span>&nbsp;`).run()}
              onInsertRole={(role) => editor.chain().focus().insertContent(`<span data-role-id="${role.id}" style="color:${MENTION_COLOR}">@${escapeHtml(role.name)}</span>&nbsp;`).run()}
            />
          </>
        )}
      </div>
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={state.html} readOnly />
    </div>
  );
}

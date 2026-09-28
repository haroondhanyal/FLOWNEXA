"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Bold, Code2, Heading1, Heading2, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Save, Strikethrough, Table2, Underline, Undo2 } from "lucide-react";
import type { WorkspaceScreenProps } from "./types";

type Note = { id: string; title: string; content: string; updatedAt: string; author: { id: string; name: string } };
const toolbarItems = [
  { label: "Bold", icon: Bold, command: "bold" }, { label: "Italic", icon: Italic, command: "italic" }, { label: "Underline", icon: Underline, command: "underline" }, { label: "Strike through", icon: Strikethrough, command: "strikeThrough" },
  { label: "Heading 1", icon: Heading1, command: "formatBlock", value: "h1" }, { label: "Heading 2", icon: Heading2, command: "formatBlock", value: "h2" }, { label: "Bulleted list", icon: List, command: "insertUnorderedList" }, { label: "Numbered list", icon: ListOrdered, command: "insertOrderedList" },
  { label: "Quote", icon: Quote, command: "formatBlock", value: "blockquote" }, { label: "Code", icon: Code2, command: "formatBlock", value: "pre" }, { label: "Undo", icon: Undo2, command: "undo" }, { label: "Redo", icon: Redo2, command: "redo" },
];
const safePasteTags = new Set(["A", "B", "BLOCKQUOTE", "BR", "CODE", "DIV", "EM", "H1", "H2", "H3", "HR", "I", "IMG", "LI", "OL", "P", "PRE", "S", "SPAN", "STRIKE", "STRONG", "TABLE", "TBODY", "TD", "TH", "THEAD", "TR", "U", "UL"]);

// PASTE SECURITY: pasted rich text is parsed inertly, then stripped to the editor's supported formatting tags.
function safePastedHtml(html: string) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll("script,style,iframe,object,embed,svg,math,form,input,button,video,audio,template").forEach((node) => node.remove());
  parsed.body.querySelectorAll("*").forEach((element) => {
    if (!safePasteTags.has(element.tagName)) { element.replaceWith(...Array.from(element.childNodes)); return; }
    const href = element.tagName === "A" ? element.getAttribute("href") : null;
    const src = element.tagName === "IMG" ? element.getAttribute("src") : null;
    const alt = element.tagName === "IMG" ? element.getAttribute("alt") : null;
    const style = element.getAttribute("style")?.split(";").filter((rule) => /^(color|background-color|font-family|font-size|font-weight|font-style|text-align|text-decoration)\s*:/i.test(rule) && !/(url|expression|javascript)/i.test(rule)).join(";");
    Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));
    if (href && /^https?:\/\//i.test(href)) element.setAttribute("href", href);
    if (src && /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(src)) element.setAttribute("src", src);
    if (alt && element.tagName === "IMG") element.setAttribute("alt", alt.slice(0, 200));
    if (style) element.setAttribute("style", style);
  });
  return parsed.body.innerHTML;
}

// NOTES: shared organization notes with a focused rich-text editor and explicit save/delete actions.
export function NotesScreen({ organizationId, onMessage }: WorkspaceScreenProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const base = `/organizations/${organizationId}/notes`;
  const selected = notes.find((note) => note.id === selectedId);

  useEffect(() => {
    let live = true;
    apiFetch<Note[]>(base).then((items) => { if (live) { setNotes(items); if (items[0]) { setSelectedId(items[0].id); setTitle(items[0].title); setContent(items[0].content); } } }).catch((error) => onMessage(error instanceof Error ? error.message : "Could not load notes"));
    return () => { live = false; };
  }, [base, onMessage]);

  useEffect(() => { if (editor.current && !preview && editor.current.innerHTML !== content) editor.current.innerHTML = content; }, [selectedId, preview, content]);

  const chooseNote = (note: Note) => { setSelectedId(note.id); setTitle(note.title); setContent(note.content); setPreview(false); };
  const newNote = async () => {
    setBusy(true);
    try { const note = await apiFetch<Note>(base, { method: "POST", body: JSON.stringify({ title: "Untitled note", content: "" }) }); setNotes((current) => [note, ...current]); chooseNote(note); onMessage("Note created"); }
    catch (error) { onMessage(error instanceof Error ? error.message : "Could not create note"); }
    finally { setBusy(false); }
  };
  const saveNote = async () => {
    if (!selected) return;
    const nextContent = editor.current && !preview ? editor.current.innerHTML : content;
    setBusy(true);
    try { const saved = await apiFetch<Note>(`${base}/${selected.id}`, { method: "PUT", body: JSON.stringify({ title, content: nextContent }) }); setNotes((current) => [saved, ...current.filter((item) => item.id !== saved.id)]); setContent(nextContent); onMessage("Note saved"); }
    catch (error) { onMessage(error instanceof Error ? error.message : "Could not save note"); }
    finally { setBusy(false); }
  };
  const deleteNote = async () => {
    if (!selected || !window.confirm(`Delete “${selected.title}”? This cannot be undone.`)) return;
    try { await apiFetch(`${base}/${selected.id}`, { method: "DELETE" }); const remaining = notes.filter((note) => note.id !== selected.id); setNotes(remaining); if (remaining[0]) chooseNote(remaining[0]); else { setSelectedId(""); setTitle(""); setContent(""); } onMessage("Note deleted"); }
    catch (error) { onMessage(error instanceof Error ? error.message : "Could not delete note"); }
  };
  const runCommand = (command: string, value?: string) => { editor.current?.focus(); document.execCommand(command, false, value); if (editor.current) setContent(editor.current.innerHTML); };
  const insertLink = () => { const url = window.prompt("Paste a link URL (https://…)"); if (url && /^https?:\/\//i.test(url)) runCommand("createLink", url); };
  const insertTable = () => { editor.current?.focus(); document.execCommand("insertHTML", false, '<table border="1"><tbody><tr><th>Column 1</th><th>Column 2</th></tr><tr><td>Write here</td><td>Write here</td></tr></tbody></table><p><br></p>'); if (editor.current) setContent(editor.current.innerHTML); };
  const insertImage = (file?: File) => { if (!file || !file.type.startsWith("image/") || file.size > 1024 * 1024) { onMessage("Choose an image under 1 MB"); return; } const reader = new FileReader(); reader.onload = () => { editor.current?.focus(); document.execCommand("insertHTML", false, `<img src="${reader.result}" alt="${file.name.replace(/[&<>"']/g, "")}" style="max-width:100%;height:auto" />`); if (editor.current) setContent(editor.current.innerHTML); }; reader.readAsDataURL(file); };
  const previewDocument = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>body{font:15px/1.7 system-ui,sans-serif;color:#29283a;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px}blockquote{border-left:3px solid #8475d0;margin-left:0;padding-left:14px;color:#777}img{max-width:100%;height:auto}pre{white-space:pre-wrap;background:#f5f4fa;padding:12px}</style></head><body>${content}</body></html>`;

  return <div className="notes-layout"><aside className="notes-list"><div className="notes-list-head"><div><b>All notes</b><small>{notes.length} notes · shared with this workspace</small></div><button className="primary-button" onClick={() => void newNote()} disabled={busy}>＋ New</button></div>{notes.map((note) => <button key={note.id} className={`note-list-item ${selectedId === note.id ? "selected" : ""}`} onClick={() => chooseNote(note)}><b>{note.title || "Untitled note"}</b><span>{note.content.replace(/<[^>]*>/g, " ").slice(0, 90) || "Start writing…"}</span><small>Edited {new Date(note.updatedAt).toLocaleDateString()} · {note.author.name}</small></button>)}{!notes.length && <p className="notes-empty">No notes yet. Create one to start capturing ideas.</p>}</aside>
    <section className="note-editor-panel">{selected ? <><header className="note-editor-header"><div><input className="note-title-input" aria-label="Note title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Untitled note"/><small>Edited by {selected.author.name} · {new Date(selected.updatedAt).toLocaleString()}</small></div><div><button className="secondary-button" onClick={() => setPreview((value) => !value)}>{preview ? "Edit" : "Preview"}</button> <button className="primary-button" onClick={() => void saveNote()} disabled={busy}><Save size={15}/>{busy ? "Saving…" : "Save"}</button> <button className="secondary-button danger-text" onClick={() => void deleteNote()}>Delete</button></div></header>{!preview && <div className="note-toolbar" aria-label="Text formatting toolbar">{toolbarItems.map(({ label, icon: Icon, command, value }) => <button key={label} type="button" title={label} aria-label={label} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand(command, value)}><Icon size={16}/></button>)}<span className="note-toolbar-divider"/><select aria-label="Font family" defaultValue="Arial" onChange={(event) => runCommand("fontName", event.target.value)}><option>Arial</option><option>Georgia</option><option>Times New Roman</option><option>Verdana</option></select><label title="Text color" className="note-color-control">A<input aria-label="Text color" type="color" onChange={(event) => runCommand("foreColor", event.target.value)}/></label><label title="Highlight color" className="note-color-control">▰<input aria-label="Highlight color" type="color" defaultValue="#fff0a8" onChange={(event) => { editor.current?.focus(); document.execCommand("hiliteColor", false, event.target.value); if (editor.current) setContent(editor.current.innerHTML); }}/></label><button type="button" title="Insert link" aria-label="Insert link" onClick={insertLink}><Link2 size={16}/></button><button type="button" title="Insert table" aria-label="Insert table" onClick={insertTable}><Table2 size={16}/></button><button type="button" title="Insert image" aria-label="Insert image" onClick={() => imageInput.current?.click()}><ImagePlus size={16}/></button><input ref={imageInput} hidden type="file" accept="image/*" onChange={(event) => insertImage(event.target.files?.[0])}/><button type="button" title="Horizontal rule" aria-label="Horizontal rule" onClick={() => runCommand("insertHorizontalRule")}><Minus size={16}/></button></div>}{preview ? <iframe className="note-preview" title="Safe note preview" sandbox="" srcDoc={previewDocument}/> : <div ref={editor} className="rich-note-editor" contentEditable suppressContentEditableWarning role="textbox" aria-label="Note content" aria-multiline="true" data-placeholder="Start writing your note…" onPaste={(event) => { event.preventDefault(); const html = event.clipboardData.getData("text/html"); document.execCommand(html ? "insertHTML" : "insertText", false, html ? safePastedHtml(html) : event.clipboardData.getData("text/plain")); if (editor.current) setContent(editor.current.innerHTML); }} onInput={(event) => setContent(event.currentTarget.innerHTML)}/>}</> : <div className="note-no-selection"><h2>Your notes, in one place</h2><p>Create a note for meeting minutes, project plans, checklists, or team knowledge.</p><button className="primary-button" onClick={() => void newNote()}>Create your first note</button></div>}</section></div>;
}

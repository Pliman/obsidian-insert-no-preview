# Insert No Preview

[中文文档](README_CN.md)

## Features

This plugin aims to solve the problem where Obsidian, when inserting certain types of files (especially `.pdf` files), defaults to creating an embedded preview (`![[filename.extension]]`) instead of a normal internal link (`[[filename.extension]]`).

## Why This Plugin?

When large files (like multi-page PDFs or large images) are embedded in notes, their previews take up significant vertical space, making it difficult and inconvenient to view or edit content below the preview. For some file types (like `.exe`, `.zip`), embedded previews are meaningless.

This plugin allows users to specify which file extensions should not generate previews when inserted, but instead generate a simple internal link, thus keeping notes clean and easy to use.

## Core Implementation Logic

The plugin listens for file insertion events in the editor, determines the file type, and decides the format of the link to insert based on user configuration.

1.  **Event Listening:** The plugin primarily listens to the Obsidian editor's `editor-drop` (handling file drag-and-drop) and `editor-paste` (handling file pasting) events. These are the main ways users bring external files into notes.
2.  **File Type Detection:** In the event handler, the plugin checks if the dropped or pasted data contains files. If so, it extracts the name and extension of each file (e.g., extracting `.pdf` from `myfile.pdf`).
3.  **Configuration Loading:** The plugin loads a user-defined "non-preview extension list" from its settings.
4.  **Logic Check:** It compares the extension of the currently inserted file (normalized to lowercase and ensuring a leading dot `.`) against the extensions in the configuration list.
5.  **Link Formatting:**
    - If the file extension **matches** any item in the configuration list, the plugin generates a normal internal link: `[[filename.extension]]`.
    - If the file extension **does not match**, the plugin generates the default embedded link: `![[filename.extension]]` (or allows Obsidian's default behavior, depending on the implementation choice).
6.  **Link Insertion:** Uses the Obsidian `Editor` API (like `editor.replaceSelection()` or `editor.replaceRange()`) to insert the generated Markdown link text at the editor's current cursor position or the drop/paste location.
7.  **Prevent Default Behavior:** If the plugin successfully handles the file insertion (i.e., checked the extension and decided the link format), it calls `event.preventDefault()` and `event.stopPropagation()` to prevent Obsidian from performing its default file embedding action, avoiding duplicate insertions.

## Settings Interface

The plugin provides a settings panel allowing users to customize the file extensions that should be inserted as normal links.

- **Configuration Method:** Users can enter a list of extensions in a text area.
- **Format:** Extensions can be separated by commas (`,`) or newlines. Input can include or omit the leading dot (`.`), the plugin handles it automatically. E.g., you can enter: `.pdf, zip, .exe, .rar`.
- **Default Value:** When the plugin is first loaded, it provides a default list including `.pdf`, `.exe`, `.zip`, `.rar`.
- **Saving:** Settings are saved automatically and take effect the next time Obsidian starts.

## Plugin Structure

```
.
├── .gitignore
├── README.md        <- This English README
├── README_CN.md     <- Chinese README
├── main.ts
├── manifest.json
├── package.json
└── tsconfig.json
```

- `main.ts`: Main plugin logic, including `onload`, `onunload`, event handling, settings management.
- `manifest.json`: Plugin metadata.
- `README.md`: This document (English).
- `README_CN.md`: Chinese documentation.
- `package.json`: Node.js project dependencies and build scripts.
- `tsconfig.json`: TypeScript configuration.
- `.gitignore`: Git ignore configuration.

## Potential Future Features (Optional)

- Add context menu options to force insertion as a link or embed.
- Provide functionality to specify different rules per folder.
- Support more complex matching rules (e.g., regular expressions).

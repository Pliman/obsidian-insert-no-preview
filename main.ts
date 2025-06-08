import {
  App,
  Editor,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TextAreaComponent,
} from "obsidian";

// Define the interface for plugin settings
interface InsertNoPreviewSettings {
  globalNonPreviewExtensions: string[]; // Extensions to apply globally
  yamlNonPreviewExtensions: string[]; // Extensions to apply in YAML frontmatter
}

// Default settings
const DEFAULT_SETTINGS: InsertNoPreviewSettings = {
  globalNonPreviewExtensions: [".pdf", ".exe", ".zip", ".rar"],
  yamlNonPreviewExtensions: [".pdf", ".docx"], // Example defaults for YAML
};

// Plugin main class
export default class InsertNoPreviewPlugin extends Plugin {
  settings: InsertNoPreviewSettings;

  async onload() {
    await this.loadSettings();

    // Register editor event listeners
    this.registerEvent(
      this.app.workspace.on("editor-drop", this.handleFileInsert)
    );
    this.registerEvent(
      this.app.workspace.on("editor-paste", this.handleFileInsert)
    );

    console.log("Loading InsertNoPreview plugin with event listeners");

    // Add settings page
    this.addSettingTab(new InsertNoPreviewSettingTab(this.app, this));
  }

  // Check if cursor is in frontmatter
  private isCursorInFrontmatter(editor: Editor, view: MarkdownView): boolean {
    const cursor = editor.getCursor();
    const line = cursor.line;
    const content = editor.getValue();
    const lines = content.split("\n");

    // Check if the document starts with frontmatter (starts with ---)
    if (lines.length === 0 || lines[0].trim() !== "---") {
      return false;
    }

    // Find the end of frontmatter (second ---)
    let inFrontmatter = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        if (i === 0) {
          inFrontmatter = true; // Start of frontmatter
        } else if (inFrontmatter) {
          inFrontmatter = false; // End of frontmatter
          return line > 0 && line < i;
        }
      }
    }

    // If no closing ---, frontmatter is incomplete; assume cursor is in it if before end
    return inFrontmatter && line > 0;
  }

  // Event handler function
  private handleFileInsert = async (
    evt: DragEvent | ClipboardEvent,
    editor: Editor,
    view: MarkdownView
  ) => {
    // Ensure the event contains files
    const files =
      evt instanceof DragEvent
        ? evt.dataTransfer?.files
        : evt.clipboardData?.files;
    if (!files || files.length === 0) {
      return; // No files, do not process
    }

    // Determine which extension list to use based on cursor position
    const isInFrontmatter = this.isCursorInFrontmatter(editor, view);
    const nonPreviewExtensions = isInFrontmatter
      ? this.settings.yamlNonPreviewExtensions
      : this.settings.globalNonPreviewExtensions;

    // Prepare normalized extension list for checking
    const normalizedNonPreviewExtensions = nonPreviewExtensions.map((ext) =>
      ext.toLowerCase()
    );

    // Check if at least one file needs special handling (non-preview link)
    let hasFileToHandleManually = false;
    const fileList = Array.from(files);
    for (const file of fileList) {
      const fileName = file.name;
      const fileExt = fileName.includes(".")
        ? fileName.substring(fileName.lastIndexOf(".")).toLowerCase()
        : "";
      if (fileExt && normalizedNonPreviewExtensions.includes(fileExt)) {
        hasFileToHandleManually = true;
        break;
      }
    }

    // If no file needs special handling, allow default Obsidian behavior
    if (!hasFileToHandleManually) {
      return;
    }

    console.log(
      `InsertNoPreview: Found matching file(s), handling insertion manually in ${
        isInFrontmatter ? "YAML frontmatter" : "global context"
      }.`
    );

    // Prevent default Obsidian file handling
    evt.preventDefault();
    evt.stopPropagation();

    // Process all files asynchronously
    const linkPromises = fileList.map(async (file) => {
      const fileName = file.name;
      const fileExt = fileName.includes(".")
        ? fileName.substring(fileName.lastIndexOf(".")).toLowerCase()
        : "";

      try {
        // Determine the available attachment path
        const sourcePath = view.file ? view.file.path : "";
        const attachmentPath =
          await this.app.fileManager.getAvailablePathForAttachment(
            fileName,
            sourcePath
          );
        console.log(
          `InsertNoPreview: Determined available attachment path: ${attachmentPath}`
        );

        // Ensure the parent directory exists
        const parentDirectory = attachmentPath.substring(
          0,
          attachmentPath.lastIndexOf("/")
        );
        if (parentDirectory && parentDirectory !== "/") {
          try {
            await this.app.vault.createFolder(parentDirectory);
            console.log(
              `InsertNoPreview: Ensured parent directory exists: ${parentDirectory}`
            );
          } catch (err) {
            if (!err.message?.toLowerCase().includes("already exists")) {
              console.error(
                `InsertNoPreview: Error creating parent directory ${parentDirectory}:`,
                err
              );
              new Notice(
                `Error creating attachment folder ${parentDirectory}. See console.`
              );
              return "";
            }
          }
        } else if (parentDirectory === "/") {
          console.log(
            "InsertNoPreview: Attachment path is in root, no folder creation needed."
          );
        } else {
          console.warn(
            "InsertNoPreview: Could not determine parent directory from path:",
            attachmentPath
          );
          new Notice(
            `Could not determine parent folder for ${attachmentPath}.`
          );
          return "";
        }

        // Read file data
        const fileData = await file.arrayBuffer();

        // Save the file to the vault
        const savedTFile = await this.app.vault.createBinary(
          attachmentPath,
          fileData
        );
        console.log(`InsertNoPreview: Saved file to ${savedTFile.path}`);

        // Generate link text based on extension
        if (fileExt && normalizedNonPreviewExtensions.includes(fileExt)) {
          return `[[${savedTFile.name}]]`;
        } else {
          return `![[${savedTFile.name}]]`;
        }
      } catch (error) {
        console.error(
          `InsertNoPreview: Error processing file ${fileName}:`,
          error
        );
        new Notice(`Error saving file ${fileName}. See console for details.`);
        return "";
      }
    });

    // Wait for all file processing to complete
    const linkTexts = await Promise.all(linkPromises);

    // Filter out empty strings and join with newlines
    const combinedLinkText = linkTexts.filter((text) => text).join("\n");

    // Insert the generated link text
    if (combinedLinkText) {
      editor.replaceSelection(combinedLinkText);
    }
  };

  onunload() {
    console.log("Unloading InsertNoPreview plugin");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

// Plugin settings page class
class InsertNoPreviewSettingTab extends PluginSettingTab {
  plugin: InsertNoPreviewPlugin;

  constructor(app: App, plugin: InsertNoPreviewPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Insert No Preview Settings" });

    new Setting(containerEl)
      .setName("Global non-preview file extensions")
      .setDesc(
        "Files with these extensions will be inserted as links ([[file]]) instead of embeds (![[file]]) when pasted outside YAML frontmatter. Separate with commas (e.g., .pdf, .zip, .exe). Leading dot is optional."
      )
      .addTextArea((text: TextAreaComponent) =>
        text
          .setValue(this.plugin.settings.globalNonPreviewExtensions.join(", "))
          .onChange(async (value: string) => {
            const extensions = value
              .split(",")
              .map((ext: string) => ext.trim())
              .filter((ext: string) => ext.length > 0)
              .map((ext: string) => (ext.startsWith(".") ? ext : `.${ext}`))
              .map((ext: string) => ext.toLowerCase());
            this.plugin.settings.globalNonPreviewExtensions = [
              ...new Set(extensions),
            ];
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("YAML frontmatter non-preview file extensions")
      .setDesc(
        "Files with these extensions will be inserted as links ([[file]]) instead of embeds (![[file]]) when pasted within YAML frontmatter (between --- lines). Separate with commas (e.g., .pdf, .docx). Leading dot is optional."
      )
      .addTextArea((text: TextAreaComponent) =>
        text
          .setValue(this.plugin.settings.yamlNonPreviewExtensions.join(", "))
          .onChange(async (value: string) => {
            const extensions = value
              .split(",")
              .map((ext: string) => ext.trim())
              .filter((ext: string) => ext.length > 0)
              .map((ext: string) => (ext.startsWith(".") ? ext : `.${ext}`))
              .map((ext: string) => ext.toLowerCase());
            this.plugin.settings.yamlNonPreviewExtensions = [
              ...new Set(extensions),
            ];
            await this.plugin.saveSettings();
          })
      );
  }
}
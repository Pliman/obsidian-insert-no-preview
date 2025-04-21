import {
  App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TextAreaComponent,
  TFile,
} from "obsidian";

// Define the interface for plugin settings
interface InsertNoPreviewSettings {
  nonPreviewExtensions: string[];
}

// Default settings
const DEFAULT_SETTINGS: InsertNoPreviewSettings = {
  nonPreviewExtensions: [".pdf", ".exe", ".zip", ".rar"],
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

  // Event handler function
  private handleFileInsert = (
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

    // Check if at least one file needs special handling
    let hasFileToHandle = false;
    const normalizedNonPreviewExtensions =
      this.settings.nonPreviewExtensions.map((ext) => ext.toLowerCase());
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name;
      // Extract and normalize the extension (lowercase, with dot)
      const fileExt = fileName.includes(".")
        ? fileName.substring(fileName.lastIndexOf(".")).toLowerCase()
        : "";
      if (fileExt && normalizedNonPreviewExtensions.includes(fileExt)) {
        hasFileToHandle = true;
        break;
      }
    }

    // If no file needs special handling, allow default behavior
    if (!hasFileToHandle) {
      return;
    }

    // Prevent default Obsidian file handling
    evt.preventDefault();
    evt.stopPropagation(); // Ensure complete prevention

    let linkTextToInsert = "";

    // Iterate through files and generate links
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name;
      // Extract and normalize the extension (lowercase, with dot)
      const fileExt = fileName.includes(".")
        ? fileName.substring(fileName.lastIndexOf(".")).toLowerCase()
        : "";

      // Check if the extension is in the non-preview list
      if (fileExt && normalizedNonPreviewExtensions.includes(fileExt)) {
        // Generate a normal link
        linkTextToInsert += `[[${fileName}]]\n`;
      } else {
        // Generate an embed link (for files not in the list)
        linkTextToInsert += `![[${fileName}]]\n`;
      }
    }

    // Remove the trailing newline character
    if (linkTextToInsert.endsWith("\n")) {
      linkTextToInsert = linkTextToInsert.substring(
        0,
        linkTextToInsert.length - 1
      );
    }

    // Insert the generated link text at the editor's current cursor position
    editor.replaceSelection(linkTextToInsert);
  };

  onunload() {
    console.log("Unloading InsertNoPreview plugin");
    // No need to manually remove events registered via this.registerEvent
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

    containerEl.createEl("h2", { text: "No Embed Insert Settings" });

    new Setting(containerEl)
      .setName("Non-preview file extensions")
      .setDesc(
        "Files with these extensions (comma-separated) will be inserted as links ([[file]]) instead of embeds (![[file]]). Remember to include the leading dot (e.g., .pdf)."
      )
      .addTextArea((text: TextAreaComponent) =>
        text
          .setValue(this.plugin.settings.nonPreviewExtensions.join(", "))
          .onChange(async (value: string) => {
            // Parse user input, remove whitespace, ensure leading dot, and deduplicate
            const extensions = value
              .split(",") // Split by comma
              .map((ext: string) => ext.trim()) // Trim leading/trailing whitespace
              .filter((ext: string) => ext.length > 0) // Filter out empty strings
              .map((ext: string) => (ext.startsWith(".") ? ext : `.${ext}`)) // Ensure leading dot
              .map((ext: string) => ext.toLowerCase()); // Convert to lowercase
            this.plugin.settings.nonPreviewExtensions = [
              ...new Set(extensions),
            ]; // Deduplicate and assign
            await this.plugin.saveSettings();
          })
      );
  }
}

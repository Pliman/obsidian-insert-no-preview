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
  private handleFileInsert = async (
    // Make the handler async
    evt: DragEvent | ClipboardEvent,
    editor: Editor,
    view: MarkdownView // Use MarkdownView for context
  ) => {
    // Ensure the event contains files
    const files =
      evt instanceof DragEvent
        ? evt.dataTransfer?.files
        : evt.clipboardData?.files;
    if (!files || files.length === 0) {
      return; // No files, do not process
    }

    // Prepare normalized extension list for checking
    const normalizedNonPreviewExtensions =
      this.settings.nonPreviewExtensions.map((ext) => ext.toLowerCase());

    // Check if at least one file needs special handling (non-preview link)
    let hasFileToHandleManually = false;
    const fileList = Array.from(files); // Convert FileList to Array for easier processing
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
      "InsertNoPreview: Found matching file(s), handling insertion manually."
    );

    // Prevent default Obsidian file handling SINCE we are handling it manually
    evt.preventDefault();
    evt.stopPropagation(); // Ensure complete prevention

    // Process all files asynchronously
    const linkPromises = fileList.map(async (file) => {
      const fileName = file.name;
      const fileExt = fileName.includes(".")
        ? fileName.substring(fileName.lastIndexOf(".")).toLowerCase()
        : "";

      try {
        // 1. Determine the available attachment path using fileManager API
        // This handles settings (including subfolders) and potential name conflicts.
        const sourcePath = view.file ? view.file.path : "";
        const attachmentPath =
          await this.app.fileManager.getAvailablePathForAttachment(
            fileName,
            sourcePath
          );
        console.log(
          `InsertNoPreview: Determined available attachment path: ${attachmentPath}`
        );

        // 2. Ensure the parent directory for the attachment path exists
        const parentDirectory = attachmentPath.substring(
          0,
          attachmentPath.lastIndexOf("/")
        );
        if (parentDirectory && parentDirectory !== "/") {
          // Check if it's not the root and exists
          try {
            // createFolder does nothing if the folder already exists.
            await this.app.vault.createFolder(parentDirectory);
            console.log(
              `InsertNoPreview: Ensured parent directory exists: ${parentDirectory}`
            );
          } catch (err) {
            // Log error only if it's not 'already exists'
            if (!err.message?.toLowerCase().includes("already exists")) {
              console.error(
                `InsertNoPreview: Error creating parent directory ${parentDirectory}:`,
                err
              );
              new Notice(
                `Error creating attachment folder ${parentDirectory}. See console.`
              );
              return ""; // Bail out if folder creation fails unexpectedly
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
          // Attempt to proceed assuming root or createBinary handles it? Cautious approach: return error.
          new Notice(
            `Could not determine parent folder for ${attachmentPath}.`
          );
          return "";
        }

        // 3. Read file data
        const fileData = await file.arrayBuffer();

        // 4. Save the file to the vault using the path determined by fileManager
        // This path already accounts for potential name conflicts.
        const savedTFile = await this.app.vault.createBinary(
          attachmentPath,
          fileData
        );
        console.log(`InsertNoPreview: Saved file to ${savedTFile.path}`);

        // 5. Generate link text based on extension, using the final saved file name
        if (fileExt && normalizedNonPreviewExtensions.includes(fileExt)) {
          // Use .name to include the extension
          return `[[${savedTFile.name}]]`;
        } else {
          // Use .name to include the extension
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

    // Filter out any empty strings from errors and join with newlines
    const combinedLinkText = linkTexts.filter((text) => text).join("\n");

    // Insert the generated link text at the editor's current cursor position
    if (combinedLinkText) {
      editor.replaceSelection(combinedLinkText);
    }
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

    containerEl.createEl("h2", { text: "Insert No Preview Settings" }); // Updated Title slightly

    new Setting(containerEl)
      .setName("Non-preview file extensions")
      .setDesc(
        "Files with these extensions will be inserted as links ([[file]]) instead of embeds (![[file]]). Separate extensions with commas (e.g., .pdf, zip, .exe). Leading dot is optional but recommended." // Updated description slightly
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

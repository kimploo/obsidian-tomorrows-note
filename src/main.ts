import { App, Notice, Plugin, moment, normalizePath } from 'obsidian';

// Settings of the core Daily Notes plugin (all optional; empty = default).
interface DailyNotesOptions {
	format?: string;
	folder?: string;
	template?: string;
}

const DEFAULT_FORMAT = 'YYYY-MM-DD';

export default class TomorrowNotePlugin extends Plugin {
	onload() {
		this.addRibbonIcon('calendar-plus', "Open tomorrow's daily note", () => {
			void this.openTomorrowNote();
		});

		this.addCommand({
			id: 'open',
			name: "Open tomorrow's daily note",
			callback: () => void this.openTomorrowNote(),
		});
	}

	private async openTomorrowNote() {
		try {
			const { format, folder, template } = this.getDailyNotesOptions();
			const tomorrow = moment().add(1, 'day');

			const fileName = tomorrow.format(format?.trim() || DEFAULT_FORMAT);
			const folderPath = folder?.trim() ?? '';
			const filePath = normalizePath(
				folderPath ? `${folderPath}/${fileName}.md` : `${fileName}.md`,
			);

			let file = this.app.vault.getFileByPath(filePath);
			if (!file) {
				await this.ensureParentFolder(filePath);
				const content = await this.getTemplateContents(
					template,
					tomorrow,
				);
				file = await this.app.vault.create(filePath, content);
			}
			await this.app.workspace.getLeaf().openFile(file);
		} catch (error) {
			console.error('Tomorrow note:', error);
			new Notice("Failed to open tomorrow's daily note.");
		}
	}

	// Read the core Daily Notes plugin settings (not part of the public API).
	private getDailyNotesOptions(): DailyNotesOptions {
		const internalPlugins = (
			this.app as App & {
				internalPlugins: {
					getPluginById(id: string): {
						instance: { options?: DailyNotesOptions };
					} | null;
				};
			}
		).internalPlugins;
		return internalPlugins.getPluginById('daily-notes')?.instance.options ?? {};
	}

	// Create missing parent folders of filePath (the date format may contain
	// slashes, e.g. "YYYY/MM/DD").
	private async ensureParentFolder(filePath: string) {
		const parent = filePath.substring(0, filePath.lastIndexOf('/'));
		if (parent && !this.app.vault.getFolderByPath(parent)) {
			await this.app.vault.createFolder(parent);
		}
	}

	// Load the daily-note template and fill in {{date}}, {{time}} and
	// {{title}} (with optional ":FORMAT") for tomorrow's date.
	private async getTemplateContents(
		template: string | undefined,
		date: moment.Moment,
	): Promise<string> {
		const templatePath = template?.trim();
		if (!templatePath) {
			return '';
		}

		const file = this.app.vault.getFileByPath(
			normalizePath(
				templatePath.endsWith('.md')
					? templatePath
					: `${templatePath}.md`,
			),
		);
		if (!file) {
			new Notice(`Daily note template not found: ${templatePath}`);
			return '';
		}

		const contents = await this.app.vault.cachedRead(file);
		return contents.replace(
			/{{\s*(date|time|title)\s*(?::(.*?))?\s*}}/gi,
			(_match, variable: string, format?: string) => {
				switch (variable.toLowerCase()) {
					case 'time':
						return date.format(format || 'HH:mm');
					default:
						// date and title both resolve to tomorrow's date
						return date.format(format || DEFAULT_FORMAT);
				}
			},
		);
	}
}

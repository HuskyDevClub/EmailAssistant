export class ConfigController {

    private static isInitialized: boolean = false;

    private static VALUES: Record<string, Record<string, string>> = {
        userData: {
            language: "English",
            customInstruction: "",
            ollamaUrl: "http://localhost:11434"
        }
    };

    public static async get(k: string): Promise<string> {
        await this.init();
        return this.VALUES.userData[k];
    }

    public static async set(k: string, v: string): Promise<void> {
        await this.init();
        this.VALUES.userData[k] = v;
    }

    // Save the config file
    public static async save(): Promise<void> {
        try {
            await (window as any).electronAPI.writeFile(await this.getPath(), JSON.stringify(this.VALUES, null, 2));
            // console.log(this.VALUES)
        } catch (error) {
            console.error('Error saving config file:', error);
        }
    }

    // Create or ensure the config file exists
    private static async init(): Promise<void> {
        if (this.isInitialized) return;
        try {
            //console.log(await this.getPath());
            if (await (window as any).electronAPI.existFile(await this.getPath())) {
                const data = await (window as any).electronAPI.readFile(await this.getPath());
                this.VALUES = JSON.parse(data);
            }
        } catch (error) {
            console.error('Error creating config file:', error);
        }
    }

    private static async getPath() {
        return `${await (window as any).electronAPI.getUserDataDir()}/config.json`;
    }
}

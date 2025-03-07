import * as path from 'path';

// Define the config interface
interface Config {
    userData: {
        language: string;
        customInstruction: string;
    };
}

export class ConfigController {

    static VALUES: Config = {
        userData: {
            language: "English",
            customInstruction: ""
        }
    } as Config;

    // Create or ensure the config file exists
    public static async init(): Promise<void> {
        try {
            console.log(await this.getPath());
            if (await (window as any).electronAPI.existFile(await this.getPath())) {
                const data = await (window as any).electronAPI.readFile(await this.getPath());
                this.VALUES = JSON.parse(data) as Config;
            }
        } catch (error) {
            console.error('Error creating config file:', error);
        }
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

    private static async getPath() {
        return path.join(await (window as any).electronAPI.getUserDataDir(), 'config.json');
    }
}

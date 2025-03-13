import {Message, Ollama} from "ollama";
import {ConfigController} from "./ConfigController";


export class OllamaController {

    private static OLLAMA_CLIENT: Ollama;
    private static OLLAMA_URL: string;

    // ask gpt the question
    public static async chatAsync(model: string, messages: Message[], setResponse: (response: string) => void): Promise<string> {
        let answer = "";
        try {
            const response = await (await this.get_client()).chat({
                model: model,
                messages: messages,
                stream: true
            })
            for await (const part of response) {
                answer += part.message.content;
                setResponse(answer);
            }
            // save response
            messages.push({
                role: "assistant",
                content: answer,
            });
            setResponse("");
            return answer;
        } catch (error) {
            console.error("Error in sending ask request:", error);
        }
    }

    // ask gpt the question
    public static async chat(model: string, messages: Message[]): Promise<string> {
        try {
            const response = await (await this.get_client()).chat({
                model: model,
                messages: messages
            })
            // save response
            messages.push({
                role: "assistant",
                content: response.message.content,
            });
            return response.message.content;
        } catch (error) {
            console.error("Error in sending ask request:", error);
        }
    }

    // get the list of models that is available
    public static async getModels(): Promise<string[]> {
        const result: string[] = [];
        try {
            const models = (await (await this.get_client()).list()).models;
            models.forEach((model) => {
                result.push(model.name)
            });
        } catch (e) {
            console.log(e);
        }
        return result;
    }

    private static async get_client(): Promise<Ollama> {
        const url: string = await ConfigController.get("ollamaUrl");
        if (!this.OLLAMA_CLIENT || this.OLLAMA_URL != url) {
            this.OLLAMA_CLIENT = new Ollama({host: url})
            this.OLLAMA_URL = url;
        }
        return this.OLLAMA_CLIENT;
    }
}
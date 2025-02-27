import {Message, Ollama} from "ollama";

// ollama connection
const ollama = new Ollama({host: 'http://127.0.0.1:11434'})

export class OllamaController {
    // ask gpt the question
    public static async chatAsync(model: string, messages: Message[], setResponse: (response: string) => void): Promise<string> {
        let answer = "";
        try {
            const response = await ollama.chat({
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
            const response = await ollama.chat({
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
            const models = (await ollama.list()).models;
            models.forEach((model) => {
                result.push(model.name)
            });
        } catch (e) {
            console.log(e);
        }
        return result;
    }
}
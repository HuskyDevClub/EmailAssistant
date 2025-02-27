import {OllamaController} from "../controllers/OllamaController"
import {Message} from "ollama";

export class ReasoningNode {
    public static model: string;

    constructor(private readonly action: string, private readonly returnType: string) {
    }

    public async proceed(context: string, messages: Message[]): Promise<any> {
        const prompt = `Given context:\n"""\n${context}\n"""\n${this.action}\nReturn the result in json form, "reason" as the key for reason, and "result" as key for result as ${this.returnType} value.`
        messages.push({role: "user", content: prompt})
        const result = await OllamaController.chat(ReasoningNode.model, messages)
        return JSON.parse(result.trim());
    }
}
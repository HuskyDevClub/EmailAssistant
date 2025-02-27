import {ReasoningNode} from "./ReasoningNode"
import {Message} from "ollama";

export class SpamDetectionNode extends ReasoningNode {
    constructor() {
        super("In a scale from 0 to 100, how likely is this a spam or advertisement email", "int")
    }

    public async process(prompt: string, messages: Message[]): Promise<any> {
        return await super.proceed(prompt, messages);
    }
}
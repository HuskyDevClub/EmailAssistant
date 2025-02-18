import {createRoot} from 'react-dom/client';
import {useEffect, useState} from 'react';
import ollama, {Message} from "ollama";

const root = createRoot(document.body);
root.render(
    <Main/>
);

function Main() {
    const [prompt, setPrompt] = useState('');
    const [options, setOptions] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [responses] = useState<string[]>([]);
    const [response, setResponse] = useState('');
    const [messages] = useState<Message[]>([]);

    // get the list of models that is available
    async function getModels(): Promise<string[]> {
        const models = (await ollama.list()).models;
        const result: string[] = [];
        models.forEach((model) => {
            result.push(model.name)
        });
        return result;
    }

    // ask gpt the question
    async function askGpt(): Promise<void> {
        if (!prompt) {
            alert('Please select a model and enter a prompt.');
            return;
        }
        messages.push({
            role: "user",
            content: prompt,
        } as Message);
        responses.push("User:")
        responses.push(prompt)
        setPrompt("")
        responses.push(`AI (${selectedModel}):`)
        let answer = "";
        try {
            const response = await ollama.chat({
                model: selectedModel,
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
            responses.push(answer);
            setResponse("");
        } catch (error) {
            console.error("Error in sending ask request:", error);
        }
    }

    // Fetch the models when the component mounts
    useEffect(() => {
        async function fetchModels(): Promise<void> {
            const models: string[] = await getModels();
            setOptions(models);
            setSelectedModel(models[0])
        }

        fetchModels().then(); // Call the async function
    }, []); // Empty dependency array ensures it only runs once

    return (
        <div>
            <div hidden={responses.length === 0 && responses.length === 0}>
                <h2>Response:</h2>
                {responses.map((option, index) => (
                    <p key={index}>{option}</p>
                ))}
                <p>{response}</p>
            </div>
            <h2 hidden={responses.length != 0 || responses.length != 0}>What can I help with?</h2>
            <textarea placeholder="Message GPT Assistance" rows={10} cols={50} value={prompt}
                      onChange={e => setPrompt(e.target.value)}/><br/>
            <label className="form-label">Model: </label>
            <select onChange={e => setSelectedModel(e.target.value)}>
                {options.map((option, index) => (
                    <option key={index} value={option}>
                        {option}
                    </option>
                ))}
            </select><br/>
            <button onClick={askGpt} disabled={prompt.length === 0}>Chat</button>
        </div>
    );
}
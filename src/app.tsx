import {createRoot} from 'react-dom/client';
import {useEffect, useState} from 'react';
import ollama, {Message} from "ollama";
import {OutlookEmailItem} from "./models/OutlookEmailItem"

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
    const [email, setEmail] = useState<OutlookEmailItem>(null);
    const [error, setError] = useState<string | null>(null);
    const [language, setLanguage] = useState('English');

    const fetchSelectedEmail = async () => {
        try {
            const result = await (window as any).electronAPI.getSelectedEmail() as OutlookEmailItem;
            console.log(result);
            if (result.error) {
                setError(result.error);
            } else {
                setEmail(result);
                setError(null);
            }
        } catch (err) {
            setError("Failed to fetch email");
        }
    };

    // get the list of models that is available
    async function getModels(): Promise<string[]> {
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

    // summarize email
    async function summarizeEmail(): Promise<void> {
        setPrompt(`In ${language}, summarize following email:\n"""\nSubject:${email.subject}\nFrom:${email.sender}\nTo:${email.recipient}\nReceived:${email.receivedTime.toString()}\n${email.body}\n"""`)
        await askGpt();
    }

    // write a reply
    async function replyEmail(): Promise<void> {
        setPrompt(`Write a reply for email:\n"""\nSubject:${email.subject}\nFrom:${email.sender}\nTo:${email.recipient}\nReceived:${email.receivedTime.toString()}\n${email.body}\n"""`)
        await askGpt();
    }

    // Fetch the models when the component mounts
    useEffect(() => {
        async function fetchModels(): Promise<void> {
            const models: string[] = await getModels();
            setOptions(models);
            setSelectedModel(models[0])
        }

        fetchModels().then(); // Call the async function

        const interval = setInterval(async () => fetchSelectedEmail(), 1000); // Fetch every second
        return () => clearInterval(interval); // Cleanup on unmount
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
            <label className="form-label">Language: </label>
            <input value={language} onChange={e => setLanguage(e.target.value)}/><br/>
            <button onClick={askGpt} disabled={prompt.length === 0}>Chat</button>
            <button onClick={summarizeEmail}>Summarize email</button>
            <button onClick={replyEmail}>Write a reply</button>
            <div>
                <h1>Read Selected Outlook Email</h1>
                <button onClick={fetchSelectedEmail}>Fetch Email</button>
                {error && <p style={{color: "red"}}>{error}</p>}
                {email && (
                    <div>
                        <h2>{email.subject}</h2>
                        <p><b>From:</b> {email.sender}</p>
                        <p><b>To:</b> {email.recipient}</p>
                        <p><b>Received:</b> {email.receivedTime.toString()}</p>
                        <p><b>Body:</b></p>
                        <pre>{email.body}</pre>
                    </div>
                )}
            </div>
        </div>
    );
}
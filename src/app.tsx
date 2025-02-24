import {createRoot} from 'react-dom/client';
import {useEffect, useState} from 'react';
import {Message} from "ollama";
import {OutlookEmailItem} from "./models/OutlookEmailItem"
import {OllamaController} from "./controllers/OllamaController"

const root = createRoot(document.body);
root.render(
    <Main/>
);

function Main() {
    const [prompt, setPrompt] = useState('');
    const [options, setOptions] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [responses, setResponses] = useState<string[]>([]);
    const [response, setResponse] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [email, setEmail] = useState<OutlookEmailItem>(null);
    const [error, setError] = useState<string | null>(null);
    const [language, setLanguage] = useState('English');

    const fetchSelectedEmail = async () => {
        try {
            const result = await (window as any).electronAPI.getSelectedEmail() as OutlookEmailItem;
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

    // ask gpt the question
    async function askGpt(): Promise<void> {
        if (!prompt) {
            alert('Please select a model and enter a prompt.');
            return;
        }
        await chat(prompt);
        setPrompt("");
    }

    // summarize email
    async function summarizeEmail(): Promise<void> {
        await chat(`In ${language}, summarize following email:\n"""\nSubject:${email.subject}\nFrom:${email.sender}\nTo:${email.recipient}\nReceived:${email.receivedTime.toString()}\n${email.body}\n"""`, `Summarize email: "${email.subject}"`);
    }

    // write a reply
    async function replyEmail(): Promise<void> {
        await chat(`Write a reply for email:\n"""\nSubject:${email.subject}\nFrom:${email.sender}\nTo:${email.recipient}\nReceived:${email.receivedTime.toString()}\n${email.body}\n"""`, `Write a reply for: "${email.subject}"`)
    }

    async function chat(thePrompt: string, question: string = null): Promise<void> {
        messages.push({role: "user", content: thePrompt} as Message);
        responses.push("User:")
        responses.push(question == null ? thePrompt : question);
        responses.push(`AI (${selectedModel}):`)
        responses.push(await OllamaController.chat(selectedModel, messages, setResponse))
    }

    async function clearHistory(): Promise<void> {
        setResponses([]);
        setMessages([]);
    }

    // Fetch the models when the component mounts
    useEffect(() => {
        async function fetchModels(): Promise<void> {
            const models: string[] = await OllamaController.getModels();
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
            <button onClick={clearHistory}>Clear</button>
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
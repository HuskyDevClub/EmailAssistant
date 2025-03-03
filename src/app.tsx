import {createRoot} from 'react-dom/client';
import React, {useEffect, useState} from 'react';
import {Message} from "ollama";
import {OutlookEmailItem} from "./models/OutlookEmailItem"
import {OllamaController} from "./controllers/OllamaController"
import {SpamDetectionNode} from "./nodes/SpamDetectionNode"
import {ReasoningNode} from "./nodes/ReasoningNode";

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
    const [attachments, setAttachments] = useState<File[]>([]);

    const openNewWindow = () => {
        const newWin = window.open("", "_blank", "width=400,height=300");
        if (newWin) {
            newWin.document.write(`<html lang="en"><head><title id="title">${email.subject}</title></head><body>`);
            newWin.document.write(`<h2>${email.subject}</h2>`);
            newWin.document.write(`<p><b>To:</b> ${email.recipient}</p>`);
            newWin.document.write(`<p><b>Received:</b> ${email.receivedTime.toString()}</p>`);
            newWin.document.write("<p><b>Body:</b></p>");
            newWin.document.write(`<pre id="ebody">${email.body}</pre>`);
            newWin.document.write("</body></html>");
            newWin.document.close();
            const closeButton = newWin.document.getElementById("close-btn");
            if (closeButton) {
                closeButton.addEventListener("click", () => {
                    newWin.close();
                });
            }

            const updateEmail = () => {
                newWin.document.getElementById("title").innerText = email.subject;
            }

            return () => {
                if (newWin && !newWin.closed) newWin.close();
            }
        }
    };

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
        ReasoningNode.model = selectedModel;
        const thePrompt = email ? emailToString(email) : prompt;
        const result = await (new SpamDetectionNode()).process(thePrompt, structuredClone(messages));
        const threshold = 60
        if (result.result > threshold) {
            console.log(`Warning: this seems to be a spam or advertisement email (${result.result}/100):`);
            console.log(result.reason)
            await chat(`Since this can be a spam or advertisement email, warn user on this on following email:\n"""\n${thePrompt}\n"""\n`, `Write a reply for: "${thePrompt}"`);
        } else {
            console.log(`This emails seem to be safe (${result.result}/100):`);
            console.log(result.reason)
            await chat(`In ${language}, summarize following email:\n"""\n${emailToString(email)}\n"""`, `Summarize email: "${email.subject}"`);
        }
    }

    // write a reply
    async function replyEmail(): Promise<void> {
        ReasoningNode.model = selectedModel;
        const thePrompt = email ? emailToString(email) : prompt;
        const result = await (new SpamDetectionNode()).process(thePrompt, structuredClone(messages));
        const threshold = 60
        if (result.result > threshold) {
            console.log(`Warning: this seems to be a spam or advertisement email (${result.result}/100):`);
            console.log(result.reason)
            await chat(`Since this can be a spam or advertisement email, warn user on this on following email:\n"""\n${thePrompt}\n"""\n`, `Write a reply for: "${thePrompt}"`);
        } else {
            console.log(`This emails seem to be safe (${result.result}/100):`);
            console.log(result.reason)
            await chat(`Write a reply for email:\n"""\n${thePrompt}\n"""`, `Write a reply for: "${thePrompt}"`)
        }
    }

    function emailToString(theEmail: OutlookEmailItem): string {
        return `Subject:${theEmail.subject}\nFrom:${theEmail.sender}\nTo:${theEmail.recipient}\nReceived:${theEmail.receivedTime.toString()}\n${theEmail.body}\n`
    }

    async function chat(thePrompt: string, question: string = null): Promise<void> {
        messages.push({role: "user", content: thePrompt} as Message);
        responses.push("User:")
        responses.push(question == null ? thePrompt : question);
        responses.push(`AI (${selectedModel}):`)
        responses.push(await OllamaController.chatAsync(selectedModel, messages, setResponse))
        setAttachments([])
    }

    async function clearHistory(): Promise<void> {
        setResponses([]);
        setMessages([]);
    }

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setAttachments(Array.from(event.target.files));
        }
    };

    async function testNode(): Promise<void> {
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
            <button onClick={testNode}>Test a Node</button>
            <button onClick={clearHistory}>Clear</button>
            <br/>
            <input type="file" id="fileInput" multiple onChange={handleFileChange} className="hidden"/>
            <div>
                {error && <p style={{color: "red"}}>{error}</p>}
                {email && (<div>
                    <p>Read Selected Outlook Email:</p>
                    <p>{email.subject}</p>
                    <button onClick={openNewWindow}>Open New Window</button>
                </div>)}
            </div>
        </div>
    );
}
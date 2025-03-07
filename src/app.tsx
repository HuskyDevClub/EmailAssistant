import {createRoot} from 'react-dom/client';
import React, {useEffect, useState} from 'react';
import {Message} from "ollama";
import {OutlookEmailItem} from "./models/OutlookEmailItem"
import {TextFile} from "./models/Files"
import {OllamaController} from "./controllers/OllamaController"
import {ConfigController} from "./controllers/ConfigController"

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
    const [userLanguage, setUserLanguage] = useState<string>('');
    const [customInstruction, setCustomInstruction] = useState<string>('');
    const [imageAttachments, setImageAttachments] = useState<string[]>();
    const [textFileAttachments, setTextFileAttachments] = useState<TextFile[]>();
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
        await chat(`In ${userLanguage}, summarize following email:\n"""\n${emailToString(email)}\n"""`, `Summarize email: "${email.subject}"`);
    }

    // write a reply
    async function replyEmail(): Promise<void> {
        await chat(`Write a reply for email:\n"""\n${emailToString(email)}\n"""`, `Write a reply for: "${email.subject}"`)
    }

    // write a reply
    async function isSpamEmail(): Promise<void> {
        await chat(`In short, does this email look like a spam email:\n"""\n${emailToString(email)}\n"""`, `Is this spam: "${email.subject}"`)
    }

    function emailToString(theEmail: OutlookEmailItem): string {
        return `Subject:${theEmail.subject}\nFrom:${theEmail.sender}\nTo:${theEmail.recipient}\nReceived:${theEmail.receivedTime.toString()}\n${theEmail.body}\n`
    }

    // Using FileReader API
    function readWebPAsBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.toString().split(',')[1]); // Get only the base64 part
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function getTextAttachmentsInString(): string {
        let result: string = "";
        if (textFileAttachments) {
            result = "Given file(s):\n"
            for (let file of textFileAttachments) {
                result += `"""\n###${file.path}\n${file.content}\n"""\n`
            }
        }
        return result;
    }

    async function chat(thePrompt: string, question: string = null): Promise<void> {
        const msg: Message = {
            role: "user",
            content: customInstruction ? `Given context:\n"""\n${customInstruction}\n"""\n${thePrompt}` : thePrompt
        } as Message;
        msg.content = `${getTextAttachmentsInString()}${msg.content}`
        console.log(msg.content)
        if (imageAttachments) {
            msg.images = imageAttachments
        }
        messages.push(msg);
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

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            let theImageAttachments: string[] = []
            let theTextAttachments: TextFile[] = []
            let theOtherAttachments: File [] = []
            for (let file of event.target.files) {
                if (file.type === 'image/webp' || file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/gif') {
                    const base64 = await readWebPAsBase64(file);
                    theImageAttachments.push(base64)
                } else if (file.type === 'application/pdf') {
                    theTextAttachments.push({path: file.path, content: file.path} as TextFile)
                } else {
                    theOtherAttachments.push(file)
                }
            }
            setImageAttachments(theImageAttachments)
            setTextFileAttachments(theTextAttachments)
            setAttachments(theOtherAttachments);
            console.log(theImageAttachments);
            console.log(theTextAttachments);
            console.log(theOtherAttachments)
        }
    };

    // Add a separate useEffect for initialization tasks that should only run once
    useEffect(() => {
        async function initialize() {
            ConfigController.init().then(() => {
                setUserLanguage(ConfigController.VALUES.userData.language);
                setCustomInstruction(ConfigController.VALUES.userData.customInstruction)
            });
        }

        initialize().then();
    }, []); // Empty dependency array ensures it only runs once

    // Fetch the models when the component mounts
    useEffect(() => {
        async function fetchModels(): Promise<void> {
            const models: string[] = await OllamaController.getModels();
            setOptions(models);
            setSelectedModel(models[0])
        }

        async function updateConfig(): Promise<void> {
            ConfigController.VALUES.userData.language = userLanguage;
            ConfigController.VALUES.userData.customInstruction = customInstruction
            await ConfigController.save()
        }

        fetchModels().then(); // Call the async function
        const interval = setInterval(async () => {
            await updateConfig();
            await fetchSelectedEmail();
        }, 1000); // Fetch every second
        return () => clearInterval(interval); // Cleanup on unmount
    }, [userLanguage, customInstruction]); // Empty dependency array ensures it only runs once

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
            <input value={userLanguage} onChange={e => setUserLanguage(e.target.value)}/><br/>
            <button onClick={askGpt} disabled={prompt.length === 0}>Chat</button>
            <button onClick={isSpamEmail}>A spam email?</button>
            <button onClick={summarizeEmail}>Summarize email</button>
            <button onClick={replyEmail}>Write a reply</button>
            <button onClick={clearHistory}>Clear</button>
            <br/>
            <input type="file" id="fileInput" multiple onChange={handleFileChange} className="hidden"/>
            <div>
                <h4 className="form-label">Custom Instruction:</h4>
                <textarea placeholder="Anything you would like your GPT Assistance to know" rows={5} cols={50}
                          value={customInstruction}
                          onChange={e => setCustomInstruction(e.target.value)}/><br/>
            </div>
            <div>
                {error && <p style={{color: "red"}}>{error}</p>}
                {email && <p>Read Selected Outlook Email: <strong>{email.subject}</strong>
                    <button onClick={openNewWindow}>View</button>
                </p>}
            </div>
        </div>
    );
}
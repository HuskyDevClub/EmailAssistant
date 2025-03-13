import {createRoot} from 'react-dom/client';
import React, {useEffect, useState} from 'react';
import {Message} from "ollama";
import {OutlookEmailItem} from "./models/OutlookEmailItem"
import {TextFile} from "./models/Files"
import {OllamaController} from "./controllers/OllamaController"
import {ConfigController} from "./controllers/ConfigController"
import {EmailViewer} from "./components/EmailViewer"
import {bufferToFile} from "./functions";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.entry";

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
    const [imageAttachments, setImageAttachments] = useState<string[]>();
    const [textFileAttachments, setTextFileAttachments] = useState<TextFile[]>();
    const [emailImageAttachments, setEmailImageAttachments] = useState<string[]>();
    const [emailTextFileAttachments, setEmailTextFileAttachments] = useState<TextFile[]>();
    const [attachments, setAttachments] = useState<File[]>([]);
    // config
    const [userLanguage, setUserLanguage] = useState<string>('');
    const [customInstruction, setCustomInstruction] = useState<string>('');
    const [ollamaUrl, setOllamaUrl] = useState<string>('');

    const fetchSelectedEmail = async () => {
        try {
            const result: OutlookEmailItem = await (window as any).electronAPI.getSelectedEmail() as OutlookEmailItem;
            if (result.error) {
                setError(result.error);
            } else {
                // set email
                setEmail(result);

                // process attachments
                let theImageAttachments: string[] = []
                let theTextAttachments: TextFile[] = []
                for (let p of result.attachments) {
                    // Read the PDF file into a buffer
                    const buffer: Buffer = await (window as any).electronAPI.readFileRaw(p);
                    // Create a File object from the buffer
                    const file: File = bufferToFile(p, buffer);
                    if (file.type === 'image/webp' || file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/gif') {
                        const base64 = await readWebPAsBase64(file);
                        theImageAttachments.push(base64);
                    } else if (file.type === 'application/pdf') {
                        const extractedText = await readPdfAsText(file); // Extract PDF content here
                        theTextAttachments.push({path: file.name, content: extractedText} as TextFile);
                    }
                }
                setEmailImageAttachments(theImageAttachments)
                setEmailTextFileAttachments(theTextAttachments)

                // clear error
                setError(null);
            }
        } catch (err) {
            setError(`Failed to fetch email:${err}`);
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
        await chatAboutEmail(`The content of the email:\n'''\n${emailToString(email)}\n'''\nIn ${userLanguage}, summarize the email.`, `Summarize email: "${email.subject}"`);
    }

    // write a reply
    async function replyEmail(): Promise<void> {
        await chatAboutEmail(`The content of the email:\n'''\n${emailToString(email)}\n'''\nWrite a reply for email, do not include subject.`, `Write a reply for: "${email.subject}"`)
        await (window as any).electronAPI.displayEmailReply(messages[messages.length - 1].content)
    }

    // write a reply
    async function isSpamEmail(): Promise<void> {
        await chatAboutEmail(`The content of the email:\n'''\n${emailToString(email)}\n'''\nIn short, tell me that does this email look like a spam email?`, `Is this spam: "${email.subject}"`)
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
            result = "Given file(s):\n";
            for (let file of textFileAttachments) {
                result += `\n### ${file.path}:\n'''\n${file.content}\n'''\n`;
            }
        }
        return result;
    }

    function getEmailTextAttachmentsInString(): string {
        let result: string = "";
        if (emailTextFileAttachments) {
            result = "Given attached file(s) in the email:\n";
            for (let file of emailTextFileAttachments) {
                result += `\n### ${file.path}:\n'''\n${file.content}\n'''\n`;
            }
        }
        return result;
    }

    async function chat(thePrompt: string, question: string = null): Promise<void> {
        const msg: Message = {
            role: "user",
            content: customInstruction ? `Given context:\n'''\n${customInstruction}\n'''\n${thePrompt}` : thePrompt
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

    async function chatAboutEmail(thePrompt: string, question: string = null): Promise<void> {
        const msg: Message = {
            role: "user",
            content: customInstruction ? `Given context:\n'''\n${customInstruction}\n'''\n${thePrompt}` : thePrompt
        } as Message;
        msg.content = `${getEmailTextAttachmentsInString()}${msg.content}`
        console.log(msg.content)
        if (emailImageAttachments) {
            msg.images = emailImageAttachments
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

    async function readPdfAsText(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function () {
                const typedArray = new Uint8Array(reader.result as ArrayBuffer);
                const pdf = await pdfjsLib.getDocument({data: typedArray}).promise;
                let text = "";

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    const strings = content.items.map((item: any) => item.str);
                    text += strings.join(" ") + "\n";
                }

                resolve(text);
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }


    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            let theImageAttachments: string[] = []
            let theTextAttachments: TextFile[] = []
            let theOtherAttachments: File [] = []
            for (let file of event.target.files) {
                if (file.type === 'image/webp' || file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/gif') {
                    const base64 = await readWebPAsBase64(file);
                    theImageAttachments.push(base64);
                } else if (file.type === 'application/pdf') {
                    const extractedText = await readPdfAsText(file); // Extract PDF content here
                    theTextAttachments.push({path: file.name, content: extractedText} as TextFile);
                } else {
                    theOtherAttachments.push(file);
                }
            }

            setImageAttachments(theImageAttachments)
            setTextFileAttachments(theTextAttachments)
            setAttachments(theOtherAttachments);
        }
    };

    // Add a separate useEffect for initialization tasks that should only run once
    useEffect(() => {
        async function initialize() {
            setUserLanguage(await ConfigController.get("language"));
            setCustomInstruction(await ConfigController.get("customInstruction"))
            setOllamaUrl(await ConfigController.get("ollamaUrl"))
        }

        initialize().then();
    }, []); // Empty dependency array ensures it only runs once

    function viewEmail() {
        EmailViewer(email)
    }

    // Fetch the models when the component mounts
    useEffect(() => {
        async function fetchModels(): Promise<void> {
            const models: string[] = await OllamaController.getModels();
            setOptions(models);
            setSelectedModel(models[0])
        }

        async function updateConfig(): Promise<void> {
            await ConfigController.set("language", userLanguage);
            await ConfigController.set("customInstruction", customInstruction);
            await ConfigController.set("ollamaUrl", ollamaUrl);
            await ConfigController.save()
        }


        fetchModels().then(); // Call the async function
        const interval = setInterval(async () => {
            await updateConfig();
            await fetchSelectedEmail();
        }, 5000); // Fetch every second
        return () => clearInterval(interval); // Cleanup on unmount
    }, [userLanguage, customInstruction, ollamaUrl]); // Empty dependency array ensures it only runs once

    return (

        <div>
            <div className="glass-card">
                <h2>Welcome to Smart Office!</h2>
                <p>Your assistant is ready to help you manage your Outlook tasks efficiently.</p>
            </div>
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
                <label>Ollama Url</label>
                <textarea value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)}/><br/>
            </div>
            <div>
                {error && <p style={{color: "red"}}>{error}</p>}
                {email && <p>Read Selected Outlook Email: <strong>{email.subject}</strong>
                    <button onClick={viewEmail}>View</button>
                </p>}
            </div>
        </div>
    );
}
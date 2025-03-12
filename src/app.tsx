import {createRoot} from 'react-dom/client';
import React, {useEffect, useState} from 'react';
import {Message} from "ollama";
import {OutlookEmailItem} from "./models/OutlookEmailItem"
import {TextFile} from "./models/Files"
import {OllamaController} from "./controllers/OllamaController"
import {ConfigController} from "./controllers/ConfigController"
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
    const [userLanguage, setUserLanguage] = useState<string>('');
    const [customInstruction, setCustomInstruction] = useState<string>('');
    const [imageAttachments, setImageAttachments] = useState<string[]>();
    const [textFileAttachments, setTextFileAttachments] = useState<TextFile[]>();
    const [emailImageAttachments, setEmailImageAttachments] = useState<string[]>();
    const [emailTextFileAttachments, setEmailTextFileAttachments] = useState<TextFile[]>();
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

            console.log(emailImageAttachments);
            console.log(emailTextFileAttachments);

            return () => {
                if (newWin && !newWin.closed) newWin.close();
            }
        }
    };

    // Helper function to determine MIME type based on file extension
    function getMimeType(filename: string): string {
        const mimeTypes: Record<string, string> = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.txt': 'text/plain',
            '.csv': 'text/csv',
            '.html': 'text/html',
            '.zip': 'application/zip'
            // Add more as needed
        };

        return mimeTypes[getFileExtension(filename)] || 'application/octet-stream';
    }

    function getFileExtension(path: string): string {
        // Extract the part after the last dot
        // If there's no dot or the dot is at the beginning of the basename, return empty string
        return path.slice(((path.lastIndexOf(".") - 2) >>> 0) + 2);
    }

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
                    // Add filename property to make it more like a File object
                    const file = new File([], p.split('/').pop() || 'file', {
                        type: getMimeType(p)
                    });
                    if (file.type === 'image/webp' || file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/gif') {
                        const base64 = await readWebPAsBase64(file);
                        theImageAttachments.push(base64);
                    } else if (file.type === 'application/pdf') {
                        const extractedText = await readPdfFromLocalPath(p); // Extract PDF content here
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
        await chatAboutEmail(`The content of the email:\n'''\n${emailToString(email)}\n'''\nWrite a reply for email.`, `Write a reply for: "${email.subject}"`)
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

    async function readPdfFromLocalPath(pdfPath: string): Promise<string> {
        try {
            // Read the PDF file into a buffer
            const data = await (window as any).electronAPI.readFileRaw(pdfPath);

            // Convert the buffer to Uint8Array which pdfjs requires
            const uint8Array = new Uint8Array(data);

            // Load the PDF document
            const loadingTask = pdfjsLib.getDocument(uint8Array);
            const pdfDocument = await loadingTask.promise;

            // console.log(`PDF loaded. Number of pages: ${pdfDocument.numPages}`);

            // Extract text from all pages
            let fullText = '';

            for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
                const page = await pdfDocument.getPage(pageNum);
                const textContent = await page.getTextContent();

                // Concatenate the text items into a string
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ');

                fullText += pageText + '\n\n';
                // console.log(`Page ${pageNum} processed.`);
            }

            return fullText.trim();
        } catch (error) {
            console.error('Error reading PDF:', error);
            throw error;
        }
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
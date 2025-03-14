# AI Email Assistant for Outlook 365 (Logistics Industry)

## Overview
This AI Email Assistant is designed to enhance email productivity for logistics staff using **Microsoft Outlook 365 Classic Edition**. The assistant helps users by:
- **Fetching Outlook emails** securely and efficiently.
- **Summarizing emails** in multiple languages using the **DeepSeek API**.
- **Generating AI-powered email replies** with customizable language, tone, and format.
- **Identifying spam emails** and ensuring data security by operating **locally** to prevent privacy breaches.
- **Reading and extracting text from PDF attachments** using `pdf.js` and `pdf2image` (via Electron + Python integration).

This project is designed to improve communication efficiency, reduce email processing time, and support non-native English speakers in writing professional emails.

---

## Key Features
✅ Fetches emails directly from **Outlook 365 Classic Edition**.
✅ Summarizes lengthy email conversations in clear and concise language.
✅ Generates suggested replies that users can review and customize.
✅ Supports multiple languages for improved client communication.
✅ Detects and flags potential spam emails.
✅ Extracts text from **PDF attachments** by converting them to images and processing them via **Llama 3.2's image capabilities**.
✅ Prioritizes security by running operations **locally** to prevent data leaks.

---

## Setup Instructions

### **1. Prerequisites**
Ensure you have the following installed:
- **Node.js** (v18 or higher)
- **Electron** (latest version)
- **Python 3.10+** (for PDF-to-image conversion)
- **Outlook 365 Classic Edition** (with API access)

---

### **2. Install Dependencies**
Run the following commands in your terminal:
```sh
npm install
npm install pdfjs-dist
pip install pdf2image flask
```

---

### **3. Electron Main Process Setup**
Ensure your `main.ts` (or `electron.js`) includes the Python process starter:
```typescript
const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const axios = require("axios");

app.whenReady().then(() => {
    const pythonProcess = spawn("python", [path.join(__dirname, "pdf_converter.py")]);

    pythonProcess.stdout.on("data", (data) => console.log(`Python: ${data}`));
    pythonProcess.stderr.on("data", (data) => console.error(`Python Error: ${data}`));

    app.on("window-all-closed", () => {
        pythonProcess.kill();
        app.quit();
    });
});
```

---

### **4. Python PDF-to-Image Converter**
Create a new file called **`pdf_converter.py`** for PDF-to-image conversion.
```python
from flask import Flask, request, jsonify
from pdf2image import convert_from_path
import os

app = Flask(__name__)
OUTPUT_FOLDER = "output_images"
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

@app.route("/convert-pdf", methods=["POST"])
def convert_pdf():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    pdf_path = os.path.join(OUTPUT_FOLDER, file.filename)
    file.save(pdf_path)

    images = convert_from_path(pdf_path, dpi=300)
    image_paths = []

    for i, img in enumerate(images):
        img_path = os.path.join(OUTPUT_FOLDER, f"{file.filename}_page_{i + 1}.png")
        img.save(img_path, "PNG")
        image_paths.append(img_path)

    return jsonify({"images": image_paths})

if __name__ == "__main__":
    app.run(port=5001)
```

---

### **5. Running the Application**
To start the app:
```sh
npm run start
```

---

### **6. Usage**
- **Fetch Emails**: Automatically pulls selected Outlook emails.
- **Summarize Emails**: Click the **"Summarize Email"** button to generate concise email summaries in your preferred language.
- **Generate Replies**: Click the **"Write a Reply"** button to create suggested responses.
- **Spam Detection**: Click **"A Spam Email?"** to check if an email is potentially spam.
- **PDF Extraction**: Upload PDF attachments — the assistant will extract text automatically for improved understanding.

---

## Project Structure
```
📂 src
 ┣ 📂controllers
 ┃ ┣ 📜ConfigController.ts
 ┃ ┣ 📜OllamaController.ts
 ┣ 📂models
 ┃ ┣ 📜Files.ts
 ┃ ┣ 📜OutlookEmailItem.ts
 ┣ 📂renderer
 ┃ ┣ 📜app.tsx
 ┃ ┣ 📜renderer.ts
 ┣ 📜main.ts
 ┣ 📜pdf_converter.py
 ┣ 📜package.json
 ┗ 📜README.txt
```

---

## **Known Issues & Troubleshooting**
1. **PowerShell Execution Policy Error:**  
   ➡️ Run this in **PowerShell (Admin)** to bypass temporarily:  
   ```sh
   Set-ExecutionPolicy Bypass -Scope Process
   ```

2. **`pdf.worker.entry` Error:**  
   ➡️ Ensure you have the correct import statement in `app.tsx`:  
   ```typescript
   import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.js";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
   ```

3. **PDF Content Not Extracting:**  
   ➡️ Ensure your `handleFileChange()` function includes PDF text extraction logic.  
   ➡️ Check the console for extracted text for debugging.

---

## Future Improvements
🔹 Enhance prompt engineering for more natural and professional responses.  
🔹 Implement **confidence scoring** to flag uncertain AI-generated content.  
🔹 Improve **error handling** for failed PDF extractions and API limits.  

---

## Credits
Developed by *Wynter Lin** and **Yang Yue (Danny)** for the **IMT 574 Project** at the **University of Washington**.

---

## License
This project is licensed under the **MIT License**. Feel free to contribute and improve the codebase! 😊


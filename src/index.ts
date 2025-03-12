import {app, BrowserWindow, ipcMain} from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import winax from "winax";

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

const createWindow = (): void => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        height: 720,
        width: 1280,
        webPreferences: {
            preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
        },
    });

    // and load the index.html of the app.
    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY).then();

    // Open the DevTools.
    mainWindow.webContents.openDevTools();
};

// Handle getting the selected email
ipcMain.handle("get-selected-email", async () => {
    try {
        const outlook = new winax.Object("Outlook.Application");
        const explorer = outlook.ActiveExplorer();
        const selection = explorer?.Selection;

        if (!selection || selection.Count === 0) {
            return {error: "No email selected."};
        }

        const mailItem = selection.Item(1);

        let theAttachments: string[] = [];
        if (mailItem.Attachments && mailItem.Attachments.Count > 0) {
            const count = mailItem.Attachments.Count;
            const tempDir = path.join(os.tmpdir(), 'outlook-temp');

            // Create temp directory if it doesn't exist
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, {recursive: true});
            }

            for (let i = 1; i <= count; i++) {
                const attachment = mailItem.Attachments.Item(i);
                const tempFilePath = path.join(tempDir, attachment.FileName);

                // Save the attachment to a temporary file
                if (!fs.existsSync(tempFilePath)) {
                    attachment.SaveAsFile(tempFilePath);
                }

                // Add attachment metadata without creating a File object
                theAttachments.push(tempFilePath);
            }
        }
        return {
            subject: mailItem.Subject,
            body: mailItem.Body,
            sender: mailItem.SenderName,
            recipient: mailItem.To,
            receivedTime: mailItem.ReceivedTime,
            attachments: theAttachments,
        };
    } catch (error) {
        return {error: error.message};
    }
});

ipcMain.handle('get-user-data-dir', async () => {
    return app.getPath("userData")
})

// Handle file system operations
ipcMain.handle('fs-exists', async (_, path) => {
    return fs.existsSync(path);
});

ipcMain.handle('fs-read-file', async (_, path) => {
    return fs.readFileSync(path, 'utf8');
});

ipcMain.handle('fs-read-file-raw', async (_, path) => {
    return fs.readFileSync(path);
});

ipcMain.handle('fs-write-file', async (_, path, data) => {
    fs.writeFileSync(path, data);
    return true;
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

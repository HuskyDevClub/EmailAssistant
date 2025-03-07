// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import {contextBridge, ipcRenderer} from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
    getSelectedEmail: () => ipcRenderer.invoke("get-selected-email"),
    getUserDataDir: () => ipcRenderer.invoke('get-user-data-dir'),
    existFile: (path: string) => ipcRenderer.invoke('fs-exists', path),
    readFile: (path: string) => ipcRenderer.invoke('fs-read-file', path),
    writeFile: (path: string, data: string) => ipcRenderer.invoke('fs-write-file', path, data)
});
import {OutlookEmailItem} from "../models/OutlookEmailItem"

export function EmailViewer(email: OutlookEmailItem) {
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
}
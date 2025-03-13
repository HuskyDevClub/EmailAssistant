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

function extractFileName(filePath: string): string {
    // Split the path by directory separators (both / and \ for cross-platform)
    const parts = filePath.split(/[/\\]/);

    // Get the last part, which should be the filename
    return parts[parts.length - 1];
}

export function bufferToFile(filePath: string, buffer: Buffer): File {
    return new File(
        [buffer],
        extractFileName(filePath),
        {
            type: getMimeType(filePath),
            lastModified: new Date().getTime()
        }
    );

}
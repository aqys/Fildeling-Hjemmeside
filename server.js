const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'files/' });

const metadataFilePath = path.join(__dirname, 'files', 'metadata.json');
let fileMetadata = {};

if (fs.existsSync(metadataFilePath)) {
    fileMetadata = JSON.parse(fs.readFileSync(metadataFilePath));
}

if (!fs.existsSync(path.join(__dirname, 'files'))) {
    fs.mkdirSync(path.join(__dirname, 'files'));
}

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) {
        console.error('No file uploaded');
        return res.status(400).json({ error: 'No file uploaded' });
    }

    let originalName = file.originalname;
    let filePath = path.join(__dirname, 'files', originalName);
    let counter = 1;

    while (fs.existsSync(filePath)) {
        const ext = path.extname(originalName);
        const baseName = path.basename(originalName, ext);
        const baseNameWithoutCounter = baseName.replace(/-\d+$/, '');
        originalName = `${baseNameWithoutCounter}-${counter}${ext}`;
        filePath = path.join(__dirname, 'files', originalName);
        counter++;
    }

    fs.rename(file.path, filePath, (err) => {
        if (err) {
            console.error('Error saving file:', err);
            return res.status(500).json({ error: 'Failed to save file' });
        }

        const uploadDate = new Date().toISOString();
        fileMetadata[originalName] = { uploadDate };
        fs.writeFileSync(metadataFilePath, JSON.stringify(fileMetadata, null, 2));

        const filePageUrl = `${req.protocol}://${req.get('host')}/file/${originalName}`;
        res.json({ url: filePageUrl });
    });
});

function formatDate(dateString) {
    const date = new Date(dateString);
    const optionsDate = { day: '2-digit', month: '2-digit', year: '2-digit' };
    const optionsTime = { hour: '2-digit', minute: '2-digit' };
    const formattedDate = date.toLocaleDateString('en-GB', optionsDate).replace(/\//g, '-');
    const formattedTime = date.toLocaleTimeString('en-GB', optionsTime);
    return `${formattedDate} | ${formattedTime}`;
}

app.get('/file/:filename', (req, res) => {
    const filename = req.params.filename;
    const fileUrl = `/files/${filename}`;
    const uploadDate = fileMetadata[filename]?.uploadDate || 'Unknown';
    const fileHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="/file.css">
            <title>File | ${filename}</title>
        </head>
        <body>
            <main>
                <h1 id="fileName">${filename}</h1>
                <p id="uploadDate">Uploaded on: ${formatDate(uploadDate)}</p>
                <a id="fileLink" href="${fileUrl}" target="_blank">Download File</a>
                <a id="back" href="/index.html">Back</a>
            </main>
        </body>
        </html>
    `;
    res.send(fileHtml);
});

app.get('/recent-files', (req, res) => {
    fs.readdir(path.join(__dirname, 'files'), (err, files) => {
        if (err) {
            console.error('Error reading files directory:', err);
            return res.status(500).json({ error: 'Failed to read files directory' });
        }
        const recentFiles = files.filter(file => file !== 'metadata.json').map(file => ({
            name: file,
            uploadDate: formatDate(fileMetadata[file]?.uploadDate || 'Unknown')
        }));
        res.json(recentFiles);
    });
});

app.use('/files', express.static(path.join(__dirname, 'files')));

app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});
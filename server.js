const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());

const upload = multer({
    dest: 'files/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB fil limit
});

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

    const renameWithRetry = (oldPath, newPath, retries = 5, delay = 100) => {
        return new Promise((resolve, reject) => {
            const attemptRename = (retryCount) => {
                fs.rename(oldPath, newPath, (err) => {
                    if (!err) {
                        return resolve();
                    }
                    if (err.code === 'EBUSY' && retryCount > 0) {
                        setTimeout(() => attemptRename(retryCount - 1), delay);
                    } else {
                        reject(err);
                    }
                });
            };
            attemptRename(retries);
        });
    };

    renameWithRetry(file.path, filePath)
        .then(() => {
            const uploadDate = new Date().toISOString();
            const deleteDuration = req.body['delete-duration'];
            const customDeleteDuration = req.body['custom-delete-duration'];
            let deleteTimeout;

            if (customDeleteDuration) {
                deleteTimeout = parseInt(customDeleteDuration) * 60 * 60 * 1000; // convert hours to milliseconds
            } else {
                switch (deleteDuration) {
                    case '1h':
                        deleteTimeout = 1 * 60 * 60 * 1000; // 1 hour
                        break;
                    case '2h':
                        deleteTimeout = 2 * 60 * 60 * 1000; // 2 hours
                        break;
                    // Add more cases as needed
                    default:
                        deleteTimeout = 24 * 60 * 60 * 1000; // default to 24 hours
                }
            }

            fileMetadata[originalName] = { uploadDate, deleteTimeout };
            fs.writeFileSync(metadataFilePath, JSON.stringify(fileMetadata, null, 2));

            const filePageUrl = `${req.protocol}://${req.get('host')}/file/${originalName}`;
            res.json({ url: filePageUrl });
        })
        .catch((err) => {
            console.error('Error saving file:', err);
            res.status(500).json({ error: 'Failed to save file' });
        });
});

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Filen fylder mere end 10 MB' });
        }
    }
    next(err);
});

function formatDate(dateString) {
    const date = new Date(dateString);
    const optionsDate = { day: '2-digit', month: '2-digit', year: '2-digit' };
    const optionsTime = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
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
            <link href='https://fonts.googleapis.com/css?family=Unbounded' rel='stylesheet'>
            <title>File | ${filename}</title>
        </head>
        <body>
            <main>
                <h1 id="fileName">${filename}</h1>
                <p id="uploadDate">Uploaded on: ${formatDate(uploadDate)}</p>
                <div class="link-container">
                    <a id="fileLink" href="${fileUrl}" target="_blank">Download File</a>
                    <a id="back" href="/index.html">
                        <button>Back</button>
                    </a>
                </div>
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
    console.log('Server started on http://172.16.3.42:3000');
});

setInterval(() => {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    console.log('Tjekker om filer er ældre end 24 timer.');

    for (const [filename, metadata] of Object.entries(fileMetadata)) {
        const uploadDate = new Date(metadata.uploadDate);
        if (uploadDate < oneMinuteAgo) {
            const filePath = path.join(__dirname, 'files', filename);
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error(`Error deleting file ${filename}:`, err);
                } else {
                    console.log(`Deleted file ${filename}`);
                    delete fileMetadata[filename];
                    fs.writeFileSync(metadataFilePath, JSON.stringify(fileMetadata, null, 2));
                }
            });
        }
    }
}, 5 * 60 * 1000);
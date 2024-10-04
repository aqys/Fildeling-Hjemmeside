const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const JWT_SECRET = 'your_secret_key'; // Use environment variable in production

const USERS_FILE_PATH = path.join(__dirname, 'users.json');
let usersData = JSON.parse(fs.readFileSync(USERS_FILE_PATH, 'utf-8'));

// Helper function to save users to JSON file
function saveUsersToFile() {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(usersData, null, 2));
}

// Signup route
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;

    // Check if the user already exists
    const userExists = usersData.users.find(user => user.username === username);
    if (userExists) {
        return res.status(400).json({ error: 'User already exists' });
    }

    // Hash the password before saving it
    const hashedPassword = await bcrypt.hash(password, 10);
    usersData.users.push({ username, password: hashedPassword, profilePic: 'default-profile.png' });
    saveUsersToFile();

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Signup successful', token });
});

// Login route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const user = usersData.users.find(user => user.username === username);
    if (!user) {
        return res.status(400).json({ error: 'Invalid username or password' });
    }

    // Compare entered password with the stored hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
        return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Login successful', token });
});

// Middleware to authenticate using JWT
function authenticateJWT(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(403).json({ error: 'Not authenticated' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// Logout route (optional, since JWT is stateless)
app.get('/logout', (req, res) => {
    res.json({ message: 'Logout successful' });
});

const upload = multer({
    dest: 'files/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB file size limit
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

app.post('/upload', authenticateJWT, upload.single('file'), (req, res) => {
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
            fileMetadata[originalName] = { uploadDate };
            fs.writeFileSync(metadataFilePath, JSON.stringify(fileMetadata, null, 2));

            const filePageUrl = `${req.protocol}://${req.get('host')}/file/${originalName}`;
            res.json({ url: filePageUrl });
        })
        .catch((err) => {
            console.error('Error saving file:', err);
            res.status(500).json({ error: 'Failed to save file' });
        });
});

// Error handling middleware for multer
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size exceeds the limit of 5 MB' });
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

<<<<<<< HEAD
app.listen(3000, () => {
    console.log('Server started on http://172.16.3.42:3000');
=======
// Multer setup for profile picture uploads
const profilePicStorage = multer.diskStorage({
    destination: 'profile-pics/',
    filename: (req, file, cb) => {
        const username = req.user.username; // Use the authenticated user's username
        cb(null, `${username}-${file.originalname}`);
    }
});
const uploadProfilePic = multer({ storage: profilePicStorage });

// Profile picture upload route
app.post('/change-profile-pic', authenticateJWT, uploadProfilePic.single('profilePic'), (req, res) => {
    const user = usersData.users.find(user => user.username === req.user.username);
    if (user) {
        const profilePicPath = `profile-pics/${req.file.filename}`;
        user.profilePic = profilePicPath;
        saveUsersToFile();
        res.status(200).json({ message: 'Profile picture updated', url: profilePicPath });
    } else {
        res.status(403).json({ error: 'User not found' });
    }
});

app.listen(3000, () => {
    console.log('Server started on http://172.16.3.42/:3000');
>>>>>>> 5e3546d205ea34e919ede4ebd4db35dd8d58269b
});

setInterval(() => {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    console.log('Running periodic check for files older than 24 hours at', now);

    for (const [filename, metadata] of Object.entries(fileMetadata)) {
        const uploadDate = new Date(metadata.uploadDate);
        console.log(`Checking file: ${filename}, uploadDate: ${uploadDate}`);
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
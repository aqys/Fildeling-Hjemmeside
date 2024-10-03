document.getElementById('fileInput').addEventListener('change', function(event) {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    const file = event.target.files[0];

    if (file.size > MAX_FILE_SIZE) {
        const modal = document.getElementById('fileSizeModal');
        const closeModalButtons = document.querySelectorAll('.close');
        modal.style.display = 'block'; // Ensure the modal is displayed
        modal.classList.add('show');

        closeModalButtons.forEach(button => {
            button.onclick = function() {
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 500); // Match the transition duration
            };
        });

        window.onclick = function(event) {
            if (event.target == modal) {
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 500); // Match the transition duration
            }
        };

        return;
    }

    if (file) {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'http://172.16.3.42:3000/upload', true); // Update this line

        xhr.upload.onprogress = function(event) {
            if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                const progressText = document.getElementById('uploadProgressText');
                progressText.style.display = 'block';
                progressText.textContent = `${percentComplete}%`;
            }
        };

        xhr.onload = function() {
            if (xhr.status === 200) {
                const result = JSON.parse(xhr.responseText);
                window.location.href = result.url;
            } else {
                console.error('Upload failed:', xhr.statusText);
            }
        };

        xhr.onerror = function() {
            console.error('There was a problem with the upload operation.');
        };

        xhr.send(formData);
    }
});

async function fetchRecentFiles() {
    try {
        const response = await fetch('http://172.16.3.42:3000/recent-files'); // Update this line
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const files = await response.json();

        files.sort((a, b) => parseDate(b.uploadDate) - parseDate(a.uploadDate));

        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';
        files.forEach(file => {
            const listItem = document.createElement('li');
            const link = document.createElement('a');
            link.href = `/file/${file.name}`;
            link.textContent = file.name;
            const uploadInfo = document.createElement('span');
            uploadInfo.className = 'upload-info';
            uploadInfo.textContent = ` (Uploaded on: ${file.uploadDate})`;
            listItem.appendChild(link);
            listItem.appendChild(uploadInfo);
            fileList.appendChild(listItem);
        });
    } catch (error) {
        console.error('fetch fejl:', error);
    }
}

function parseDate(dateString) {
    const [date, time] = dateString.split(' | ');
    const [month, day, year] = date.split('-');
    const [hours, minutes, seconds] = time.split(':');
    return new Date(`20${year}-${month}-${day}T${hours}:${minutes}:${seconds}`);
}

document.addEventListener('DOMContentLoaded', fetchRecentFiles);

// Handle Signup
document.getElementById('signup').addEventListener('submit', async function(event) {
    event.preventDefault();
    const username = document.getElementById('signupUsername').value;
    const password = document.getElementById('signupPassword').value;

    const response = await fetch('http://localhost:3000/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    if (response.ok) {
        alert('Signup successful');
        document.getElementById('signupForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
    } else {
        alert('Signup failed');
    }
});

// Handle Login
document.getElementById('login').addEventListener('submit', async function(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    const response = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    if (response.ok) {
        alert('Login successful');
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('profileSection').style.display = 'block';
        document.getElementById('logoutButton').style.display = 'block';
    } else {
        alert('Login failed');
    }
});

// Handle Logout
document.getElementById('logout').addEventListener('click', async function() {
    const response = await fetch('http://localhost:3000/logout');
    if (response.ok) {
        alert('Logout successful');
        document.getElementById('profileSection').style.display = 'none';
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('logoutButton').style.display = 'none';
    }
});

// Handle Profile Picture Change
document.getElementById('profilePicForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const formData = new FormData();
    const file = document.getElementById('profilePicInput').files[0];
    formData.append('profilePic', file);

    fetch('http://localhost:3000/change-profile-pic', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.url) {
            document.getElementById('profilePic').src = data.url;
        }
    })
    .catch(err => console.error(err));
});

// New Login and Signup Handlers with JWT
document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    const response = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    });

    const result = await response.json();
    if (response.ok) {
        localStorage.setItem('token', result.token);
        alert('Login successful');
        displayProfile();
    } else {
        alert(result.error);
    }
});

document.getElementById('signupForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const username = document.getElementById('signupUsername').value;
    const password = document.getElementById('signupPassword').value;

    const response = await fetch('http://localhost:3000/signup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    });

    const result = await response.json();
    if (response.ok) {
        localStorage.setItem('token', result.token);
        alert('Signup successful');
        displayProfile();
    } else {
        alert(result.error);
    }
});

function displayProfile() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('profileSection').style.display = 'block';
    document.getElementById('logoutButton').style.display = 'block';
}
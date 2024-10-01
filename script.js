document.getElementById('fileInput').addEventListener('change', async function(event) {
    if (event.target.files.length > 0) {
        const formData = new FormData();
        formData.append('file', event.target.files[0]);

        try {
            const response = await fetch('http://localhost:3000/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const result = await response.json();
            window.location.href = result.url;
        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);
        }
    }
});

async function fetchRecentFiles() {
    try {
        const response = await fetch('http://localhost:3000/recent-files');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const files = await response.json();

        // Sort files by upload date (newest to oldest)
        files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

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
        console.error('There was a problem with the fetch operation:', error);
    }
}

document.addEventListener('DOMContentLoaded', fetchRecentFiles);
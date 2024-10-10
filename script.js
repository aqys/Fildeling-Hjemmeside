document.getElementById('fileInput').addEventListener('change', function(event) {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    const file = event.target.files[0];

    const dropZone = document.getElementById('dropZone');
    const dropText = document.getElementById('dropText');

    document.addEventListener('dragover', function(event) {
        event.preventDefault();
        dropZone.style.display = 'flex';
    });

    document.addEventListener('dragleave', function(event) {
        if (!dropZone.contains(event.relatedTarget)) {
            dropZone.style.display = 'none';
        }
    });

    document.addEventListener('drop', function(event) {
        event.preventDefault();
        dropZone.style.display = 'none';
    
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    if (file.size > MAX_FILE_SIZE) {
        const modal = document.getElementById('fileSizeModal');
        const closeModalButtons = document.querySelectorAll('.close');
        modal.style.display = 'block';
        modal.classList.add('show');

        closeModalButtons.forEach(button => {
            button.onclick = function() {
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 500);
            };
        });

        window.onclick = function(event) {
            if (event.target == modal) {
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 500);
            }
        };

        return;
    }

    if (file) {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'http://172.16.3.42:3000/upload', true);

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
            console.error('Der var et problem med at uploade.');
        };

        xhr.send(formData);
    }
});

async function fetchRecentFiles() {
    try {
        const response = await fetch('http://172.16.3.42:3000/recent-files');
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
            uploadInfo.textContent = ` (Uploadede den: ${file.uploadDate})`;
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
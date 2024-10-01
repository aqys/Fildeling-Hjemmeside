document.getElementById('fileInput').addEventListener('change', async function(event) {
    if (event.target.files.length > 0) {
        const formData = new FormData();
        formData.append('file', event.target.files[0]);

        try {
            const response = await fetch('http://localhost:3000/upload', { // Updated URL
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
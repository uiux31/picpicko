const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
// The cloud host will provide a PORT, otherwise fall back to 3000 locally
const PORT = process.env.PORT || 3000;
const TTL_MS = 60 * 1000; // 60 seconds auto-delete

app.use(express.json({ limit: '20mb' }));
app.use(express.static('public'));

const imageStore = new Map();

// 1. Upload API
app.post('/api/upload', (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const id = crypto.randomBytes(3).toString('hex');
    imageStore.set(id, image);
    console.log(`📸 Image saved: ${id}. Will delete in 60s.`);

    setTimeout(() => {
        imageStore.delete(id);
        console.log(`🗑️ Image expired & deleted: ${id}`);
    }, TTL_MS);

    // CLOUD ROUTING: Automatically gets your live domain name (e.g., https://your-app.onrender.com)
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol; 
    
    res.json({ downloadUrl: `${protocol}://${host}/d/${id}` });
});

// 2. Serve Download Page
app.get('/d/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'download.html'));
});

// 3. API to fetch image data
app.get('/api/image/:id', (req, res) => {
    const image = imageStore.get(req.params.id);
    if (!image) return res.status(404).json({ error: 'Expired' });
    res.json({ image });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Photo Booth is running on port ${PORT}!`);
});

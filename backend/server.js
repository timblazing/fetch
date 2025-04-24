const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const morgan = require('morgan');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;
const COBALT_API_URL = process.env.COBALT_API_URL || 'http://fetch-api:9000';
const FILE_STORAGE_PATH = process.env.FILE_STORAGE_PATH || path.join(__dirname, 'data');
const FILE_EXPIRY_MINUTES = parseInt(process.env.FILE_EXPIRY_MINUTES || '30');

// Ensure storage directory exists
fs.ensureDirSync(FILE_STORAGE_PATH);

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Store download progress
const downloadProgress = new Map();

// Schedule cleanup of old files every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Running cleanup of expired files...');
  try {
    const files = await fs.readdir(FILE_STORAGE_PATH);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(FILE_STORAGE_PATH, file);
      const stats = await fs.stat(filePath);
      const fileAge = (now - stats.mtimeMs) / (1000 * 60); // age in minutes
      
      if (fileAge > FILE_EXPIRY_MINUTES) {
        console.log(`Removing expired file: ${file}`);
        await fs.remove(filePath);
        // Also remove from progress map if exists
        downloadProgress.delete(file.split('.')[0]); // Remove extension to get ID
      }
    }
  } catch (error) {
    console.error('Error during file cleanup:', error);
  }
});

// API Routes
app.post('/api/download', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Generate a unique ID for this download
    const downloadId = uuidv4();
    
    // Initialize progress
    downloadProgress.set(downloadId, {
      progress: 0,
      status: 'processing',
      url: null,
      filename: null,
      error: null,
      createdAt: Date.now()
    });
    
    // Start the download process asynchronously
    processDownload(downloadId, url);
    
    // Return the download ID immediately
    return res.status(202).json({ 
      downloadId,
      message: 'Download started' 
    });
    
  } catch (error) {
    console.error('Download request error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Route to serve downloaded files
app.get('/api/download/:id/file', async (req, res) => {
  try {
    const downloadId = req.params.id;
    const downloadInfo = downloadProgress.get(downloadId);
    
    if (!downloadInfo) {
      return res.status(404).json({ error: 'Download not found' });
    }
    
    if (downloadInfo.status !== 'ready') {
      return res.status(400).json({ error: 'Download not ready' });
    }
    
    const filePath = path.join(FILE_STORAGE_PATH, `${downloadId}.mp4`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return res.status(404).json({ error: 'File not found' });
    }
    
    console.log(`Serving file: ${filePath}`);
    
    // Get file stats for content length
    const stat = fs.statSync(filePath);
    
    // Set appropriate headers
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadInfo.filename || 'download.mp4'}"`);
    
    // Create read stream and pipe to response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    // Handle errors
    fileStream.on('error', (error) => {
      console.error(`Error streaming file ${filePath}:`, error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming file' });
      } else {
        res.end();
      }
    });
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/download/:id/status', (req, res) => {
  const { id } = req.params;
  
  if (!downloadProgress.has(id)) {
    return res.status(404).json({ error: 'Download not found' });
  }
  
  return res.json(downloadProgress.get(id));
});

// Helper function to process download
async function processDownload(downloadId, url) {
  try {
    console.log(`Processing download ${downloadId} for URL: ${url}`);
    console.log(`Using Cobalt API at: ${COBALT_API_URL}`);
    
    // Ensure the API URL has a trailing slash
    const apiEndpoint = COBALT_API_URL.endsWith('/') ? COBALT_API_URL : `${COBALT_API_URL}/`;
    console.log(`Formatted API endpoint: ${apiEndpoint}`);
    
    // Create the request data according to the API documentation
    const requestData = {
      url,
      videoQuality: 'max',
      audioFormat: 'best',
      audioBitrate: '320',
      filenameStyle: 'pretty',
      downloadMode: 'auto',
      youtubeVideoCodec: 'h264',
      alwaysProxy: false,
      disableMetadata: false,
      tiktokFullAudio: true,
      tiktokH265: false,
      twitterGif: true,
      youtubeHLS: false
    };
    
    // Log the exact request we're making
    console.log(`Request data: ${JSON.stringify(requestData)}`);
    
    // Make the request with the correct headers as specified in the documentation
    console.log(`Making axios request to: ${apiEndpoint}`);
    const response = await axios({
      method: 'post',
      url: 'http://fetch-api:9000/', // Use port 9000 with trailing slash for internal container communication
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: requestData,
      // Disable any URL transformations that might be happening
      transformRequest: [(data, headers) => {
        console.log('Transform request headers:', JSON.stringify(headers));
        return JSON.stringify(data);
      }]
    });
    
    // Log the response status and headers
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers: ${JSON.stringify(response.headers)}`);
    
    const data = response.data;
    console.log(`Cobalt API response status: ${data.status}`);
    
    if (data.status === 'error') {
      console.error(`Cobalt API error: ${data.error.code}`);
      downloadProgress.set(downloadId, {
        ...downloadProgress.get(downloadId),
        status: 'error',
        error: data.error.code
      });
      return;
    }
    
    let downloadUrl, filename;
    
    if (data.status === 'redirect' || data.status === 'tunnel') {
      if (data.status === 'tunnel') {
        console.log(`Received tunnel URL: ${data.url}`);
        
        // Replace localhost:3001 with fetch-api:9000 for internal Docker network communication
        let tunnelUrl = data.url;
        if (tunnelUrl.includes('localhost:3001')) {
          tunnelUrl = tunnelUrl.replace('localhost:3001', 'fetch-api:9000');
          console.log(`Adjusted tunnel URL for Docker: ${tunnelUrl}`);
        }
        
        try {
          // Download the file from the tunnel URL
          console.log(`Downloading file from tunnel URL: ${tunnelUrl}`);
          const fileResponse = await axios({
            method: 'get',
            url: tunnelUrl,
            responseType: 'stream'
          });
          
          // Update progress to indicate download has started
          downloadProgress.set(downloadId, {
            ...downloadProgress.get(downloadId),
            progress: 10,
            filename: data.filename || 'download.mp4'
          });
          
          console.log(`Starting download of file to: ${path.join(FILE_STORAGE_PATH, `${downloadId}.mp4`)}`);
          
          // Download the file
          const writer = fs.createWriteStream(path.join(FILE_STORAGE_PATH, `${downloadId}.mp4`));
          
          fileResponse.data.pipe(writer);
          
          return new Promise((resolve, reject) => {
            writer.on('finish', () => {
              console.log(`Download completed for ${downloadId}`);
              downloadProgress.set(downloadId, {
                ...downloadProgress.get(downloadId),
                status: 'ready',
                progress: 100,
                url: `/api/download/${downloadId}/file`
              });
              resolve();
            });
            
            writer.on('error', (err) => {
              console.error(`File write error for ${downloadId}:`, err);
              downloadProgress.set(downloadId, {
                ...downloadProgress.get(downloadId),
                status: 'error',
                error: 'File write error'
              });
              reject(err);
            });
          });
        } catch (error) {
          console.error(`Error downloading from tunnel URL: ${error}`);
          downloadProgress.set(downloadId, {
            ...downloadProgress.get(downloadId),
            status: 'error',
            error: 'Error downloading from tunnel URL'
          });
          return;
        }
      } else {
        downloadUrl = data.url;
        filename = data.filename || 'download.mp4';
        console.log(`Got direct download URL, filename: ${filename}`);
      }
    } else if (data.status === 'picker' && data.picker && data.picker.length > 0) {
      downloadUrl = data.picker[0].url;
      filename = data.picker[0].filename || 'download.mp4';
      console.log(`Got picker download URL, using first option, filename: ${filename}`);
    } else {
      console.error(`Unsupported Cobalt API response: ${data.status}`);
      downloadProgress.set(downloadId, {
        ...downloadProgress.get(downloadId),
        status: 'error',
        error: 'Unsupported response from Cobalt API'
      });
      return;
    }
    
    // Update progress to indicate download has started
    downloadProgress.set(downloadId, {
      ...downloadProgress.get(downloadId),
      progress: 10,
      filename
    });
    
    console.log(`Starting download of file to: ${path.join(FILE_STORAGE_PATH, `${downloadId}.mp4`)}`);
    
    // Download the file
    const writer = fs.createWriteStream(path.join(FILE_STORAGE_PATH, `${downloadId}.mp4`));
    
    const response2 = await axios({
      method: 'get',
      url: downloadUrl,
      responseType: 'stream',
      onDownloadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        // Update progress
        downloadProgress.set(downloadId, {
          ...downloadProgress.get(downloadId),
          progress: Math.min(10 + percentCompleted * 0.9, 100) // Start at 10%, go to 100%
        });
      }
    });
    
    // Simulate progress updates if we don't get them from axios
    let currentProgress = 10;
    const progressInterval = setInterval(() => {
      const download = downloadProgress.get(downloadId);
      if (download && download.progress === currentProgress) {
        currentProgress += 5;
        downloadProgress.set(downloadId, {
          ...download,
          progress: Math.min(currentProgress, 99) // Don't reach 100% until done
        });
      }
      
      if (currentProgress >= 100 || !downloadProgress.has(downloadId)) {
        clearInterval(progressInterval);
      }
    }, 500);
    
    response2.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        clearInterval(progressInterval);
        console.log(`Download completed for ${downloadId}`);
        downloadProgress.set(downloadId, {
          ...downloadProgress.get(downloadId),
          status: 'ready',
          progress: 100,
          url: `/api/download/${downloadId}/file`
        });
        resolve();
      });
      
      writer.on('error', (err) => {
        clearInterval(progressInterval);
        console.error(`File write error for ${downloadId}:`, err);
        downloadProgress.set(downloadId, {
          ...downloadProgress.get(downloadId),
          status: 'error',
          error: 'File write error'
        });
        reject(err);
      });
    });
    
  } catch (error) {
    console.error(`Error processing download ${downloadId}:`, error);
    downloadProgress.set(downloadId, {
      ...downloadProgress.get(downloadId),
      status: 'error',
      error: error.message || 'Unknown error'
    });
  }
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

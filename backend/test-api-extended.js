const axios = require('axios');

async function testCobaltAPI() {
  try {
    console.log('Testing Cobalt API with different configurations...');
    
    // Test configurations
    const configs = [
      {
        name: "Internal Docker network with port 9000 and trailing slash",
        url: 'http://fetch-api:9000/'
      },
      {
        name: "Internal Docker network with port 9000 no trailing slash",
        url: 'http://fetch-api:9000'
      },
      {
        name: "Localhost with port 3001 and trailing slash",
        url: 'http://localhost:3001/'
      },
      {
        name: "Localhost with port 3001 no trailing slash",
        url: 'http://localhost:3001'
      }
    ];
    
    // Standard request data
    const requestData = {
      url: 'https://www.youtube.com/watch?v=glVQULAya8o',
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
    
    // Standard headers
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Try each configuration
    for (const config of configs) {
      try {
        console.log(`\nTrying: ${config.name}`);
        console.log(`URL: ${config.url}`);
        
        const response = await axios({
          method: 'post',
          url: config.url,
          headers: headers,
          data: requestData,
          timeout: 5000 // 5 second timeout
        });
        
        console.log(`✅ SUCCESS with ${config.name}`);
        console.log('Status:', response.status);
        console.log('Response status:', response.data.status);
        console.log('Response type:', typeof response.data);
        
        // Only show full response data if it's not too large
        if (JSON.stringify(response.data).length < 500) {
          console.log('Full data:', JSON.stringify(response.data, null, 2));
        } else {
          console.log('Data preview:', JSON.stringify(response.data).substring(0, 200) + '...');
        }
      } catch (error) {
        console.log(`❌ FAILED with ${config.name}: ${error.message}`);
        if (error.response) {
          console.log('Response status:', error.response.status);
          console.log('Response data:', JSON.stringify(error.response.data, null, 2));
        }
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testCobaltAPI();

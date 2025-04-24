const axios = require('axios');

async function testDifferentURLs() {
  try {
    console.log('Testing Cobalt API with different URLs...');
    
    // Test URLs from different platforms
    const testURLs = [
      { name: "TikTok", url: "https://www.tiktok.com/@tiktok/video/7118685586442260782" },
      { name: "Twitter", url: "https://twitter.com/Twitter/status/1580661436132757505" },
      { name: "Instagram", url: "https://www.instagram.com/p/CjnGvuYuAMX/" }
    ];
    
    // Standard request data template
    const requestTemplate = {
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
    
    // Try each URL
    for (const testURL of testURLs) {
      try {
        console.log(`\nTrying ${testURL.name} URL: ${testURL.url}`);
        
        const requestData = {
          ...requestTemplate,
          url: testURL.url
        };
        
        const response = await axios({
          method: 'post',
          url: 'http://fetch-api:9000/',
          headers: headers,
          data: requestData,
          timeout: 10000 // 10 second timeout
        });
        
        console.log(`✅ SUCCESS with ${testURL.name}`);
        console.log('Status:', response.status);
        console.log('Response status:', response.data.status);
        
        // Only show full response data if it's not too large
        if (JSON.stringify(response.data).length < 500) {
          console.log('Full data:', JSON.stringify(response.data, null, 2));
        } else {
          console.log('Data preview:', JSON.stringify(response.data).substring(0, 200) + '...');
        }
      } catch (error) {
        console.log(`❌ FAILED with ${testURL.name}: ${error.message}`);
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
testDifferentURLs();

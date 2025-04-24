const axios = require('axios');

async function testCobaltAPI() {
  try {
    console.log('Testing Cobalt API...');
    
    // Try with trailing slash
    try {
      console.log('Trying with trailing slash...');
      const response1 = await axios({
        method: 'post',
        url: 'http://fetch-api:9000/',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        data: {
          url: 'https://www.youtube.com/watch?v=glVQULAya8o',
          videoQuality: 'max',
          audioFormat: 'best'
        }
      });
      console.log('Success with trailing slash!');
      console.log('Status:', response1.status);
      console.log('Data:', JSON.stringify(response1.data, null, 2));
      return;
    } catch (error1) {
      console.log('Failed with trailing slash:', error1.message);
      if (error1.response) {
        console.log('Response status:', error1.response.status);
        console.log('Response data:', JSON.stringify(error1.response.data, null, 2));
      }
    }
    
    // Try without trailing slash
    try {
      console.log('Trying without trailing slash...');
      const response2 = await axios({
        method: 'post',
        url: 'http://fetch-api:9000',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        data: {
          url: 'https://www.youtube.com/watch?v=glVQULAya8o',
          videoQuality: 'max',
          audioFormat: 'best'
        }
      });
      console.log('Success without trailing slash!');
      console.log('Status:', response2.status);
      console.log('Data:', JSON.stringify(response2.data, null, 2));
      return;
    } catch (error2) {
      console.log('Failed without trailing slash:', error2.message);
      if (error2.response) {
        console.log('Response status:', error2.response.status);
        console.log('Response data:', JSON.stringify(error2.response.data, null, 2));
      }
    }
    
    // Try with api endpoint
    try {
      console.log('Trying with /api endpoint...');
      const response3 = await axios({
        method: 'post',
        url: 'http://fetch-api:9000/api',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        data: {
          url: 'https://www.youtube.com/watch?v=glVQULAya8o',
          videoQuality: 'max',
          audioFormat: 'best'
        }
      });
      console.log('Success with /api endpoint!');
      console.log('Status:', response3.status);
      console.log('Data:', JSON.stringify(response3.data, null, 2));
      return;
    } catch (error3) {
      console.log('Failed with /api endpoint:', error3.message);
      if (error3.response) {
        console.log('Response status:', error3.response.status);
        console.log('Response data:', JSON.stringify(error3.response.data, null, 2));
      }
    }
    
    // Try with a GET request to see API info
    try {
      console.log('Trying GET request to root endpoint...');
      const response4 = await axios.get('http://fetch-api:9000/');
      console.log('Success with GET request!');
      console.log('Status:', response4.status);
      console.log('Data:', JSON.stringify(response4.data, null, 2));
    } catch (error4) {
      console.log('Failed with GET request:', error4.message);
      if (error4.response) {
        console.log('Response status:', error4.response.status);
        console.log('Response data:', JSON.stringify(error4.response.data, null, 2));
      }
    }
    
  } catch (error) {
    console.error('Error testing Cobalt API:', error);
  }
}

testCobaltAPI();

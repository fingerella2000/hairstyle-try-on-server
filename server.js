const express = require('express');
const { Expo } = require('expo-server-sdk');
const http = require('http');
const axios = require('axios');
const app = express();
const expo = new Expo();

app.use(express.json());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// use this function below or use Expo's Push Notification Tool from: https://expo.dev/notifications
async function sendPushNotification(expoPushToken) {
  console.log('send push notification in expo');
  const expoEndpoint = 'https://exp.host/--/api/v2/push/send';
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: 'Your new hairstyle is blened!',
    body: 'View it in your gallery.',
    badge: 1,
    data: {
      "screen": "Result", // The name of the screen to navigate to
    },
  };

  axios.post(expoEndpoint, message, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-encoding': 'gzip, deflate',
    },
  })
  .then((response) => {
    console.log('Notification sent:', response.data);
  })
  .catch((error) => {
    console.error('Error sending notification:', error);
  });
}

app.post('/send-notification', async (req, res) => {
  try {
    const { pushToken, jobName } = req.body;
    console.log(req.body);

    console.log(`pushToken: ${pushToken}`);
    console.log(`jobName: ${jobName}`);
    console.log('calling /send-notification');


    let jobStatus = '';
    // define the async function to get azure ml service
    async function asyncFunction() {
      console.log('calling azure ml service');
      // data setup to call azure ml api
      const formData = {
        'grant_type': 'client_credentials',
        'client_id': '7b7950dc-b0c5-4587-b1a4-2595dde4a46e',
        'client_secret': 'E-X8Q~ze8OSKIwt-KlsRshHxhPLCHhdiyl.hKa5G',
        'resource': 'https://management.azure.com'
      };
      const url = 'https://login.microsoftonline.com/784a625a-3383-4ec8-82f1-4525122fde6c/oauth2/token';
      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      };

      // call azure ml api to get azure ml management access token
      axios.post(url, formData, config).then((response) => {
        const accessToken = response.data.access_token;
        // console.log('accessToken is:' + accessToken);

        // data setup to call azure ml api
        const url = `https://ml.azure.com/api/ukwest/history/v1.0/subscriptions/a1266c53-9bc0-48f4-8b55-6cb3829bb713/resourceGroups/fingerella2000-rg/providers/Microsoft.MachineLearningServices/workspaces/ml-workspace-uk/runs/${jobName}`;
        const config = {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        };
        
        // call azure ml api to get azure ml job status
        axios.get(url, config).then((response) => {
          const data = response.data;
          jobStatus = data.status;
          console.log('job status: ' + jobStatus);
          if (jobStatus === 'Completed') {
            // send push notifiction to client after job finished
            sendPushNotification(pushToken);
          }
        }).catch((error) => {
          console.error('error:', error);
        });   
      }).catch((error) => {
        console.error('error:', error);
      });
    }

    await asyncFunction();

    if (jobStatus != 'Completed') {
      // get job status every 5 minutes
      const intervalTime = 300000; // Interval in milliseconds
      const intervalId = setInterval(async () => {
        await asyncFunction();
        if (jobStatus === 'Completed') {
          clearInterval(intervalId); // Stop the interval if job completed
        }
      }, intervalTime);
    }

    res.json({ success: true, message: 'Notifications sent successfully' });
  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to send notifications' });
  }
});

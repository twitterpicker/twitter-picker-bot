
const express = require('express');
const { validateWebhook } = require('twitter-autohook');
const { startWebHook, endWebHook, secrets } = require('./webhook');
const app = express();


const port = process.env.PORT || 3000;
const baseURL = 'https://localhost:443';
const localWebHookURL = baseURL + '/webhook/twitter';

app.get('/', (req, res) => {
    res.send("API RUNNING");
})

app.get('/restart-hook', async (req, res) => {
    // await endWebHook();
    await startWebHook(localWebHookURL);
    res.send("API RUNNING");
})

app.all('/webhook/twitter', async (request, response) => {
    // Fulfills the CRC check when Twitter sends a CRC challenge
    if (request.query.crc_token) {
        const signature = validateWebhook(request.query.crc_token, { consumer_secret: secrets.consumer_secret });
        response.json(signature);
    } else {
        // Send a successful response to Twitter
        response.sendStatus(200);
        // Add your logic to process the event
        console.log('Received a webhook event:', request.body);
    }
});


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})




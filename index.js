
const express = require('express');
const { validateWebhook } = require('twitter-autohook');
const { startWebHook, endWebHook, secrets, sendMessage, consumeEvent } = require('./webhook');
var bodyParser = require('body-parser')

const app = express();
app.use(bodyParser.json())

const port = process.env.PORT || 3000;
const baseURL = 'https://embarrassed-dove-coveralls.cyclic.app/';
const localWebHookURL = baseURL + '/webhook/twitter';

app.get('/', (req, res) => {
    res.send("API RUNNING");
})

app.get('/restart-hook', async (req, res) => {
    // await endWebHook();
    await startWebHook(localWebHookURL);
    res.send("API RUNNING");
})

app.get('/check-send-message', async (req, res) => {
    await sendMessage("1566444028748369920", "I love you! x 10000");

    // Disable caching for content files
    res.header("Cache-Control", "no-cache, no-store, must-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires", 0);

    // send response
    res.send("message sent");
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
        await consumeEvent(request.body)
    }
});


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})




const express = require('express');
var bodyParser = require('body-parser')
const app = express();
app.use(bodyParser.json())

let { Autohook } = require('twitter-autohook');
let crypto = require('crypto');
const axios = require('axios');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));





// ________________________ENVIRONMENT_____________________________ //
let method = 'POST';
let oauth_version = "1.0";
let oauth_timestamp = null;
let oauth_nonce = null;
let webhook_environment = "bot";
let oauth_signature_method = "HMAC-SHA1";


// ________________________SECRETS_&_TOKENS_____________________________ //
let oauth_consumer_key = process.env.oauth_consumer_key;
let ngrok_secret = process.env.ngrok_secret;
let oauth_token = process.env.oauth_token;
let oauth_token_secret = process.env.oauth_token_secret;
let oauth_consumer_secret = process.env.oauth_consumer_secret;
let send_message_endpoint = "https://api.twitter.com/1.1/direct_messages/events/new.json";
let query_winner_endpoint = "https://twitter-picker.netlify.app/api/get-winner-for-bot";
let generate_winner_endpoint = "https://twitter-picker.netlify.app/api/generate-winner-for-bot";


// should be taken from .env files (TO DO)


const port = process.env.PORT || 3000;


// ________________________UTILS FOR SENDING MESSAGE__________________________________________ //

// returns a 32 Character Alpha-numeric string (to be used in authorization process)
function generateNonce(length) {
  let chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var result = '';
  for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}



// returns a timestamp (to be used in authorization process)
function getTimeStamp() {
  return Math.floor(Date.now() / 1000);
}




// returns the necessary parameters (to be used in authorization process)
function getParameters() {
  oauth_timestamp = getTimeStamp();
  oauth_nonce = generateNonce(32);

  var parameters = {
    oauth_consumer_key: oauth_consumer_key,
    oauth_signature_method: oauth_signature_method,
    oauth_timestamp: oauth_timestamp,
    oauth_nonce: oauth_nonce,
    oauth_version: oauth_version,
    oauth_token: oauth_token,
  }
  return parameters;
}





// get auth signatures (uses parameters and follows twitter guideline)
function getEncodedOAuthSignature(parameters) {

  // Step 1: sort the parameter based on keys
  let ordered = {}
  Object.keys(parameters).sort().forEach(function(key) { ordered[key] = parameters[key]; });

  // Step 2: add the paramters in a string
  let encodedParameters = '';
  for (let k in ordered) {
    let encodedValue = escape(ordered[k]);
    let encodedKey = encodeURIComponent(k);
    if (encodedParameters === '') {
      encodedParameters += `${encodedKey}=${encodedValue}`;
    } else {
      encodedParameters += `&${encodedKey}=${encodedValue}`;
    }
  }


  // Step 3: encode the baseurl and paramter string and create a signature base string
  // structure: METHOD&URL&PARAMETERS
  let base_url = send_message_endpoint;
  let encodedUrl = encodeURIComponent(base_url);
  encodedParameters = encodeURIComponent(encodedParameters);
  let signature_base_string = `${method}&${encodedUrl}&${encodedParameters}`

  // step 4 : create a signing key with consumer secret, and token secret
  let secret_key = oauth_consumer_secret;
  let secret_token = oauth_token_secret;
  let signing_key = `${encodeURIComponent(secret_key)}&${encodeURIComponent(secret_token)}`;

  // HMAC_SHA1 encoding, with signing key and  signature
  let ouath_signature = crypto
    .createHmac('sha1', signing_key)
    .update(signature_base_string)
    .digest('base64');

  // encode oauth signature
  let encoded_oauth_signature = encodeURIComponent(ouath_signature);
  return encoded_oauth_signature;
}



// returns auth header
function getHeader(parameters) {

  // signature (calculation)
  let encoded_oauth_signature = getEncodedOAuthSignature(parameters);

  // computed header
  let header = `OAuth oauth_consumer_key="${parameters.oauth_consumer_key}",oauth_token="${parameters.oauth_token}",oauth_signature_method="HMAC-SHA1",oauth_timestamp="${parameters.oauth_timestamp}",oauth_nonce="${parameters.oauth_nonce}",oauth_version="1.0",oauth_signature="${encoded_oauth_signature}"`;
  return header;
}


// returns input (structured to send text to recipient ID)
function getInput(recipientID, text) {

  // structure according to twitter
  let input = JSON.stringify({
    event: {
      type: "message_create",
      message_create:
      {
        target: { recipient_id: recipientID },
        message_data: { text: text }
      }
    }
  });
  return input;
}




// ________________________FUNCTION FORSENDING MESSAGE__________________________________________ //

// sends ${text} to recipeintID and
const sendMessage = async (recipientID, text) => {
  // caclulated header
  let header = getHeader(getParameters())
  // calculated payload
  let body = getInput(recipientID, text);
  const headers = {
    'Authorization': header,
    'Content-Type': 'application/json'
  };

  try {
    let result = await axios.post(send_message_endpoint, body, { headers });
    console.log(result.data)
  }
  catch (error) {
    console.log(error.response.data);
    console.log("error sending data to twitter");
  }
  // return object that represents the request that was made
  return {
    send_message_endpoint,
    header,
    body,
  }
}

// ______________________CREATE OR FETCH WINNER____________________________________

// regex expression checker for twitter status URL
const isValidTweetLink = (urlString) => {
  if (!urlString) return false;
  var urlPattern = /^https?:\/\/(www.)?(mobile.)?twitter\.com\/(?:#!\/)?(\w+)\/status(es)?\/(\d+)/
  let isValidUrl = urlString.match(urlPattern);
  return isValidUrl;
}

// get tweetID from tweetLink
function getTweetID(statusLink) {
  let tweetID = "";
  let splitted = statusLink.split("/");
  for (let i = 0; i < splitted.length; i++) {
    if (splitted[i] === "status" || splitted[i] === "statuses") tweetID = splitted[i + 1];
  }
  return tweetID;
}

async function getQueriedWinnerInfo(tweetID) {

  let apiResponse = await fetch(query_winner_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      params: {
        tweetID: tweetID,
      },
    }),
  });
  let apiJsonResponse = await apiResponse.json();
  console.log(apiJsonResponse);
  return apiJsonResponse.message;
}

async function getGeneratedWinnerInfo(tweetID, requesterID) {

  let apiResponse = await fetch(generate_winner_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      params: {
        tweetID: tweetID,
        requesterID: requesterID,
      },
    }),
  });
  let apiJsonResponse = await apiResponse.json();
  console.log(apiJsonResponse);
  return apiJsonResponse.message;
}


// consumer that handles directing messages 
async function consumeEvent(event) {

  // if the event recieved has to do with direct messages, then proceed
  if (event.direct_message_events) {

    // message : the payload in case of recieved and sent message
    let message = event.direct_message_events[0].message_create;
    // if there is a payload
    // in laymen's term : if a message was recieved or sent
    if (message) {





      // initialize values we care about, with NULL
      let shouldBeSentTo = null;
      let messageWasSentTo = null;
      let messageWasSentBy = null;
      let messageContent = null;
      let URLSOfMessage = null;
      let firstURLOfMessage = null;

      // this is basically our BOT_ID
      shouldBeSentTo = event.for_user_id;

      // to whom the message was sent to
      messageWasSentTo = message.target.recipient_id;

      // who was the message sent by
      messageWasSentBy = message.sender_id;

      // what text was in the message
      messageContent = message.message_data.text;

      // all the url's attached in the message
      URLSOfMessage = message.message_data.entities.urls;

      // if there is list of URL's
      if (URLSOfMessage?.length !== 0) {
        // get the expanded version of the first URL
        firstURLOfMessage = message.message_data.entities.urls[0].expanded_url;
      }
      // determines if the bot recieved the message payload
      let recievedMessage = (shouldBeSentTo === messageWasSentTo);

      let reply = "not valid message format";

      // if bot recieved a message
      if (recievedMessage) {

        //test



        // has message text
        if (isValidTweetLink(firstURLOfMessage) && messageContent && messageContent !== "") {
          let splittedMessage = messageContent.split(" ");
          let firstWord = splittedMessage[0]?.toLowerCase();

          const tweetID = getTweetID(firstURLOfMessage);
          console.log(firstWord);
          console.log(firstURLOfMessage);
          console.log(tweetID);
          if (firstWord === "pick") {
            let messageInfo = await getGeneratedWinnerInfo(tweetID, messageWasSentBy);
            reply = `${messageInfo}`;
            await sendMessage(messageWasSentBy, reply);
          }
          else if (firstWord === "view") {
            let messageInfo = await getQueriedWinnerInfo(tweetID);
            reply = `${messageInfo}`;
            // reply to the sender from the BOT
            await sendMessage(messageWasSentBy, reply);
          }

        }
        else {
          await sendMessage(messageWasSentBy, reply);
        }

      }
      else {
        // test 
        console.log("Sent A message");
      }
    }
  }
}




// function, that starts a webhook subscription 
let startHook = async () => {



  // create autohook instance
  let webhook = new Autohook({
    consumer_key: oauth_consumer_key,
    consumer_secret: oauth_consumer_secret,
    token: oauth_token,
    token_secret: oauth_token_secret,
    env: webhook_environment,
    ngrok_secret: ngrok_secret,
  });

  try {
    await webhook.removeWebhooks();
    webhook.on('event', async (event) => await consumeEvent(event));
    await webhook.start();
    await webhook.subscribe({ oauth_token: oauth_token, oauth_token_secret: oauth_token_secret });
  }
  catch (e) {
    console.log(e);
  }
  return webhook;
}

app.get('/start', async (req, res) => {
  await startHook();
  res.send("API RUNNING");
})

app.get('/', async (req, res) => {
  res.send("API PING");
})




app.listen(port, async () => {
  await startHook();
  console.log(`Example app listening on port ${port}`)
})




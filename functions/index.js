const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
const { actionssdk } = require('actions-on-google');
const { Card } = require('dialogflow-fulfillment');
const skyApiAccount = require('./access-keys.json');



admin.initializeApp({
    credential: admin.credential.cert(serviceAccount.dev),
    databaseURL: "https://constituentsearch-xvhsfo.firebaseio.com/"
});

const { SessionsClient } = require('dialogflow');

exports.dialogflowGateway = functions.https.onRequest((request, response) => {
    cors(request, response, async () => {
        const { queryInput, sessionId } = request.body;
        const sessionClient = new SessionsClient({ credentials: serviceAccount.dev });
        const session = sessionClient.sessionPath('constituentsearch-xvhsfo', sessionId);
        const responses = await sessionClient.detectIntent({ session, queryInput });
        const result = responses[0].queryResult;

        response.send(result);
    });
});

const { WebhookClient } = require('dialogflow-fulfillment');

exports.dialogflowWebhook = functions.https.onRequest(async (request, response) => {
    let agent = new WebhookClient({ request, response });
    let searchText = request.body.queryResult.queryText;
    const subscriptionKey = skyApiAccount.dev.sky_api_subscription_key;
    const authToken = skyApiAccount.dev.sky_api_access_token;


    function buildResponse(title, address) {
        if (address !== null && address !== "") {
            return title + ". Their address is " + address + ". Their phone number is (843) 555-1234."
        }
        else {
            return title + ". Their phone number is (843) 555-1234."
        }
    }

    function constituentsearchHandler(agent) {
        let constitSearchResponse;
        let constitImageResponse;
        let title;
        let address;

        var options = {
            method: 'GET',
            url: "https://api.sky.blackbaud.com/constituent/v1/constituents/search?search_text=" + searchText,
            headers:
            {
                Authorization: authToken,
                'Bb-Api-Subscription-Key': subscriptionKey
            }
        };

        var request = require("request-promise");

        return new Promise((resolve, reject) => {
            request(options, function (error, response, body) {
                constitSearchResponse = JSON.parse(body);
                title = constitSearchResponse.value[0].name;
                address = constitSearchResponse.value[0].address;
            }).then(() => {
                options.url = "https://api.sky.blackbaud.com/constituent/v1/constituents/" + constitSearchResponse.value[0].id + "/profilepicture";
                request(options, function (error, response, body) {
                    constitImageResponse = JSON.parse(body);
                }).then(() => {
                    // Card
                    agent.add(new Card({
                        title: title,
                        imageUrl: constitImageResponse.url,
                        text: address + "\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n (555) 555-5555"
                    })
                    );

                    // Basic text response for smart speakers
                    agent.add(buildResponse(title, address));
                    resolve();
                    return;
                }).catch(err => {
                    console.log(err);
                });
                return;
            }).catch(err => {
                console.log(err);
            });
        })
    }

    // Card with button
    // agent.add(new Card({
    //     title: title,
    //     imageUrl: constitImageResponse.url,
    //     text: address + "\n\n\n\n\n (555) 555-5555",
    //     buttonText: 'Open record in app',
    //     buttonUrl: 'https://assistant.google.com/'
    // })
    // );


    let intentMap = new Map();
    intentMap.set('ConstitSearch', constituentsearchHandler);
    agent.handleRequest(intentMap);
});
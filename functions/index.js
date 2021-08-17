require('dotenv').config()
const functions = require("firebase-functions");
const fetch = require("node-fetch");

function getGeocodeUrl(address) {
    return `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=${process.env.GEOCODE_API_KEY}`
}

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.helloWorld = functions.https.onRequest((request, response) => {
    functions.logger.info("Hello logs!", { structuredData: true });
    response.send("Hello from Firebase!");
});

exports.helloWorld2 = functions.https.onRequest((request, response) => {
    functions.logger.info("Hello logs!", { structuredData: true });
    response.send("Hello from Firebase2!");
});

// Take the text parameter passed to this HTTP endpoint and insert it into 
// Firestore under the path /messages/:documentId/original
exports.addMessage = functions.https.onRequest(async(req, res) => {
    // Grab the text parameter.
    const original = req.query.text;
    // Push the new message into Firestore using the Firebase Admin SDK.
    const writeResult = await admin.firestore().collection('sites').doc('some adasddress').set({ location: new admin.firestore.GeoPoint(-32, 147) });
    // Send back a message that we've successfully written the message
    res.json({ result: `Message with ID: ${writeResult.id} added.` });
});

exports.coords = functions.region("australia-southeast1").https.onRequest(async(req, res) => {

    const searchParam = req.query.site;
    const hash = searchParam.toLowerCase().replace(/\s+/g, "").replace("/", "\\");

    // Can't have forward slash in document id!!

    var docRef = admin.firestore().collection("sites").doc(hash);

    docRef.get().then((doc) => {
        if (doc.exists) {
            const coords = doc.data().location;
            console.log("Document exists, returning: ", coords);
            res.json({ result: coords });
        } else {
            console.log(`No such document: ${searchParam} - ${hash}`);
            fetch(getGeocodeUrl(searchParam))
                .then(response => response.json())
                .then(responseJson => {
                    const coords = new admin.firestore.GeoPoint(
                        responseJson.results[0].geometry.location.lat,
                        responseJson.results[0].geometry.location.lng,
                    )
                    console.log("Fetched data:", coords);

                    console.log("Writing to Firestore");
                    admin.firestore().collection('sites').doc(hash).set({ location: coords })
                        .then(console.log("Successfully wrote new document"))
                        .catch((error) => {
                            console.log("Error writing document", error);
                        });
                    console.log("Returning coords");
                    res.json({ result: coords });
                })
                .catch((error) => {
                    console.log("Error getting site coords: ", error);
                })
        }
    }).catch((error) => {
        console.log("Error getting document: ", error);
    });
})

// Listens for new messages added to /messages/:documentId/original and creates an
// uppercase version of the message to /messages/:documentId/uppercase
exports.makeUppercase = functions.firestore.document('/messages/{documentId}')
    .onCreate((snap, context) => {
        // Grab the current value of what was written to Firestore.
        const original = snap.data().original;

        // Access the parameter `{documentId}` with `context.params`
        functions.logger.log('Uppercasing', context.params.documentId, original);

        const uppercase = original.toUpperCase();

        // You must return a Promise when performing asynchronous tasks inside a Functions such as
        // writing to Firestore.
        // Setting an 'uppercase' field in Firestore document returns a Promise.
        return snap.ref.set({ uppercase }, { merge: true });
    });
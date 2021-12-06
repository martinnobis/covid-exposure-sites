const Vic = require('./modules/vic');
const Nsw = require('./modules/nsw');

const functions = require('firebase-functions');

exports.updateAllSites = functions
  .region('australia-southeast1')
  .runWith({ timeoutSeconds: 540 })
  .pubsub.schedule('every 60 minutes')
  .onRun(async (context) => {
    Vic.updateSites();
  });

exports.updateNSWSites = functions
  .region('australia-southeast1')
  .runWith({ timeoutSeconds: 540 })
  .pubsub.schedule('every 360 minutes')
  .onRun(async (context) => {
    Nsw.updateSites();
  });

// PROD: flip lines
// exports.sites = functions.https.onCall(async (data, context) => {
exports.sites = functions.region('australia-southeast1').https.onCall(async (data, context) => {
  // context.app will be undefined if the request doesn't include a valid app Check token.
  // from: https://firebase.google.com/docs/app-check/cloud-functions?authuser=0
  if (context.app == undefined) {
    throw new https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
  }

  if (data.state === 'vic') {
    return Vic.getSites();
  } else if (data.state === 'nsw') {
    return Nsw.getSites();
  } else {
    return { error: 'Unrecognised state param' };
  }
});

// import * as Vic from './modules/vic.js';

const Vic = require("./modules/vic")

// import functions from 'firebase-functions';
// const { region, https } = functions;

const functions = require("firebase-functions");

// import admin from 'firebase-admin';
// const { initializeApp } = admin;

// const admin = require('firebase-admin');
// admin.initializeApp();

// initializeApp();

exports.updateAllSites = functions.region("australia-southeast1").runWith({ timeoutSeconds: 540 }).pubsub.schedule("every 60 minutes").onRun(async(context) => {
    Vic.updateSites();
})

exports.sites = functions.https.onCall(async(data, context) => {
    // exports.sites = functions.region("australia-southeast1").https.onCall(async(data, context) => {

    // context.app will be undefined if the request doesn't include a valid app Check token.
    // from: https://firebase.google.com/docs/app-check/cloud-functions?authuser=0
    if (context.app == undefined) {
        throw new https.HttpsError(
            "failed-precondition",
            "The function must be called from an App Check verified app.");
    }

    if (data.state === "vic") {
        return Vic.getSites();
    } else if (data.state === "nsw") {
        return {};
    } else {
        return { error: "Unrecognised state param" };
    }
})
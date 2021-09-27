// CSS
import 'bootstrap/dist/css/bootstrap.min.css';
require('../css/style.css');

import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
const { initializeAppCheck, ReCaptchaV3Provider } = require("firebase/app-check");

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyC1aoCqmyGDkkFeQf8SBqVO8OzyWS_c79c",
    authDomain: "covid-exposure-sites-322711.firebaseapp.com",
    projectId: "covid-exposure-sites-322711",
    storageBucket: "covid-exposure-sites-322711.appspot.com",
    messagingSenderId: "276780810083",
    appId: "1:276780810083:web:80818314276c32a334dd56",
    measurementId: "G-1YFWXV08HE"
};

// Initialize Firebase
let functions;
let app;
if (!app) {
    app = initializeApp(firebaseConfig);

    const appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('6LfG7DccAAAAAE6Jgk9hCoPB1egUCFVWuvUjGRxW'),

        // Optional argument. If true, the SDK automatically refreshes App Check
        // tokens as needed.
        isTokenAutoRefreshEnabled: true
    });

    // PROD: flip lines below
    // const functions = getFunctions(app, "australia-southeast1");
    functions = getFunctions(app);
}

// PROD: comment out line
connectFunctionsEmulator(functions, "localhost", 5001);

export { functions, httpsCallable }
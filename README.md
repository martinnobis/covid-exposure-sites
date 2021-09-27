# Covid-Exposure-Sites

## TODO

### Done

- [x] Collapse sites with multiple exposure events
- [x] Get exposure sites from VIC endpoint and handle pagination
- [x] Cache exposure sites in localStorage
- [x] Work on functions backend for getting site coords and updating firestore
- [x] Format distance:
- [x] Demonstrate calling Functions from the frontend the proper way
- [x] Handle public transport sites (which don't have a single address)
- [x] Handle duplicate sites and exposures from VIC data, unlikely but possible.
  - < 1km: display in m and round to nearest 10m
  - \> 1km: display in km and round to nearest 100m
- [x] Rearchitet backend to get, parse and store sites
- [x] Backend: Paginate getSites response
- [x] Frontend: Get site from paginated getSites endpoint
- [x] Add Bootstrap
- [x] Add Google Analytics
- [x] Add 'site under development' banner
- [x] Improve front end lifecyle and error handling
- [x] Populate rows with all site data
- [x] Style website
- [x] Handle not getting user pos; 1. timeout (increase timeout or ask user to reload page) 2. ask user to give permission if denied.
- [x] Privacy policy
- [x] Limit number of sites shown, perhaps only those within 10km?
- [x] Acceptable use
- [x] Productionise app (see instructions below)
- [x] Set budget for Hosting and Functions (done: can't really set a budget, only alerts)
- [x] Use separate keys for development/debugging and production (done: only needed frontend autocomplete address)
- [x] Security: restrict calls to my getSites API endpoint to only those coming from the frontend, requires onCall?
- [x] Give scroll up button a shadow
- [x] Favicon
- [x] Add quota to throttle address autocomplete calls per user per minute
- [x] Develop release build process:
- [x] Release: js minifier
- [x] Release: Remove console logs
- [x] Add disclaimer
- [x] Site title/description
- [x] Check SEO
- [x] Add ability to change position by entering an address using the Google autocomplete address widget (see commented out code)
- [x] Fix case when 0 sites are downloaded due to some bug and cache prevents sites from being downloaded even after it's been fixed. Shouldn't have to wait for cache to expire to download sites again.
- [x] Add extra badges for new sites (need Added_time_dtm for that!) and # of exposures

### General
- [ ] Handle flights
- [ ] Fix privacy policy October 2020 wording
- [ ] Handle public transport (tram route titles are really long)
- [ ] Send myself an email for backend updateAllSites() failures with Sendgrid https://firebase.google.com/docs/functions/tips#use_sendgrid_to_send_emails
- [ ] Add hyperlink to address to open Google Maps to location
- [ ] Don't display VICs/NSWs address for site, but use the one fetched from Google API (it'd be more consistent)
- [ ] Handle not finding site position gracefully and inform user, log onto firestore and update manually?

### NSW
- [ ] Do backend
- [ ] Create table in frontend, copy most of it from VIC

### Victoria
- [ ] Clean up line endings in raw site titles, addressses etc. (\t, \r, \n)
- [ ] Clean raw exposure site data some more

## Development

Start emulators (for hosting, functions and firestore):

```bash
lsof -ti tcp:8080 | xargs kill
# this command will save what's in the emulator's firestore then import it when it starts again
firebase emulators:start --import=./emulator_data --export-on-exit
```

This hosts everything locally which makes development easy.

Test a function using the shell (for use with the emulator when it's on or otherwise for production functions)

```bash
firebase functions:shell
firebase> updateAllSites() # this way I can run updateAllSites myself in production
```

## Deployment

Deploy Functions first so that I get the URLs of the endpoints to put into the frontend.

### Functions

```bash
firebase deploy --only functions

# Deploy a single function with
firebase deploy --only "functions:getSites"
```

### Hosting

```bash
npm run deploy
firebase deploy --only hosting
```

### Pub/Sub emulator

Is not supported, see documentation here: <https://firebase.google.com/docs/emulator-suite#feature-matrix>

### AppCheck

Put this at the beginning of your Functions ```onCall``` endpoint.

```js
// context.app will be undefined if the request doesn't include a valid app Check token.
// from: https://firebase.google.com/docs/app-check/cloud-functions?authuser=0
if (context.app == undefined) {
    throw new functions.https.HttpsError(
        "failed-precondition",
        "The function must be called from an App Check verified app.");
}
```

Then register your website app by going to the Firebase console > Project settings >
 App Check and generating a reCaptcha and putting in the secret
key where it asks. See documentation: https://firebase.google.com/docs/app-check/web/recaptcha-provider

Then put this in your frontend:

```js
const appCheck = firebase.appCheck();
// Pass your reCAPTCHA v3 site key (public key) to activate(). Make sure this
// key is the counterpart to the secret key you set in the Firebase console.
appCheck.activate(
    "<site token>",

    // Optional argument. If true, the SDK automatically refreshes App Check
    // tokens as needed.
    true);
```

I put my reCaptcha site and secret keys in a safe place in .env (I shouldn't have to use them again).

This will work with the emulator, but it needs more work (documentation: https://firebase.google.com/docs/app-check/web/debug-provider?authuser=0):

1. Add this line to your web app before including the app check SDK, keep it there for debug builds.

  ```html
  <script>self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;</script>
  ```

2. Go to localhost and grab the debug token from the console log, keep it secret. I put mine in .env for safekeeping.
3. Add the debug token in the App check menu in the Firebase console > Project settings menu.
4. That's it, no need to change the actual call to the Functions endpoint.

### Webpack

```bash
npm run build; ./deploy-dev-frontend.sh
```

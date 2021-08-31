# Covid-Exposure-Sites

## TODO

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
- [ ] Clean up line endings in raw site titles, addressses etc. (\t, \r, \n)
- [x] Add 'site under development' banner
- [x] Improve front end lifecyle and error handling
- [x] Populate rows with all site data
- [ ] Clean raw exposure site data
- [ ] Fix case when 0 sites are downloaded due to some bug and cache prevents sites from being downloaded even after it's been fixed. Shouldn't have to wait for cache to expire to download sites again.
- [ ] Style website
- [x] Handle not getting user pos; 1. timeout (increase timeout or ask user to reload page) 2. ask user to give permission if denied.
- [ ] Privacy policy
- [x] Limit number of sites shown, perhaps only those within 10km?
- [ ] Terms of use
- [x] Productionise app (see instructions below)
- [x] Set budget for Hosting and Functions (done: can't really set a budget, only alerts)
- [x] Use separate keys for development/debugging and production (done: only needed frontend autocomplete address)
- [ ] Security: restrict calls to my getSites API endpoint to only those coming from the frontend, requires onCall?
- [ ] Add extra badges for new sites and # of exposures
- [ ] Favicon
- [ ] Site title/description
- [ ] Check SEO
- [x] Develop release build process:
- [x] Release: js minifier
- [x] Release: Remove console logs
- [ ] Send myself an email for backend updateAllSites() failures with Sendgrid https://firebase.google.com/docs/functions/tips#use_sendgrid_to_send_emails
- [ ] Handle flights
- [ ] Handle public transport (tram route titles are really long)
- [x] Add ability to change position by entering an address using the Google autocomplete address widget (see commented out code)
- [ ] Don't display VICs address for site, but use the one fetched from Google API (it'd be more consistent)
- [ ] Add hyperlink to address to open Google Maps to location
- [ ] Handle not finding site position gracefully and inform user, currently these aren't written to Firestore at all!

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

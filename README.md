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
- [ ] Display sites with template
- [ ] Populate rows with all site data
- [ ] Clean raw exposure site data
- [ ] Style website
- [ ] Privacy policy
- [ ] Terms of use
- [ ] Productionise app
- [ ] Favicon
- [ ] Site title/description
- [ ] Check SEO
- [ ] Add a scroll to top button
- [ ] Develop release build process:
- [ ] Release: js minifier
- [ ] Release: Remove console logs
- [ ] Send myself an email for backend updateAllSites() failures with Sendgrid https://firebase.google.com/docs/functions/tips#use_sendgrid_to_send_emails
- [ ] Handle flights
- [ ] Handle public transport (tram route titles are really long)
- [ ] Add ability to change position by entering an address using the Google autocomplete address widget (see commented out code)
- [ ] Don't display VICs address for site, but use the one fetched from Google API (it'd be more consistent)
- [ ] Add hyperlink to address to open Google Maps to location
- [ ] Handle not finding site position gracefully and inform user, currently these aren't wriiten to Firestore at all!

## Development

Start emulators (for hosting, functions and firestore):

```bash
lsof -ti tcp:8080 | xargs kill
# this command will save what's in the emulator's firestore then import it when it starts again
firebase emulators:start --import=./emulator_data --export-on-exit
```

This hosts everything locally which makes development easy.

## Deployment

### When you're ready, deploy your web app

Put your static files (e.g. HTML, CSS, JS) in your app’s deploy directory (the default is 'public'). Then, run this command from your app’s root directory:

```bash
firebase deploy --only hosting:covid-exposure-sites-322711
```

### Pub/Sub emulator

Is not supported, see documentation here: <https://firebase.google.com/docs/emulator-suite#feature-matrix>

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
- [ ] Rearchitet backend to get, parse and store sites
- [ ] Rearchitect frontend to get sites from backend and display with template
- [ ] Clean raw exposure site data
- [ ] Populate rows with all site data
- [ ] Style website
- [ ] Privacy policy
- [ ] Terms of use
- [ ] Productionise app
  - Favicon
  - Site title/description
  - SEO
- [ ] Develop release build process:
  - js minifier
  - remove console logs

## Development

Start emulators (for hosting, functions and firestore):

```bash
firebase emulators:start --import=./<dir-name> --export-on-exit
# this command will save what's in the emulator's firestore then import it when it starts again
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

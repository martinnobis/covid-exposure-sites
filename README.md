# Covid-Exposure-Sites

## TODO

- [x] Collapse sites with multiple exposure events
- [x] Get exposure sites from VIC endpoint and handle pagination
- [x] Cache exposure sites in localStorage
- [x] Work on functions backend for getting site coords and updating firestore
- [ ] Clean raw exposure site data
- [ ] Populate rows with all site data
- [ ] Handle public transport sites (which don't have a single address)
- [ ] Style website
- [x] Format distance:
  - < 1km: display in m and round to nearest 10m
  - \> 1km: display in km and round to nearest 100m
- [x] Handle duplicate sites and exposures from VIC data, unlikely but possible.
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
firebase emulators:start
```

This hosts everything locally which makes development easy.

## Deployment

### When you're ready, deploy your web app

Put your static files (e.g. HTML, CSS, JS) in your app’s deploy directory (the default is 'public'). Then, run this command from your app’s root directory:

```bash
firebase deploy --only hosting:covid-exposure-sites-322711
```

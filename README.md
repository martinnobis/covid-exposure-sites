# Covid-Exposure-Sites

## TODO

- [x] Collapse sites with multiple exposure events
- [x] Get exposure sites from VIC endpoint and handle pagination
- [x] Cache exposure sites in localStorage
- [ ] Work on functions backend for getting site coords and updating firestore
- [ ] Clean raw exposure site data
- [ ] Populate rows with all site data
- [ ] Style website
- [x] Format distance:
  - < 1km: display in m and round to nearest 10m
  - \> 1km: display in km and round to nearest 100m
- [x] Handle duplicate sites and exposures from VIC data, unlikely but possible.
- [ ] Productionise app
  - Favicon
  - Site title
- [ ] Develop release build process:
  - js minifier
  - remove console logs

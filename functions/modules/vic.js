const utils = require('./utils');

const functions = require('firebase-functions');

require('dotenv').config();
const fetch = require('node-fetch');

const PAGE_SIZE = 100;

const noLocationSitesCollectionRef = utils.admin.firestore().collection('noLocationSites');
const coordsCollectionRef = utils.admin.firestore().collection('sites');
const metadataCollectionRef = utils.admin.firestore().collection('metadata');

const blueSitesCollectionRef = utils.admin.firestore().collection('blueSites');
const greenSitesCollectionRef = utils.admin.firestore().collection('greenSites');

function getGeocodeUrl(address) {
  return `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&bounds=-34.21832861798514,140.97232382930986|-38.780983886239156,147.920293027031&components=country:AU&key=${process.env.GEOCODE_API_KEY}`;
}

function getHash(rawSite) {
  let hash = rawSite.Site_title;
  if (rawSite.Site_streetaddress) {
    hash = hash.concat(rawSite.Site_streetaddress);
  }
  // Firestore document ids can't have forward slashes (backslashes are fine),
  // remove all punctuation and whitespace anyway
  return hash.toLowerCase().replace(/[^\w]/g, '');
}

function getSearchParam(rawSite) {
  let param = rawSite.Site_title;

  if (rawSite.Site_streetaddress) {
    param = param.concat(` ${rawSite.Site_streetaddress}`);
  }

  if (rawSite.Site_postcode) {
    param = param.concat(` ${rawSite.Site_postcode}`);
  }
  return encodeURI(param.replace(/&/g, '')); // Geocode API doesn't like ampersands TODO: can remove now that encodeURI is used?
}

function parseRawSite(site) {
  // Get the tier
  let tier = 'N/A';
  if (site.Advice_title) {
    // Tier is in this field, but some sites don't have this field!
    tier = /\d/.exec(site.Advice_title)[0]; // not global, so will stop at the first match
  }

  try {
    return {
      hash: getHash(site),
      title: site.Site_title,
      streetAddress: site.Site_streetaddress,
      searchParam: getSearchParam(site),
      postcode: site.Site_postcode,
      suburb: site.Suburb,
      exposures: [
        {
          dateDtm: site.Exposure_date_dtm,
          time: site.Exposure_time,
          dateAddedDtm: site.Added_date_dtm,
          tier: tier,
          notes: site.Notes,
        },
      ],
    };
  } catch (error) {
    console.error(error, site);
    throw error;
  }
}

async function fetchSites(offset, prevResponse) {
  let sitesUrl = `https://discover.data.vic.gov.au/api/3/action/datastore_search?offset=${offset}&resource_id=afb52611-6061-4a2b-9110-74c920bede77`;
  return fetch(sitesUrl)
    .then((response) => response.json())
    .then((responseJson) => {
      const response = [...prevResponse, ...responseJson.result.records]; // combine the two arrays

      offset += 100;
      if (offset < responseJson.result.total) {
        return fetchSites(offset, response);
      }
      return response;
    });
}

async function getSiteCoords(site) {
  let docRef = coordsCollectionRef.doc(site.hash);

  return docRef
    .get()
    .then((doc) => {
      if (doc.exists) {
        functions.logger.log('Coord in Firestore already:', site.title, site.streetAddress);
        return doc.data();
      } else {
        functions.logger.log('No such doc:', site.hash);

        return fetch(getGeocodeUrl(site.searchParam))
          .then((response) => response.json())
          .then((responseJson) => {
            if (responseJson.results === undefined || responseJson.results.length == 0) {
              throw new Error('Geocode API could not find coords for:', site.searchParam);
            }

            const coord = {
              location: new utils.admin.firestore.GeoPoint(
                responseJson.results[0].geometry.location.lat,
                responseJson.results[0].geometry.location.lng
              ),
            };

            functions.logger.log('Fetched coord, writing to Firestore and returning', coord);

            docRef
              .set(coord)
              .then(functions.logger.log('Successfully wrote new site coord for :', site.searchParam))
              .catch((error) => functions.logger.error('Error writing document for:', site.searchParam, error));

            return coord;
          });
      }
    })
    .catch((error) => {
      throw new Error('Error getting document:', doc, error);
    });
}

function isSamePlace(s1, s2) {
  // Remove punctuation and whitespace to prevent duplicates from unclean VIC data
  if (s1.streetAddress && s2.streetAddress) {
    return (
      s1.title.replace(/[^\w]/g, '') == s2.title.replace(/[^\w]/g, '') &&
      s1.streetAddress.replace(/[^\w]/g, '') == s2.streetAddress.replace(/[^\w]/g, '')
    );
  } else if (!s1.streetAddress && !s2.streetAddress) {
    return s1.title.replace(/[^\w]/g, '') == s2.title.replace(/[^\w]/g, '');
  } else {
    return false;
  }
}

async function getColdCollectionStr() {
  return metadataCollectionRef
    .doc('pagination')
    .get()
    .then((doc) => {
      const coldCollection = doc.data().coldCollection;
      console.log(`Returning cold collection str: ${coldCollection}`);
      return coldCollection;
    });
}

async function getHotCollectionStr() {
  return metadataCollectionRef
    .doc('pagination')
    .get()
    .then((doc) => {
      const hotCollection = doc.data().hotCollection;
      console.log(`Returning hot collection str: ${hotCollection}`);
      return hotCollection;
    });
}

async function getSites() {
  return {
    // it's happened! https://www.coronavirus.vic.gov.au/case-alerts-public-exposure-sites
    results: [],
    total: 0,
    lastUpdated: 0,
  };

  const hotCollectionStr = await getHotCollectionStr();

  let hotCollectionRef;
  if (hotCollectionStr === 'blueSites') {
    hotCollectionRef = blueSitesCollectionRef;
  } else {
    hotCollectionRef = greenSitesCollectionRef;
  }

  // Get last update success time
  const lastUpdated = await metadataCollectionRef
    .doc('lastUpdateSuccess')
    .get()
    .then((doc) => doc.data().time);

  if (!lastUpdated) {
    console.error('Could not get lastUpdated value from Firestore.');
    return { result: '500 - Internal server error.' };
  }

  const sites = await hotCollectionRef.get().then((pages) => {
    let s = [];
    pages.forEach((page) => {
      s = s.concat(page.data().sites);
    });
    return s;
  });

  const total = sites.length;

  if (!total || total <= 0) {
    // No sites!
    return {
      results: [],
      total: 0,
      lastUpdated: lastUpdated,
    };
  }

  return {
    results: sites,
    total: total,
    lastUpdated: lastUpdated,
  };
}

async function updateSites() {
  // TODO: Not quite true, this function can still fail...
  metadataCollectionRef.doc('lastUpdateSuccess').set({ time: +Date.now() });

  let sites = await fetchSites(0, []).catch((error) => {
    console.error('Could not fetch VIC sites!', error);
  });

  if (sites === undefined || sites.length == 0) {
    console.log('No VIC sites!');
    return;
  }

  sites = sites.map((s) => parseRawSite(s));
  sites = utils.foldSites(sites, isSamePlace);

  await utils.deleteCollection(noLocationSitesCollectionRef, 40);

  // Delete documents in cold collection ref
  const coldCollectionStr = await getColdCollectionStr();

  let coldCollectionRef;
  if (coldCollectionStr === 'blueSites') {
    coldCollectionRef = blueSitesCollectionRef;
  } else {
    coldCollectionRef = greenSitesCollectionRef;
  }
  await utils.deleteCollection(coldCollectionRef, 40);

  // Create new documents (pages) in it
  const numPages = Math.floor(sites.length / PAGE_SIZE);
  for (i = 0; i < numPages; i++) {
    coldCollectionRef.doc(`page${i}`).set({ sites: [] });
  }

  let counter = 0;
  for (site of sites) {
    const coord = await getSiteCoords(site).catch((error) => {
      // Don't delete hash and searchParam in this case as it's useful for debugging
      noLocationSitesCollectionRef.doc().set(site);
      functions.logger.warn('Could not get site coords', site, error);
      return null;
    });
    if (!coord) {
      continue;
    }
    site.lat = coord.location._latitude;
    site.lng = coord.location._longitude;

    // Not needed on the client side, save space and bandwidth this way
    delete site.hash;
    delete site.searchParam;
    delete site.postcode;

    const pageRef = coldCollectionRef.doc(`page${(counter + 1) % numPages}`);

    // update is from: https://firebase.google.com/docs/firestore/manage-data/add-data#update_elements_in_an_array
    pageRef.update({ sites: utils.admin.firestore.FieldValue.arrayUnion(site) });

    counter += 1;

    await utils.sleep(1000 / numPages); // time between editing the same document (page) becomes ~1s
  }

  // Flip hot and cold collections refs
  metadataCollectionRef
    .doc('pagination')
    .set({ coldCollection: await getHotCollectionStr(), hotCollection: coldCollectionStr });

  if (sites.length != counter) {
    functions.logger.error('Total sites:', sites.length);
    functions.logger.error('Sites with coords and written to Firestore', counter);
    metadataCollectionRef.doc('lastUpdateFailure').set({ time: +Date.now() });
  }
}

module.exports = {
  getSites,
  updateSites,
};

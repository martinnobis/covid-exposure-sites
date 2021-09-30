const utils = require('./utils')

const functions = require('firebase-functions');

const fetch = require("node-fetch");

const PAGE_SIZE = 100;

const metadataCollectionRef = utils.admin.firestore().collection("metadata");

const blueSitesCollectionRef = utils.admin.firestore().collection("blueSitesNSW");
const greenSitesCollectionRef = utils.admin.firestore().collection("greenSitesNSW");

async function getColdCollectionStr() {
    return metadataCollectionRef.doc("paginationNSW").get()
        .then(doc => {
            const coldCollection = doc.data().coldCollection;
            console.log(`Returning cold collection str NSW: ${coldCollection}`);
            return coldCollection;
        });
}

async function getHotCollectionStr() {
    return metadataCollectionRef.doc("paginationNSW").get()
        .then(doc => {
            const hotCollection = doc.data().hotCollection;
            console.log(`Returning hot collection str NSW: ${hotCollection}`);
            return hotCollection;
        });
}

async function fetchSites() {
    let sitesUrl = "https://data.nsw.gov.au/data/dataset/0a52e6c1-bc0b-48af-8b45-d791a6d8e289/resource/f3a28eed-8c2a-437b-8ac1-2dab3cf760f9/download/covid-case-locations.json";
    return fetch(sitesUrl)
        .then(response => response.json())
        .then(responseJson => responseJson.data.monitor);
}

async function getSites() {
    const hotCollectionStr = await getHotCollectionStr();

    let hotCollectionRef;
    if (hotCollectionStr === "blueSitesNSW") {
        hotCollectionRef = blueSitesCollectionRef;
    } else {
        hotCollectionRef = greenSitesCollectionRef;
    }

    // Get last update success time
    const lastUpdated = await metadataCollectionRef.doc("lastUpdateSuccessNSW").get()
        .then(doc => doc.data().time);

    if (!lastUpdated) {
        console.error("Could not get lastUpdatedNSW value from Firestore.")
        return { result: "500 - Internal server error." };
    }

    const sites = await hotCollectionRef.get()
        .then(pages => {
            let s = [];
            pages.forEach(page => {
                s = s.concat(page.data().sites);
            })
            return s;
        })

    const total = sites.length;

    if (!total || total <= 0) {
        // No sites!
        return {
            results: [],
            total: 0,
            lastUpdated: lastUpdated
        };
    }

    return {
        results: sites,
        total: total,
        lastUpdated: lastUpdated
    };
}

function parseRawSite(site) {

  try {
    return {
      title: site.Venue,
      streetAddress: site.Address,
      suburb: site.Suburb,
      lat: site.Lat,
      lng: site.Lon,
      exposures: [{
        date: site.Date,
        time: site.Time,
        dateAdded: site["Last updated date"],
        notes: site.Alert,
        healthAdvice: site.HealthAdviceHTML
      }]
    }
  } catch (error) {
    console.error(error, site);
    throw error;
  }
}

function samePlace(s1, s2) {
  return s1.title === s2.title && s1.streetAddress === s2.streetAddress;
}

function isDuplicateSite(s1, s2) {
    return JSON.stringify(s1) == JSON.stringify(s2);
}

function foldSites(sites) {
    if (sites === undefined || sites.length == 0) {
        return [];
    }

    let foldedSites = [sites[0]]; // add first one
    for (s1 of sites) {
        let folded = false
        let duplicate = false

        for (s2 of foldedSites) {
            if (isDuplicateSite(s1, s2)) {
                duplicate = true;
                break;
            }
            if (samePlace(s1, s2) && !isDuplicateSite(s1, s2)) {
                s2.exposures.push(...s1.exposures);
                folded = true;
                break;
            }
        }
        if (duplicate) {
            continue;
        }
        if (!folded) {
            foldedSites.push(s1);
        }
    }

    return foldedSites;
}

async function updateSites() {

    metadataCollectionRef.doc("lastUpdateSuccessNSW").set({ time: +Date.now() });

    let sites = await fetchSites()
        .catch(error => {
            console.error("Could not fetch NSW sites!", error);
        });

    if (sites === undefined || sites.length == 0) {
        console.log("No NSW sites!");
        return;
    }

    sites = sites.map(s => parseRawSite(s));
    sites = foldSites(sites);

    // Delete documents in cold collection ref
    const coldCollectionStr = await getColdCollectionStr();

    let coldCollectionRef;
    if (coldCollectionStr === "blueSitesNSW") {
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

    let counter = 0
    for (site of sites) {
        const pageRef = coldCollectionRef.doc(`page${(counter+1) % numPages}`);
        counter += 1

        // update is from: https://firebase.google.com/docs/firestore/manage-data/add-data#update_elements_in_an_array
        pageRef.update({ sites: utils.admin.firestore.FieldValue.arrayUnion(site) });

        await utils.sleep(1100 / numPages); // time between editing the same document (page) becomes ~1s
    }

    // Flip hot and cold collections refs
    metadataCollectionRef.doc("paginationNSW").set({ coldCollection: await getHotCollectionStr(), hotCollection: coldCollectionStr });
}

module.exports = { getSites, updateSites };

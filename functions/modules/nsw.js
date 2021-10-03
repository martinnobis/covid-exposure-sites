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

function shortenDay(text) {
    text = text.replace("Monday", "Mon");
    text = text.replace("Tuesday", "Tue");
    text = text.replace("Wednesday", "Wed");
    text = text.replace("Thursday", "Thu");
    text = text.replace("Friday", "Fri");
    text = text.replace("Saturday", "Sat");
    text = text.replace("Sunday", "Sun");
    return text
}

function shortenMonth(text) {
    text = text.replace("January", "Jan");
    text = text.replace("Febuary", "Feb");
    text = text.replace("March", "Mar");
    text = text.replace("April", "Apr");
    text = text.replace("May", "May");
    text = text.replace("June", "Jun");
    text = text.replace("July", "Jul");
    text = text.replace("August", "Aug");
    text = text.replace("September", "Sep");
    text = text.replace("October", "Oct");
    text = text.replace("November", "Nov");
    text = text.replace("December", "Dec");
    return text
}

function shortenYear(text) {
    text = text.replace("2021", "21");
    text = text.replace("2022", "22");
    text = text.replace("2023", "23");
    text = text.replace("2024", "24");
    text = text.replace("2025", "25");
    return text
}

function parseRawSite(site) {

    let date = shortenDay(site.Date)
    date = shortenMonth(date)
    date = shortenYear(date)

    let dateAdded = shortenDay(site["Last updated date"])
    dateAdded = shortenMonth(dateAdded)
    dateAdded = shortenYear(dateAdded)

    const strippedHealthAdvice = site.HealthAdviceHTML.replace(/<[^>]*>?/gm, ""); // remove HTML as it can't be clicked anyway in the dropdown

    try {
        return {
            title: site.Venue,
            streetAddress: site.Address,
            suburb: site.Suburb,
            lat: parseFloat(site.Lat),
            lng: parseFloat(site.Lon),
            exposures: [{
                date: date,
                time: site.Time,
                dateAdded: dateAdded,
                healthAdvice: strippedHealthAdvice
            }]
        }
    } catch (error) {
        console.error(error, site);
        throw error;
    }
}

function isSamePlace(s1, s2) {
    return s1.title === s2.title && s1.streetAddress === s2.streetAddress;
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
    sites = utils.foldSites(sites, isSamePlace);

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

        await utils.sleep(1000 / numPages); // time between editing the same document (page) becomes ~1s
    }

    // Flip hot and cold collections refs
    metadataCollectionRef.doc("paginationNSW").set({ coldCollection: await getHotCollectionStr(), hotCollection: coldCollectionStr });
}

module.exports = { getSites, updateSites };
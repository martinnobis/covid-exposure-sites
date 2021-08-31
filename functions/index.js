const functions = require("firebase-functions");

require('dotenv').config()
const fetch = require("node-fetch");

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();

const sitesCollectionRef = admin.firestore().collection("allSites");
const noLocationSitesCollectionRef = admin.firestore().collection("noLocationSites");
const coordsCollectionRef = admin.firestore().collection("sites");
const metadataCollectionRef = admin.firestore().collection("metadata");

const dateFormat = new Intl.DateTimeFormat('en-AU', { weekday: "short", year: "2-digit", month: "numeric", day: 'numeric' });

function getGeocodeUrl(address) {
    return `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&bounds=-34.21832861798514,140.97232382930986|-38.780983886239156,147.920293027031&components=country:AU&key=${process.env.GEOCODE_API_KEY}`
}

function getHash(rawSite) {
    let hash = rawSite.Site_title;
    if (rawSite.Site_streetaddress) {
        hash = hash.concat(rawSite.Site_streetaddress);
    }
    // Firestore document ids can't have forward slashes (backslashes are fine),
    // remove all punctuation and whitespace anyway
    return hash.toLowerCase().replace(/[^\w]/g, "");
}

function getSearchParam(rawSite) {
    let param = rawSite.Site_title;

    if (rawSite.Site_streetaddress) {
        param = param.concat(` ${rawSite.Site_streetaddress}`);
    }

    if (rawSite.Site_postcode) {
        param = param.concat(` ${rawSite.Site_postcode}`);
    }
    return encodeURI(param.replace(/&/g, "")); // Geocode API doesn't like ampersands TODO: can remove now that encodeURI is used?
}

function parseRawSite(site) {

    let tier = "N/A";
    if (site.Advice_title) {
        // Some sites don't have this field!
        tier = /\d/.exec(site.Advice_title)[0]; // not global, so will stop at the first match
    }

    try {
        return {
            rawId: site._id,
            hash: getHash(site),
            title: site.Site_title,
            streetAddress: site.Site_streetaddress,
            searchParam: getSearchParam(site),
            postcode: site.Site_postcode,
            suburb: site.Suburb,
            exposures: [{
                // TODO: format date and time the same way as dateAdded
                date: site.Exposure_date,
                time: site.Exposure_time,
                dateAdded: dateFormat.format(Date.parse(site.Added_date_dtm)).replace(",", ""),
                tier: tier,
                notes: site.Notes,
            }],
        }
    } catch (error) {
        console.error(error, site);
        throw error;
    }
}

async function paginatedSiteFetch(offset, prevResponse) {
    let sitesUrl = `https://discover.data.vic.gov.au/api/3/action/datastore_search?offset=${offset}&resource_id=afb52611-6061-4a2b-9110-74c920bede77`
    return fetch(sitesUrl)
        .then(response => response.json())
        .then(responseJson => {
            const response = [...prevResponse, ...responseJson.result.records]; // combine the two arrays

            offset += 100;
            if (offset < responseJson.result.total) {
                return paginatedSiteFetch(offset, response);
            }
            return response;
        });
}

async function getSiteCoords(site) {

    let docRef = coordsCollectionRef.doc(site.hash);

    return docRef.get()
        .then(doc => {
            if (doc.exists) {
                functions.logger.log("Coord in Firestore already:", site.title, site.streetAddress);
                return doc.data();
            } else {
                functions.logger.log("No such doc:", site.hash);

                return fetch(getGeocodeUrl(site.searchParam))
                    .then(response => response.json())
                    .then(responseJson => {

                        if (responseJson.results === undefined || responseJson.results.length == 0) {
                            throw new Error("Geocode API could not find coords for:", site.searchParam);
                        }

                        const coord = {
                            location: new admin.firestore.GeoPoint(
                                responseJson.results[0].geometry.location.lat,
                                responseJson.results[0].geometry.location.lng,
                            )
                        }

                        functions.logger.log("Fetched coord, writing to Firestore and returning", coord);

                        docRef.set(coord)
                            .then(functions.logger.log("Successfully wrote new site coord for :", site.searchParam))
                            .catch(error => functions.logger.error("Error writing document for:", site.searchParam, error));

                        return coord;
                    })
            }
        })
        .catch(error => {
            throw new Error("Error getting document:", doc, error);
        });
}


function samePlace(s1, s2) {
    // Remove punctuation and whitespace to prevent duplicates from unclean VIC data
    if (s1.streetAddress && s2.streetAddress) {
        return s1.title.replace(/[^\w]/g, "") == s2.title.replace(/[^\w]/g, "") &&
            s1.streetAddress.replace(/[^\w]/g, "") == s2.streetAddress.replace(/[^\w]/g, "");
    } else if (!s1.streetAddress && !s2.streetAddress) {
        return s1.title.replace(/[^\w]/g, "") == s2.title.replace(/[^\w]/g, "");
    } else {
        return false;
    }
}

function duplicateSites(s1, s2) {
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
            if (duplicateSites(s1, s2)) {
                duplicate = true;
                break;
            }
            if (samePlace(s1, s2) && !duplicateSites(s1, s2)) {
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

    // TODO: sort exposure array by date and time of exposure

    return foldedSites;
}


exports.updateAllSites = functions.region("australia-southeast1").runWith({ timeoutSeconds: 540 }).pubsub.schedule("every 60 minutes").onRun(async(context) => {

    // TODO: Not quite true, this function can still fail...
    metadataCollectionRef.doc("lastUpdateSuccess").set({ time: +Date.now() });

    let sites = await paginatedSiteFetch(0, [])
        .catch(error => {
            console.error("Could not fetch sites!", error);
        });

    if (sites === undefined || sites.length == 0) {
        metadataCollectionRef.doc("lastUpdateSuccess").set({ time: +Date.now() });
        console.log("No sites!");
        return;
    }

    sites = sites.map(s => parseRawSite(s));
    sites = foldSites(sites);

    // From https://firebase.google.com/docs/firestore/manage-data/delete-data#node.js_2
    await deleteCollection(sitesCollectionRef, 40);
    await deleteCollection(noLocationSitesCollectionRef, 40);

    let counter = 0;
    for (site of sites) {
        const coord = await getSiteCoords(site).catch(error => {
            // Don't delete hash and searchParam in this case as it's useful for debugging
            noLocationSitesCollectionRef.doc().set(site)
            functions.logger.warn("Could not get site coords", site, error);
            return null;
        });
        if (!coord) {
            continue;
        }
        site.lat = coord.location._latitude;
        site.lng = coord.location._longitude;
        site.id = counter + 1; // VIC data _id starts at 1, might as well align with that

        // Not needed on the client side, save space and bandwidth this way
        delete site.hash;
        delete site.searchParam;

        sitesCollectionRef.doc().set(site);
        counter += 1;
    }

    if (sites.length != counter) {
        functions.logger.error("Total sites:", sites.length);
        functions.logger.error("Sites with coords and written to Firestore", counter);
        metadataCollectionRef.doc("lastUpdateFailure").set({ time: +Date.now() });
        return;
    }
})

async function deleteCollection(collectionRef, batchSize) {
    const db = admin.firestore();
    const query = collectionRef.limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db, query, resolve) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        // When there are no documents left, we are done
        resolve();
        return;
    }

    // Delete documents in a batch
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    // Recurse on the next process tick, to avoid
    // exploding the stack.
    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

// PROD: flip (prod uses australia-southeast1)
// exports.sites = functions.https.onCall(async(data, context) => {
exports.sites = functions.region("australia-southeast1").https.onCall(async(data, context) => {

    // Get last update success time
    const lastUpdated = await metadataCollectionRef.doc("lastUpdateSuccess").get()
        .then(doc => doc.data().time);

    if (!lastUpdated) {
        console.error("Could not get lastUpdated value from Firestore.")
        return { result: "500 - Internal server error." };
    }

    let offset = 0;
    if (data.offset) {
        offset = parseInt(data.offset);
    }

    let limit = 100;
    if (data.limit) {
        limit = parseInt(data.limit);
    }

    if (limit < 1) {
        // No sites requested!
        return {
            results: [],
            offset: offset,
            total: 0,
            lastUpdated: lastUpdated
        };
    }

    const total = await sitesCollectionRef.get()
        .then(docs => docs.size);

    if (!total) {
        // No sites!
        return {
            results: [],
            offset: offset,
            total: 0,
            lastUpdated: 0
        };
    }

    // Start after as ids start at 1
    let sites = await sitesCollectionRef.orderBy("id").startAfter(offset).limit(limit).get();

    return {
        results: sites.docs.map(site => site.data()),
        offset: offset,
        total: total,
        lastUpdated: lastUpdated
    };
})
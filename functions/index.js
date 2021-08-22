require('dotenv').config()
const functions = require("firebase-functions");
const fetch = require("node-fetch");

function getGeocodeUrl(address) {
    return `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&bounds=-34.21832861798514,140.97232382930986|-38.780983886239156,147.920293027031&components=country:AU&key=${process.env.GEOCODE_API_KEY}`
}

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
const { parse } = require('dotenv');
admin.initializeApp();

function getHash(rawSite) {
    let hash = rawSite.Site_title;
    if (rawSite.Site_streetaddress) {
        hash = hash.concat(rawSite.Site_streetaddress);
    }
    // Firestore document ids can't have a forward slash but backslashes are fine
    return hash.toLowerCase().replace(/\s+/g, "").replace(/\//g, "\\");
}

function getSearchParam(rawSite) {
    let param = rawSite.Site_title;

    if (rawSite.Site_streetaddress) {
        param = param.concat(` ${rawSite.Site_streetaddress}`);
    }

    if (rawSite.Site_postcode) {
        param = param.concat(` ${rawSite.Site_postcode}`);
    }
    return param.replace(/&/g, ""); // Geocode API doesn't like ampersands
}

function parseRawSite(site) {
    return {
        hash: getHash(site),
        title: site.Site_title,
        streetAddress: site.Site_streetaddress,
        searchParam: getSearchParam(site),
        postcode: site.Site_postcode,
        suburb: site.Suburb,
        exposures: [{
            date: site.Exposure_date,
            time: site.Exposure_time,
            addedDate: site.Added_date,
            addedTime: site.Added_time,
            tier: /\d/.exec(site.Advice_title)[0], // not global, so will stop at the first match
            notes: site.Notes,
        }],
    }
}

async function paginatedSiteFetch(offset, prevResponse) {
    // TODO: Can turn this into a generator
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

    let docRef = admin.firestore().collection("sites").doc(site.hash);

    return docRef.get()
        .then(doc => {
            if (doc.exists) {
                const coord = doc.data();
                console.log("Coord exists in Firestore already, returning it");
                return coord;
            } else {
                console.log(`No such document: ${site.hash}`);
                fetch(getGeocodeUrl(site.searchParam))
                    .then(response => response.json())
                    .then(responseJson => {
                        if (responseJson.results === undefined || responseJson.results.length == 0) {
                            console.error(`Geocode API could not get coords for ${site.searchParam}`)
                            return {
                                location: new admin.firestore.GeoPoint(0, 0)
                            }
                        }
                        const coord = {
                            location: new admin.firestore.GeoPoint(
                                responseJson.results[0].geometry.location.lat,
                                responseJson.results[0].geometry.location.lng,
                            )
                        }
                        console.log("Fetched coord, writing to Firestore");
                        admin.firestore().collection('sites').doc(site.hash).set(coord)
                            .then(console.log("Successfully wrote new site coord"))
                            .catch((error) => {
                                console.log("Error writing document", error);
                            });
                        console.log("Returning coord");
                        return coord;
                    })
                    .catch((error) => {
                        console.log("Error getting site coords: ", error);
                    })
            }
        })
        .catch(error => {
            console.log("Error getting document: ", error);
        });
}


function samePlace(s1, s2) {
    return s1.title == s2.title && s1.streetAddress == s2.streetAddress;
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
    return foldedSites;
}

// Intended to call this function on a schedule, every 30mins or 1hr
exports.updateAllSites = functions.https.onRequest(async(_, res) => {

    let sites = await paginatedSiteFetch(0, [])
        .catch(error => res.status(500).send({ result: "Could not get sites from VIC", error: error }));

    if (sites === undefined || sites.length == 0) {
        return res.status(200).send({ result: "no sites!" })
    }

    sites = sites.map(s => parseRawSite(s));
    sites = foldSites(sites);

    // TODO: delete collection, see https://firebase.google.com/docs/firestore/manage-data/delete-data#node.js_2

    sites.forEach(site => {
        getSiteCoords(site)
            .then(coord => {
                site.lat = coord.location._latitude;
                site.lng = coord.location._longitude;
                admin.firestore().collection("allSites").doc().set(site);
            }).catch(error => {
                console.log(`Could not get site coords: ${error}`)
            })
    })

    return res.status(200).send({ result: "success" })
})

exports.scheduledFunction = functions.pubsub.schedule('every 5 minutes').onRun((context) => {
    console.log('This will be run every 5 minutes!');
    return null;
});

exports.allSites = functions.https.onRequest(async(request, response) => {
        let allSites = await admin.firestore().collection("allSites").get();
        console.log(`Returning all sites - num sites: ${allSites.docs.length}`)
        response.send(allSites.docs.map(site => site.data()));
    })
    // PROD: uncomment this line to deploy function to Australian region
    // exports.coords = functions.region("australia-southeast1").https.onRequest(async(req, res) => {
    // exports.coords = functions.https.onCall(async(data, context) => {

//     const searchParam = data.site;
//     const hash = searchParam.toLowerCase().replace(/\s+/g, "").replace("/", "\\");

//     // Can't have forward slash in document id!!

//     let docRef = admin.firestore().collection("sites").doc(hash);

//     return docRef.get().then((doc) => {
//             if (doc.exists) {
//                 const coords = doc.data().location;
//                 console.log("Document exists, returning: ", coords);
//                 return coords;
//             } else {
//                 console.log(`No such document: ${searchParam} - ${hash}`);
//                 return fetch(getGeocodeUrl(searchParam))
//                     .then(response => response.json())
//                     .then(responseJson => {
//                         const coords = new admin.firestore.GeoPoint(
//                             responseJson.results[0].geometry.location.lat,
//                             responseJson.results[0].geometry.location.lng,
//                         )
//                         console.log("Fetched data:", coords);

//                         // console.log("Writing to Firestore");
//                         // admin.firestore().collection('sites').doc(hash).set({ location: coords })
//                         //     .then(console.log("Successfully wrote new document"))
//                         //     .catch((error) => {
//                         //         console.log("Error writing document", error);
//                         //     });
//                         // console.log("Returning coords");
//                         // return coords;
//                     })
//                     .catch((error) => {
//                         console.log("Error getting site coords: ", error);
//                     })
//             }
//         })
//         .catch((error) => {
//             console.log("Error getting document: ", error);
//         });
// })

// Listens for new messages added to /messages/:documentId/original and creates an
// uppercase version of the message to /messages/:documentId/uppercase
exports.makeUppercase = functions.firestore.document('/messages/{documentId}')
    .onCreate((snap, context) => {
        // Grab the current value of what was written to Firestore.
        const original = snap.data().original;

        // Access the parameter `{documentId}` with `context.params`
        functions.logger.log('Uppercasing', context.params.documentId, original);

        const uppercase = original.toUpperCase();

        // You must return a Promise when performing asynchronous tasks inside a Functions such as
        // writing to Firestore.
        // Setting an 'uppercase' field in Firestore document returns a Promise.
        return snap.ref.set({ uppercase }, { merge: true });
    });
// PROD: Flip lines below
// let functions = firebase.app().functions("australia-southeast1")
let functions = firebase.app().functions()

// PROD: Comment out line below
firebase.functions().useEmulator("localhost", 5001);

let getCoords = functions.httpsCallable('coords');
getCoords({ site: "federation square melbourne" })
    .then((result) => {
        console.log(result);
    });

function calcDist(lat1, lng1, lat2, lng2) {
    const degsToRads = deg => (deg * Math.PI) / 180.0;
    let R = 6370.139; // (km) at lat = -37.81895485084791
    let dLat = degsToRads(lat2 - lat1);
    let dLng = degsToRads(lng2 - lng1);
    let lat1_rad = degsToRads(lat1);
    let lat2_rad = degsToRads(lat2);

    let a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1_rad) * Math.cos(lat2_rad);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function fastCalcDist(lat1, lng1, lat2, lng2) {
    const degsToRads = deg => (deg * Math.PI) / 180.0;
    let R = 6370.139; // (km) at lat = -37.81895485084791
    let dLat = degsToRads(lat2 + lat1);
    let dLng = degsToRads(lng2 - lng1);
    let lat1_rad = degsToRads(lat1);
    let lat2_rad = degsToRads(lat2);

    const x = dLng * Math.cos(0.5 * dLat)
    const y = lat2_rad - lat1_rad
    return R * Math.sqrt(x * x + y * y)
}

function fastestCalcDist(lat1, lng1, lat2, lng2) {
    // pythagoras
    return 111 * Math.sqrt(Math.pow((lat2 - lat1) * Math.cos(lat1), 2) + Math.pow(lng2 - lng1, 2));
}

function sortTable() {
    // console.log("sorting table")
    // TODO
}

function formatDist(dist_km) {
    if (dist_km < 1) {
        // display in m and round to nearest 10m
        const value = Math.round(dist_km * 100) * 10;
        return `${value}m`
    } else {
        // display in km and round to nearest 100m
        const value = dist_km.toFixed(1);
        return `${value}km`
    }
}

function getMaxTier(site) {
    const exposureWithMaxTier = site.exposures.reduce((minExp, e) => {
        if (e.tier < minExp.tier) {
            // max tier is 1
            return e;
        } else {
            return minExp;
        }
    })
    return exposureWithMaxTier.tier
}

function populateTable(sites) {
    console.log("populating table");
    let table = document.getElementById("exposure-sites").getElementsByTagName("tbody")[0];
    table.innerHTML = "";
    sites.forEach(site => {
        let row = table.insertRow();
        row.insertCell(0).innerHTML = site.formattedDist;
        row.insertCell(1).innerHTML = `${site.title} ${site.street_address}, exposures: ${site.exposures.length}`;
        row.insertCell(2).innerHTML = getMaxTier(site);
    })
}

function styleTable(userAcc) {

}

async function getUserPosition() {
    const maxAgeMins = 1; // maximum cached position age
    const timeNow = Date.now();

    // Although there is an option to set the timeout for getCurrentPosition, it
    // doesn't seem to work every time. So this function will store the user's
    // position in localStorage and manage when to update it.
    if (!window.localStorage.getItem("userPosLastUpdated") || parseInt(window.localStorage.getItem("userPosLastUpdated")) < minsToMs(maxAgeMins)) {
        console.log("getting new user position");

        const options = { enableHighAccuracy: true, timeout: 5000, maximumAge: minsToMs(maxAgeMins) }
        return new Promise((success, failure) =>
            navigator.geolocation.getCurrentPosition(pos => {
                window.localStorage.setItem("userLat", pos.coords.latitude)
                window.localStorage.setItem("userLng", pos.coords.lnggitude)
                window.localStorage.setItem("userAcc", pos.coords.accuracy);
                window.localStorage.setItem("userPosLastUpdated", +timeNow)
                success({ lat: pos.coords.latitude, lng: pos.coords.latitude, acc: pos.coords.accuracy });
            }, failure, options)
        );
    } else {
        console.log("getting stored user position");
        return {
            lat: window.localStorage.getItem("userLat"),
            lng: window.localStorage.getItem("userLng"),
            acc: window.localStorage.getItem("userAcc")
        }
    }
}

function getHash(rawSite) {
    let hash = getCoordsSearchParam(rawSite);
    // Firestore document ids can't have a forward slash but backslashes are fine
    return hash.toLowerCase().replace(/\s+/g, "").replace("/", "\\");
}

function getCoordsSearchParam(rawSite) {
    let param = rawSite.Site_title;
    if (rawSite.Site_street_address) {
        param = param.concat(` ${rawSite.Site_street_address}`)
    }
    return param;
}

function parseRawSite(site) {
    return {
        hash: getHash(rawSite),
        title: site.Site_title,
        street_address: site.Site_streetaddress,
        state: site.Site_state,
        postcode: site.Site_postcode,
        exposures: [{
            date: site.Exposure_date,
            time: site.Exposure_time,
            added_date: site.Added_date,
            added_time: site.Added_time,
            tier: /\d/.exec(site.Advice_title)[0], // not global, so will stop at the first match
            notes: site.Notes,
        }],
    }
}

function samePlace(s1, s2) {
    return s1.title == s2.title && s1.street_address == s2.street_address;
}

function duplicateSites(s1, s2) {
    return JSON.stringify(s1) == JSON.stringify(s2);
}

function foldSites(sites) {
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

let sitesUrl = offset => `https://discover.data.vic.gov.au/api/3/action/datastore_search?offset=${offset}&resource_id=afb52611-6061-4a2b-9110-74c920bede77`

function paginatedParallelFetch() {
    return fetch(sitesUrl(0))
        .then(response => response.json())
        .then(responseJson => {
            let rawSites = [responseJson.result.records]
            let offset = 100;
            while (offset < responseJson.result.total) {
                rawSites.push(
                    fetch(sitesUrl(offset))
                    .then(response => response.json())
                    .then(responseJson => responseJson.result.records))
                offset += 100;
            }

            return Promise.all(rawSites).then(rawSites => {
                return rawSites.reduce((acc, curr) => [...acc, ...curr])
            })
        })
}

function paginatedFetch(offset, prevResponse) {
    return fetch(sitesUrl(offset))
        .then(response => response.json())
        .then(responseJson => {
            const response = [...prevResponse, ...responseJson.result.records]; // combine the two arrays

            offset += 100;
            if (offset < responseJson.result.total) {
                return paginatedFetch(offset, response);
            }
            return response;
        });
}

function cacheSites(sites) {
    window.localStorage.setItem("sites", JSON.stringify(sites));
    window.localStorage.setItem("sitesLastUpdated", +Date.now())
}

const minsToMs = mins => mins * 60000;

async function getSites() {
    const maxAgeMins = 30; // maximum cached sites age

    if (!window.localStorage.getItem("sites") || parseInt(window.localStorage.getItem("sitesLastUpdated")) < minsToMs(maxAgeMins)) {
        return paginatedFetch(0, []).then(sites => sites.map(site => parseRawSite(site)));
    } else {
        return JSON.parse(window.localStorage.getItem("sites"));
    }
}

// getSites().then(sites => {
//     cacheSites(sites);
//     console.log(sites);
// })

// let mockLat = -37;
// let mockLng = 144;
// mockSiteResponse.result.records.forEach(site => {
//     window.localStorage.setItem(`${site.Site_title} ${site.Site_streetaddress}`, JSON.stringify({ lat: mockLat, lng: mockLng }));
//     mockLat += 10;
//     mockLng -= 10;
// })

// window.localStorage.setItem("home4/76langtonstreet", JSON.stringify({ lat: -37.6964587401896, lng: 144.9143448974064 }))
// window.localStorage.setItem("littlefrenchie&co342bridgeroad", JSON.stringify({ lat: -37.81895485084791, lng: 145.00274705322926 }));
// window.localStorage.setItem("gervaseavenueplaygroundcnrbeckettstreetnorthand,gervaseave", JSON.stringify({ lat: -37.69602696953057, lng: 144.91210400953273 }));

async function getSiteCoords(site) {
    const url = `http://localhost:5001/covid-exposure-sites-322711/us-central1/coords?site=${siteCoordsSearchParam(site)}`;
    const coords = window.localStorage.getItem(site.hash);
    if (!coords) {
        fetch(url)
            .then(response => response.json())
            .then(responseJson => {
                const coordsResponse = {
                    lat: responseJson.result._latitude,
                    lng: responseJson.result._longitude
                }
                window.localStorage.setItem(site.hash, JSON.stringify(coordsResponse));
                return coordsResponse;
            })
    } else {
        return JSON.parse(coords);
    }
}

navigator.geolocation.watchPosition((position) => {
    const userPos = { lat: position.coords.latitude, lng: position.coords.longitude, acc: position.coords.accuracy };
    console.log(userPos);

    getSites().then(sites => {
        cacheSites(sites);

        let sitep = []
        sites.forEach(site => {
            sitep.push(
                getSiteCoords(site).then(coords => {
                    site.dist_km = fastestCalcDist(coords.lat, coords.lng, userPos.lat, userPos.lng);
                    site.formattedDist = formatDist(site.dist_km);
                }))
        })

        Promise.all(sitep).then(() => {
            console.log(sites);
            populateTable(sites);
            // sortTable();
            // styleTable(userPos.acc); // style table based on distance and location accuracy
        })

    }).catch(error => {
        console.log("my error");
        console.log(error.message);
    });

});
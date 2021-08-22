// PROD: Flip lines below
// let functions = firebase.app().functions("australia-southeast1")
let functions = firebase.app().functions()

// PROD: Comment out line below
firebase.functions().useEmulator("localhost", 5001);

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
    } else if (dist_km > 100) {
        // prevent 4 digits
        const value = Math.round(dist_km);
        return `${value}km`
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
        let siteText = site.title;
        if (site.streetAddress) {
            siteText = siteText.concat(` ${site.streetAddress}`);
        }

        let row = table.insertRow();
        row.insertCell(0).innerHTML = site.formattedDist;
        row.insertCell(1).innerHTML = `${siteText}, exposures: ${site.exposures.length}`;
        row.insertCell(2).innerHTML = getMaxTier(site);
    })
}

function styleTable(userAcc) {

}

async function getUserPosition() {
    const maxAgeMins = 1; // maximum cached position age
    const timeNow = Date.now();

    const userPosLastUpdated = window.localStorage.getItem("userPosLastUpdated");

    // Although there is an option to set the timeout for getCurrentPosition, it
    // doesn't seem to work every time. So this function will store the user's
    // position in localStorage and manage when to update it.
    if (!userPosLastUpdated || parseInt(userPosLastUpdated) < +timeNow - minsToMs(maxAgeMins)) {
        console.log("getting new user position");

        const options = { enableHighAccuracy: true, timeout: 5000, maximumAge: minsToMs(maxAgeMins) }
        return new Promise((success, failure) =>
            navigator.geolocation.getCurrentPosition(pos => {
                window.localStorage.setItem("lat", pos.coords.latitude)
                window.localStorage.setItem("lng", pos.coords.longitude)
                window.localStorage.setItem("acc", pos.coords.accuracy);
                window.localStorage.setItem("userPosLastUpdated", +timeNow)
                success({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
            }, failure, options)
        );
    } else {
        console.log("getting stored user position");
        return {
            lat: window.localStorage.getItem("lat"),
            lng: window.localStorage.getItem("lng"),
            acc: window.localStorage.getItem("acc")
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
    const maxAgeMins = 60; // maximum cached sites age

    const timeNow = Date.now();
    const sites = window.localStorage.getItem("sites");

    if (!sites || parseInt(window.localStorage.getItem("lastUpdated")) < +timeNow - minsToMs(maxAgeMins)) {
        return fetch("http://localhost:5001/covid-exposure-sites-322711/us-central1/getSites")
            .then(response => response.json())
            .then(responseJson => {
                window.localStorage.setItem("sites", JSON.stringify(responseJson));
                window.localStorage.setItem("lastUpdated", +timeNow);
                return responseJson;
            })
    } else {
        return JSON.parse(sites);
    }
}

function setLastUpdatedMsg() {
    const lastUpdated = window.localStorage.getItem("lastUpdated");
    let lastUpdatedMsg = "Never";

    if (lastUpdated) {
        lastUpdatedMsg = new Date(+lastUpdated)
            .toLocaleString('en-AU', { hour: 'numeric', minute: 'numeric', hour12: true })
    }
    document.getElementById("lastUpdated").innerHTML = `Last updated: ${lastUpdatedMsg}`;
}

async function main() {
    const userPos = await getUserPosition();
    let sites = await getSites();
    document.getElementById("numSites").innerHTML = `Number of sites: ${sites.length}`;
    setLastUpdatedMsg();

    sites.forEach(site => {
        site.dist_km = fastCalcDist(userPos.lat, userPos.lng, site.lat, site.lng);
        site.formattedDist = formatDist(site.dist_km);
    })

    sites.sort((a, b) => a.dist_km - b.dist_km);

    console.log(userPos);
    console.log(sites.length);

    populateTable(sites);
}

main();


// sortTable();
// styleTable(userPos.acc); // style table based on distance and location accuracy
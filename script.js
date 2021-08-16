function calcDist(lat1, lon1, lat2, lon2) {
    const degsToRads = deg => (deg * Math.PI) / 180.0;
    let R = 6370.139; // (km) at lat = -37.81895485084791
    let dLat = degsToRads(lat2 - lat1);
    let dLon = degsToRads(lon2 - lon1);
    let lat1_rad = degsToRads(lat1);
    let lat2_rad = degsToRads(lat2);

    let a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1_rad) * Math.cos(lat2_rad);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function sortTable() {
    // console.log("sorting table")
    // TODO
}


function addformattedDist(site) {
    const dist_m = site.dist_km * 1000;
    if (dist_km < 1) {
        // display in m and round to nearest 10m
        site.formattedDistValue = Math.ceil(dist_m / 10) * 10;
        site.formattedDistUnit = "m"
    } else {
        site.formattedDistValue = Math.ceil(dist_m / 100) * 100;
        site.formattedDistUnit = "km"
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
        row.insertCell(0).innerHTML = site.dist_km;
        row.insertCell(1).innerHTML = `${site.title}, exposures: ${site.exposures.length}`;
        row.insertCell(2).innerHTML = getMaxTier(site);
    })
}

function styleTable(userAcc) {

}

async function fetchExposureSites() {
    console.log("fetching exposure sites");
    // let url = "https://discover.data.vic.gov.au/api/3/action/datastore_search?resource_id=afb52611-6061-4a2b-9110-74c920bede77";
    // return (await fetch(url)).json()
    // TODO: handle pagination
    return mockSiteResponse;
}

async function getUserPosition() {
    const maxAgeMins = 1; // maximum cached position age
    const timeNow = Date.now();
    const minsToMs = mins => mins * 60000;

    // Although there is an option to set the timeout for getCurrentPosition, it
    // doesn't seem to work every time. So this function will store the user's
    // position in localStorage and manage when to update it.
    if (!window.localStorage.getItem("userPosLastUpdated") || parseInt(window.localStorage.getItem("userPosLastUpdated")) < minsToMs(maxAgeMins)) {
        console.log("getting new user position");

        const options = { enableHighAccuracy: true, timeout: 5000, maximumAge: minsToMs(maxAgeMins) }
        return new Promise((success, failure) =>
            navigator.geolocation.getCurrentPosition(pos => {
                window.localStorage.setItem("userLat", pos.coords.latitude)
                window.localStorage.setItem("userLon", pos.coords.longitude)
                window.localStorage.setItem("userAcc", pos.coords.accuracy);
                window.localStorage.setItem("userPosLastUpdated", +timeNow)
                success({ lat: pos.coords.latitude, lon: pos.coords.latitude, acc: pos.coords.accuracy });
            }, failure, options)
        );
    } else {
        console.log("getting stored user position");
        return {
            lat: window.localStorage.getItem("userLat"),
            lon: window.localStorage.getItem("userLon"),
            acc: window.localStorage.getItem("userAcc")
        }
    }
}

function parseSitesResponse(sitesResponse) {
    let sites = []
    sitesResponse.result.records.forEach(site => {
        sites.push({
            hash: `${site.Site_title} ${site.Site_streetaddress}`,
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
        })
    })
    return sites;
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
                console.log("folding site")
                s2.exposures.push(...s1.exposures);
                folded = true;
                break;
            }
        }
        if (duplicate) {
            continue;
        }
        if (!folded) {
            console.log("new object, pushing")
            foldedSites.push(s1);
        }
    }
    return foldedSites;
}

function paginatedFetch(offset, prevResponse) {
    let url = offset => `https://discover.data.vic.gov.au/api/3/action/datastore_search?offset=${offset}&resource_id=afb52611-6061-4a2b-9110-74c920bede77`
    return fetch(url(offset))
        .then(response => response.json())
        .then(newResponse => {
            const response = [...prevResponse, ...newResponse.result.records]; // combine the two arrays

            if (newResponse.result.records.length !== 0) {
                offset += 100;
                return paginatedFetch(offset, response);
            }

            return response;
        });
}

console.log(paginatedFetch(0, []));

let mockLat = -37;
let mockLon = 144;
mockSiteResponse.result.records.forEach(site => {
    window.localStorage.setItem(`${site.Site_title} ${site.Site_streetaddress}`, JSON.stringify({ lat: mockLat, lon: mockLon }));
    mockLat += 10;
    mockLon -= 10;
})

window.localStorage.setItem("Home 4/76 Langton Street", JSON.stringify({ lat: -37.6964587401896, lon: 144.9143448974064 }))
window.localStorage.setItem("Little Frenchie & Co 342 Bridge Road", JSON.stringify({ lat: -37.81895485084791, lon: 145.00274705322926 }));
window.localStorage.setItem("Gervase Avenue Playground Cnr Beckett Street North and, Gervase Ave", JSON.stringify({ lat: -37.69602696953057, lon: 144.91210400953273 }));

// let p1 = fetchExposureSites().then(sitesResponse => populateTable(sitesResponse))
let p1 = fetchExposureSites().then(sitesResponse => parseSitesResponse(sitesResponse))

async function getSiteCoords(site) {
    const coords = window.localStorage.getItem(site.hash);
    if (!coords) {
        //      query my backend for the coords 
        //      create entry for site in localStorage and add coords 
    } else {
        return JSON.parse(coords);
    }
}

navigator.geolocation.watchPosition((position) => {
    const userPos = { lat: position.coords.latitude, lon: position.coords.longitude, acc: position.coords.accuracy };
    console.log(userPos);

    fetchExposureSites().then(sitesResponse => parseSitesResponse(sitesResponse)).then(sites => {

        sites = foldSites(sites);

        let sitep = []
        sites.forEach(site => {
            sitep.push(
                getSiteCoords(site).then(coords => {
                    site.dist_km = calcDist(coords.lat, coords.lon, userPos.lat, userPos.lon);
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
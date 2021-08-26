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
    // I don't think this one is accurate, it shouldn't be used
    return 111 * Math.sqrt(Math.pow((lat2 - lat1) * Math.cos(lat1), 2) + Math.pow(lng2 - lng1, 2));
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
    return parseInt(exposureWithMaxTier.tier);
}

function populateTable(sites, userPos) {
    console.log("populating table");
    let table = document.getElementById("sites").getElementsByTagName("tbody")[0];
    table.innerHTML = "";
    sites.forEach(site => {
        let siteText = site.title;
        if (site.streetAddress) {
            siteText = siteText.concat(`, ${site.streetAddress}`);
        }

        let distance = site.formattedDist;

        let distCellClasses = ["text-light", "bg-gradient"]
        if (site.dist_km * 1000 < userPos.acc) {
            distance = `<${Math.ceil(userPos.acc / 10) * 10}m`
            distCellClasses.push("bg-dark");
        } else if (site.dist_km < 0.050) {
            distCellClasses.push("bg-danger");
        } else if (site.dist_km < 0.200) {
            distCellClasses.push("bg-warning");
        } else if (site.dist_km < 1) {
            distCellClasses.push("bg-secondary");
        } else if (site.dist_km < 5) {
            distCellClasses.push("bg-primary");
        } else {
            distCellClasses = ["text-dark", "bg-transparent"];
        }

        const tier = getMaxTier(site);
        let row = table.insertRow();
        row.insertCell(0).innerHTML = distance;
        distCellClasses.forEach(c => {
            row.cells[0].classList.add(c);
        })

        let badge = ""
        if (tier === 1) {
            badge = `<span class="badge bg-danger">Tier ${tier}</span>`;
        } else if (tier === 2) {
            badge = `<span class="badge bg-warning">Tier ${tier}</span>`;
        } else {
            badge = `<span class="badge bg-secondary">Tier ${tier}</span>`;
        }

        if (site.streetAddress) {
            row.insertCell(1).innerHTML =
                `
                <div>${badge}<div class="fw-bold">${site.title}</div>${site.streetAddress}, exposures: ${site.exposures.length}</div>
            `;
        } else {
            row.insertCell(1).innerHTML =
                `
                <div>${badge}<div class="fw-bold">${site.title}</div>exposures: ${site.exposures.length}</div>
            `;

        }
    })
}

function convertToDms(dd, isLng) {
    const direction = dd < 0 ?
        isLng ? 'W' : 'S' :
        isLng ? 'E' : 'N';

    const absDd = Math.abs(dd);
    const deg = absDd | 0;
    const frac = absDd - deg;
    const min = (frac * 60) | 0;
    let sec = frac * 3600 - min * 60;
    // Round it to 2 decimal points.
    sec = Math.round(sec * 100) / 100;

    return `${deg}° ${min}' ${sec}" ${direction}`;
}

function cacheUserPosition(lat, lng, acc) {
    window.localStorage.setItem("lat", lat)
    window.localStorage.setItem("lng", lng)
    window.localStorage.setItem("acc", acc);
    window.localStorage.setItem("userPosLastCached", +Date.now())
}

async function getUserPosition() {
    const maxAgeMins = 1; // maximum cached position age
    const timeNow = Date.now();

    const userPosLastUpdated = window.localStorage.getItem("userPosLastCached");

    // Although there is an option to set the timeout for getCurrentPosition, it
    // doesn't seem to work every time. So this function will store the user's
    // position in localStorage and manage when to update it.
    if (!userPosLastUpdated || parseInt(userPosLastUpdated) < +timeNow - minsToMs(maxAgeMins)) {
        console.log("getting new user position");

        const options = { enableHighAccuracy: true, timeout: 5000, maximumAge: minsToMs(maxAgeMins) }
        return new Promise((success, failure) =>
            navigator.geolocation.getCurrentPosition(pos => {
                success({ changed: true, lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
            }, failure, options)
        );
    } else {
        console.log("getting stored user position");
        const pos = {
            changed: false,
            lat: parseFloat(window.localStorage.getItem("lat")),
            lng: parseFloat(window.localStorage.getItem("lng")),
            acc: parseFloat(window.localStorage.getItem("acc"))
        };
        return pos;
    }
}

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

async function paginatedOffsetSiteFetch(offset) {
    const sitesUrl = `
    http://localhost:5001/covid-exposure-sites-322711/us-central1/getSites?offset=${offset}`;
    return fetch(sitesUrl)
        .then(response => response.json())
        .then(responseJson => responseJson);
}

function paginatedSiteFetch(offset, prevResponse) {
    const sitesUrl = offset => `http://localhost:5001/covid-exposure-sites-322711/us-central1/getSites?offset=${offset}`
    return fetch(sitesUrl(offset))
        .then(response => response.json())
        .then(responseJson => {
            const response = [...prevResponse, ...responseJson.results]; // combine the two arrays

            offset += 100;
            if (offset < responseJson.total) {
                return paginatedSiteFetch(offset, response);
            }
            return response;
        });
}

function cacheSites(sites) {
    window.localStorage.setItem("sites", JSON.stringify(sites));
    window.localStorage.setItem("sitesLastCached", +Date.now())
}

function prettyTime(ms) {
    // Example, returns 4:52 PM
    return new Date(ms).toLocaleString('en-AU', { hour: 'numeric', minute: 'numeric', hour12: true })
}

const minsToMs = mins => mins * 60000;

function getCachedSites() {
    const maxAgeMins = 60; // maximum cached sites age

    const timeNow = Date.now();
    const sites = window.localStorage.getItem("sites");

    if (!sites || parseInt(window.localStorage.getItem("sitesLastCached")) < +timeNow - minsToMs(maxAgeMins)) {
        return null;
    } else {
        return JSON.parse(sites);
    }
}

async function getSitesParallel() {
    let sites = getCachedSites();
    if (sites) {
        return { changed: false, sites: sites };
    } else {
        // fetch first batch to get totalSites then do the rest in parallel
        return paginatedOffsetSiteFetch(0)
            .then(firstResponse => {

                let offset = 100;
                let remainingSitePs = [];

                while (offset < firstResponse.total) {
                    remainingSitePs.push(paginatedOffsetSiteFetch(offset))
                    offset += 100;
                }

                return Promise.all(remainingSitePs).then(remainingSiteResponses => {
                    // collate sites (there's probably a better way of doing this)
                    let s = firstResponse.results;
                    remainingSiteResponses.forEach(res => {
                        s = [...s, ...res.results];
                    })
                    return { changed: true, sites: s, lastUpdated: firstResponse.lastUpdated };
                })
            });
    }
}

async function main() {
    const parallelTasks = [getUserPosition(), getSitesParallel()];

    Promise.all(parallelTasks).then(values => {
        let pos = values[0];
        let sitesVal = values[1];

        if (pos.changed) {
            cacheUserPosition(pos.lat, pos.lng, pos.acc);
        }

        if (pos.changed || sitesVal.changed) {
            sitesVal.sites.forEach(site => {
                site.dist_km = fastCalcDist(pos.lat, pos.lng, site.lat, site.lng);
                site.formattedDist = formatDist(site.dist_km);
            });
        }

        if (sitesVal.changed) {
            cacheSites(sitesVal.sites);
        }

        // TODO
        const rowTemplate =
            `
                <div>
            

                </div>
            `;


        function initialize() {
            var input = document.getElementById('searchTextField');
            var autocomplete = new google.maps.places.Autocomplete(input);
            google.maps.event.addListener(autocomplete, 'place_changed', function() {
                var place = autocomplete.getPlace();
                document.getElementById('cityLat').innerHTML = place.geometry.location.lat();
                document.getElementById('cityLng').innerHTML = place.geometry.location.lng();
            });
        }
        google.maps.event.addDomListener(window, 'load', initialize);

        initialize();









        const numExposures = sitesVal.sites.reduce((a, b) => {
            return a + b.exposures.length;
        }, 0);
        document.getElementById("numExposures").innerHTML = `Number of exposures: ${numExposures}`;

        document.getElementById("userPos").innerHTML = `Your position: [${convertToDms(pos.lat, false)}, ${convertToDms(pos.lng, true)}]`;
        document.getElementById("numSites").innerHTML = `Number of sites: ${sitesVal.sites.length}`;

        console.log(sitesVal.lastUpdated);
        document.getElementById("lastUpdated").innerHTML = `Updated ${prettyTime(sitesVal.lastUpdated)} using <a href="https://www.coronavirus.vic.gov.au/exposure-sites">Victorian Department of Health</a> data.`;

        sitesVal.sites.sort((a, b) => a.dist_km - b.dist_km);
        populateTable(sitesVal.sites, pos);
    });
}

main();
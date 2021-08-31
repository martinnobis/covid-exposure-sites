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
        if (e.tier === "N/A") {
            // Some sites don't have this set!
            return minExp.tier;
        } else if (e.tier < minExp.tier) {
            // max tier is 1
            return e;
        } else {
            return minExp;
        }
    })
    return parseInt(exposureWithMaxTier.tier);
}

function populateTable(sites, userPos) {
    let table = document.getElementById("sites").getElementsByTagName("tbody")[0];

    table.innerHTML = ""; // clear table

    sites.forEach((site, index) => {

        let distCellClasses = ["distCell", "bg-gradient"]
        let distance = "";
        if (!userPos || !site.formattedDist || !site.dist_km) {
            distCellClasses = distCellClasses.concat(["text-dark", "bg-light"]);
            distance = `<span class="
            loader__dot ">?</span><span class="
            loader__dot ">?</span><span class="
            loader__dot ">?</span>`;
        } else {

            distance = site.formattedDist;

            if (site.dist_km * 1000 < userPos.acc) {
                distance = `<${Math.ceil(userPos.acc / 10) * 10}m`;
                distCellClasses = distCellClasses.concat(["text-light", "bg-dark"]);
            } else if (site.dist_km < 0.200) {
                distCellClasses = distCellClasses.concat(["text-light", "bg-danger"]);
            } else if (site.dist_km < 1) {
                distCellClasses = distCellClasses.concat(["text-light", "bg-warning"]);
            } else if (site.dist_km < 5) {
                distCellClasses = distCellClasses.concat(["text-light", "bg-secondary"]);
            } else {
                distCellClasses = distCellClasses.concat(["text-dark", "bg-light"]);
            }
        }

        let row = table.insertRow();
        row.insertCell(0).innerHTML = distance;
        distCellClasses.forEach(c => {
            row.cells[0].classList.add(c);
        })

        const tier = getMaxTier(site);
        let badge = ""
        if (tier === 1) {
            badge = `<span class="badge bg-danger">Tier ${tier}</span>`;
        } else if (tier === 2) {
            badge = `<span class="badge bg-warning">Tier ${tier}</span>`;
        } else {
            badge = `<span class="badge bg-secondary">Tier ${tier}</span>`;
        }

        let cell = row.insertCell(1);

        const exposuresHTML = site.exposures.map(exposure => {
            return `
            <tr>
                <td>${exposure.date} ${exposure.time}</td>
                <td>${exposure.dateAdded}</td>
                <td>${exposure.notes}</td>
            </tr>`;
        })

        const detail = `
            <table class="table collapse" id="collapseSite${index}">
                <thead class="text-muted">
                    <tr>
                        <th class="fw-light"><small>Exposure</small></th>
                        <th class="fw-light"><small>Added</small></th>
                        <th class="fw-light"><small>Notes</small></th>
                    </tr>
                </thead>
                <tbody>
                    ${exposuresHTML.join("")}
                </tbody>
            </table>`;

        if (site.streetAddress) {
            cell.innerHTML =
                `
                <div data-bs-toggle="collapse" href="#collapseSite${index}" role="button" aria-expanded="false" aria-controls="collapseSite">${badge}<div class="fw-bold" >${site.title}</div>${site.streetAddress}
                    ${detail}
                </div>
            `;
        } else {
            cell.innerHTML =
                `
                <div data-bs-toggle="collapse" href="#collapseSite${index}" role="button" aria-expanded="false" aria-controls="collapseSite">${badge}<div class="fw-bold">${site.title}</div>
                    ${detail}
                </div>
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

function cacheUserPosition(pos) {
    window.localStorage.setItem("lat", pos.lat)
    window.localStorage.setItem("lng", pos.lng)
    window.localStorage.setItem("acc", pos.acc);
    window.localStorage.setItem("userPosLastCached", +Date.now())
}

async function getUserPosition() {

    posToast.show();

    // start showing animated placeholder
    document.getElementById("userPos").innerHTML = `
        <p id="userPos" class="placeholder-glow fst-italic">
            <span class="placeholder placeholder-lg col-8"></span>
        </p>
    `;

    const maxAgeMins = 1; // maximum cached position age
    const timeNow = Date.now();

    const userPosLastUpdated = window.localStorage.getItem("userPosLastCached");

    // Although there is an option to set the timeout for getCurrentPosition, it
    // doesn't seem to work every time. So this function will store the user's
    // position in localStorage and manage when to update it.
    if (!userPosLastUpdated || parseInt(userPosLastUpdated) < +timeNow - minsToMs(maxAgeMins)) {
        console.log("getting new user position");

        const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: minsToMs(maxAgeMins) }
        return new Promise((success, failure) => {
            navigator.geolocation.getCurrentPosition(pos => {

                const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };

                cacheUserPosition(p);

                posToast.hide();

                // hide any previous pos errors too 
                posPermissionDeniedToast.hide();
                posUnavailableToast.hide();
                posTimeoutToast.hide();

                document.getElementById("userPos").innerHTML = `${convertToDms(p.lat, false)}, ${convertToDms(p.lng, true)}`;

                success(p);
            }, error => {

                posToast.hide();

                // show non-animated placeholder on error
                document.getElementById("userPos").innerHTML = `
                        <p class="placeholder placeholder-lg col-8"></p>
                `;

                if (error.code === 1) {
                    posPermissionDeniedToast.show();
                } else if (error.code === 2) {
                    posUnavailableToast.show();
                } else if (error.code === 3) {
                    posTimeoutToast.show();
                }
            }, options);
        });
    } else {
        console.log("getting stored user position");

        posToast.hide();

        const pos = {
            lat: parseFloat(window.localStorage.getItem("lat")),
            lng: parseFloat(window.localStorage.getItem("lng")),
            acc: parseFloat(window.localStorage.getItem("acc"))
        };

        document.getElementById("userPos").innerHTML = `${convertToDms(pos.lat, false)}, ${convertToDms(pos.lng, true)}`;

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

async function offsetSiteFetch(offset, limit) {
    // PROD: flip
    // const sitesUrl = `https://australia-southeast1-covid-exposure-sites-322711.cloudfunctions.net/getSites?offset=${offset}&limit=${limit}`;
    const sitesUrl = `http://localhost:5001/covid-exposure-sites-322711/australia-southeast1/getSites?offset=${offset}&limit=${limit}`;
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

function cacheSites(sitesVal) {
    window.localStorage.setItem("sitesVal", JSON.stringify(sitesVal));
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
    const sitesVal = window.localStorage.getItem("sitesVal");

    if (!sitesVal || parseInt(window.localStorage.getItem("sitesLastCached")) < +timeNow - minsToMs(maxAgeMins)) {
        return null;
    } else {
        return JSON.parse(sitesVal);
    }
}

async function getSites() {
    // No parallel, get all at once

    sitesToast.show();

    let sitesVal = getCachedSites();
    if (sitesVal) {

        sitesToast.hide();

        return { sites: sitesVal.results, lastUpdated: sitesVal.lastUpdated };
    } else {
        return offsetSiteFetch(0, 10000)
            .then(sitesVal => {
                cacheSites(sitesVal);
                sitesToast.hide();
                return { sites: sitesVal.results, lastUpdated: sitesVal.lastUpdated };
            });
    }
}

async function getSitesParallel(batchSize) {

    sitesToast.show();

    let sitesVal = getCachedSites();
    if (sitesVal) {
        sitesToast.hide();
        return { sites: sitesVal.sites, lastUpdated: sitesVal.lastUpdated };
    } else {
        // fetch first batch to get totalSites then do the rest in parallel
        return offsetSiteFetch(0, batchSize)
            .then(firstResponse => {

                let offset = batchSize;
                let remainingSitePs = [];

                while (offset < firstResponse.total) {
                    remainingSitePs.push(offsetSiteFetch(offset, batchSize))
                    offset += batchSize;
                }

                return Promise.all(remainingSitePs).then(remainingSiteResponses => {
                    // collate sites (there's probably a better way of doing this)
                    let s = firstResponse.results;
                    remainingSiteResponses.forEach(res => {
                        s = [...s, ...res.results];
                    })

                    sitesToast.hide();

                    return { sites: s, lastUpdated: firstResponse.lastUpdated };
                })
            })
    }
}

const posToast = new bootstrap.Toast(document.getElementById("posToast"), { autohide: false });
const sitesToast = new bootstrap.Toast(document.getElementById("sitesToast"), { autohide: false });

const posPermissionDeniedToast = new bootstrap.Toast(document.getElementById("posPermissionDeniedToast"), { autohide: false });
const posUnavailableToast = new bootstrap.Toast(document.getElementById("posUnavailableToast"), { autohide: false });
const posTimeoutToast = new bootstrap.Toast(document.getElementById("posTimeoutToast"), { autohide: false });

const useLocationBtn = document.getElementById("useLocationBtn");
const useAddressBtn = document.getElementById("useAddressBtn");

useLocationBtn.addEventListener("click", () => {
    activateUseLocationBtn();
});

useAddressBtn.addEventListener("click", () => {
    activateAddressLocationBtn();
});

function activateUseLocationBtn() {
    useLocationBtn.classList.add("shadow");
    useLocationBtn.classList.add("border-primary");
    useLocationBtn.classList.remove("border-light");
    useLocationBtn.classList.remove("opacity-50");

    useAddressBtn.classList.remove("shadow");
    useAddressBtn.classList.remove("border-primary");
    useAddressBtn.classList.add("border-light");
    useAddressBtn.classList.add("opacity-50");

    userLocBtnActive = true;
    window.localStorage.setItem("userLocBtnActive", userLocBtnActive);

    locBtnClicked();
}

useLocationBtn.addEventListener("mouseover", () => {
    useLocationBtn.classList.remove("btn-white");
    useLocationBtn.classList.add("btn-light");
})

useLocationBtn.addEventListener("mouseout", () => {
    useLocationBtn.classList.add("btn-white");
    useLocationBtn.classList.remove("btn-light");
})

function activateAddressLocationBtn() {
    // activate this one
    useAddressBtn.classList.add("shadow");
    useAddressBtn.classList.add("border-primary");
    useAddressBtn.classList.remove("border-light");
    useAddressBtn.classList.remove("opacity-50");

    // deactivate this one
    useLocationBtn.classList.remove("shadow");
    useLocationBtn.classList.remove("border-primary");
    useLocationBtn.classList.add("border-light");
    useLocationBtn.classList.add("opacity-50");

    userLocBtnActive = false;
    window.localStorage.setItem("userLocBtnActive", userLocBtnActive);

    // Remove any pos toast errors
    posPermissionDeniedToast.hide();
    posUnavailableToast.hide();
    posTimeoutToast.hide();

    locBtnClicked();
}

useAddressBtn.addEventListener("mouseover", () => {
    useAddressBtn.classList.remove("btn-white");
    useAddressBtn.classList.add("btn-light");
})

useAddressBtn.addEventListener("mouseout", () => {
    useAddressBtn.classList.add("btn-white");
    useAddressBtn.classList.remove("btn-light");
})

function initialiseAutocompleteAddress() {
    const input = document.getElementById("searchTextField");
    const autocomplete = new google.maps.places.Autocomplete(input);

    google.maps.event.addListener(autocomplete, "place_changed", () => {
        const place = autocomplete.getPlace();
        gAddressLat = place.geometry.location.lat();
        gAddressLng = place.geometry.location.lng();

        locBtnClicked();
    });
}

function getPosition() {
    if (userLocBtnActive) {
        return getUserPosition();
    } else {
        return { lat: gAddressLat, lng: gAddressLng, acc: 0 };
    }
}

async function locBtnClicked() {

    const pos = await getPosition();

    if (!pos.lat || !pos.lng) {
        return;
    }

    gSites.then(sitesVal => {
        sitesVal.sites.forEach(site => {
            site.dist_km = fastCalcDist(pos.lat, pos.lng, site.lat, site.lng);
            site.formattedDist = formatDist(site.dist_km);
        });

        sitesVal.sites.sort((a, b) => a.dist_km - b.dist_km);

        // get all sites within 10km
        let filteredSites = sitesVal.sites.filter(site => site.dist_km < 10);

        if (filteredSites.length < 20) {
            // if there are less than 20 sites within 10km, show the closest 20 instead
            filteredSites = sitesVal.sites.slice(0, 20);
        }
        populateTable(filteredSites, pos);
    });
}

// Start here

google.maps.event.addDomListener(window, "load", initialiseAutocompleteAddress);
initialiseAutocompleteAddress();

let userLocBtnActive = null;

let gAddressLat = null;
let gAddressLng = null;

// Retrieve user's last selected location setting, some may not want to use their own location ever.

const cachedUserLocBtnActive = window.localStorage.getItem("userLocBtnActive");
if (!cachedUserLocBtnActive || cachedUserLocBtnActive.toLowerCase() === "true") {
    userLocBtnActive = true;
    activateUseLocationBtn();
} else {
    userLocBtnActive = false;
    activateAddressLocationBtn();
}

let gSites = getSites()
    .then(sitesVal => {
        document.getElementById("numSites").innerHTML = `Number of sites: ${sitesVal.sites.length}`;
        document.getElementById("lastUpdated").innerHTML = `Updated ${prettyTime(sitesVal.lastUpdated)} using <a href="https://www.coronavirus.vic.gov.au/exposure-sites">Victorian Department of Health</a> data.`;

        const numExposures = sitesVal.sites.reduce((a, b) => {
            return a + b.exposures.length;
        }, 0);
        document.getElementById("numExposures").innerHTML = `Number of exposures: ${numExposures}`;

        let slicedSites = sitesVal.sites.slice(0, 20); // just show 20
        populateTable(slicedSites, null); // populate with ???

        return sitesVal;
    })
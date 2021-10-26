import * as common from './common.js'

import { Toast } from 'bootstrap';

const today = new Date();

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

function formatDist(distKm) {
    if (distKm < 1) {
        // display in m and round to nearest 10m
        const value = Math.round(distKm * 100) * 10;
        return `${value}m`
    } else if (distKm > 100) {
        // prevent 4 digits
        const value = Math.round(distKm);
        return `${value}km`
    } else {
        // display in km and round to nearest 100m
        const value = distKm.toFixed(1);
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
    let tier = parseInt(exposureWithMaxTier.tier);
    if (isNaN(tier)) {
      return "?";
    } else {
      return tier;
    }
}

function clearTable() {
    let table = document.getElementById("sites").getElementsByTagName("tbody")[0];
    table.innerHTML = "";
}

function genDistanceElements(siteDistKm, userPos) {

    let distance; // text with formatted distance value
    let cellClasses = ["text-nowrap", "distCell", "bg-gradient"]; // list of html element class that ought to be applied to the distance value

    if (!userPos || !siteDistKm) {
        distance = `<span class="loader__dot ">?</span>`;
        cellClasses = cellClasses.concat(["text-dark", "bg-light"]);
    } else {
        distance = formatDist(siteDistKm);
        if (siteDistKm * 1000 < userPos.acc) {
            distance = `<${Math.ceil(userPos.acc / 10) * 10}m`;
            cellClasses = cellClasses.concat(["text-light", "bg-dark", "distCellShadow"]);
        } else if (siteDistKm < 0.200) {
            cellClasses = cellClasses.concat(["text-light", "bg-danger", "distCellShadow"]);
        } else if (siteDistKm < 1) {
            cellClasses = cellClasses.concat(["text-light", "bg-warning", "distCellShadow"]);
        } else if (siteDistKm < 5) {
            cellClasses = cellClasses.concat(["text-light", "bg-secondary", "distCellShadow"]);
        } else {
            cellClasses = cellClasses.concat(["text-dark", "bg-light"]);
        }
    }

    return [distance, cellClasses];
}

function getTierBadgeHtml(site) {
    let tierBadge;
    if (site.state === "vic") {
        const tier = getMaxTier(site);
        if (tier === 1) {
            tierBadge = `<span class="badge bg-danger">Tier ${tier}</span>`;
        } else if (tier === 2) {
            tierBadge = `<span class="badge bg-warning">Tier ${tier}</span>`;
        } else {
            tierBadge = `<span class="badge bg-secondary">Tier ${tier}</span>`;
        }
    }
    return tierBadge;
}

function getNumExposuresBadgeHtml(site) {
    if (site.exposures.length >= 5) {
        return `<span class="badge bg-primary">5+ exposures</span>`;
    } else {
        return null;
    }
}

function getNewBadgeHtml(site) {
    const msInDay = 24 * 60 * 60 * 1000;
    let newExposure = false;

    for (const exposure of site.exposures) {
        let dateAddedUnix;
        if (site.state === "vic") {
            dateAddedUnix = Date.parse(exposure.dateAddedDtm);
        } else {
            dateAddedUnix = Date.parse(exposure.dateAdded);
        }
        const diff = (+today - +dateAddedUnix) / msInDay;
        if (diff < 2) {
            newExposure = true;
            break;
        }
    }

    if (newExposure) {
        return `<span class="badge bg-success">New</span>`;
    } else {
        return null;
    }
}

function getExposureHtmlList(site) {
    // return list of exposure HTML elements
    return site.exposures.map(exposure => {
        if (site.state === "vic") {

            const dateFormat = new Intl.DateTimeFormat('en-AU', {
                weekday: "short",
                year: "2-digit",
                month: "numeric",
                day: 'numeric'
            });

            const date = dateFormat.format(Date.parse(exposure.dateDtm)).replace(",", "");
            const dateAdded = dateFormat.format(Date.parse(exposure.dateAddedDtm)).replace(",", "");
            return `
          <tr>
              <td>${date} ${exposure.time}</td>
              <td>${dateAdded}</td>
              <td><small>${exposure.notes}</small></td>
          </tr>`;
        } else {
            // nsw
            return `
          <tr>
              <td>${exposure.date} ${exposure.time}</td>
              <td>${exposure.dateAdded}</td>
              <td><small>${exposure.healthAdvice}</small></td>
          </tr>`;
        }
    })
}

function getExposureTableHtml(state, exposuresHtmlList, index) {
    if (state === "vic") {
        // collapse class has to be in it's own separate div without any padding for the animation to work.
        return `
      <div class="collapse" id="collapseSite${index}">
          <table class="table">
              <thead class="text-muted">
                  <tr>
                      <th class="fw-light"><small>Exposure</small></th>
                      <th class="fw-light"><small>Added</small></th>
                      <th class="fw-light"><small>Notes</small></th>
                  </tr>
              </thead>
              <tbody>
                  ${exposuresHtmlList.join("")}
              </tbody>
          </table>
      </div>`;
    } else {
        // nsw
        // collapse class has to be in it's own separate div without any padding for the animation to work.
        return `
      <div class="collapse" id="collapseSite${index}">
          <table class="table">
              <thead class="text-muted">
                  <tr>
                      <th class="fw-light"><small>Exposure</small></th>
                      <th class="fw-light"><small>Added</small></th>
                      <th class="fw-light"><small>Health Advice</small></th>
                  </tr>
              </thead>
              <tbody>
                  ${exposuresHtmlList.join("")}
              </tbody>
          </table>
      </div>`;
    }
}

function getSiteAddress(site) {
    let address;
    if (site.state === "vic") {
        if (site.streetAddress) {
            // some vic sites don't have addresses as they are public transport
            address = site.streetAddress;
            if (site.suburb) {
                address = `${address}, ${site.suburb}`;
            }
        }
    } else {
        // nsw
        address = `${site.streetAddress}, ${site.suburb}`;
    }
    return `${address}, ${site.state.toUpperCase()}`;
}

function populateTable(sites, userPos) {
    clearTable();

    let table = document.getElementById("sites").getElementsByTagName("tbody")[0];

    sites.forEach((site, index) => {

        let row = table.insertRow();

        const [distance, distCellClasses] = genDistanceElements(site.distKm, userPos);

        row.insertCell(0).innerHTML = distance;
        distCellClasses.forEach(c => {
            row.cells[0].classList.add(c);
        })

        const tierBadge = getTierBadgeHtml(site) || "";
        const newBadge = getNewBadgeHtml(site) || "";
        const numExposuresBadge = getNumExposuresBadgeHtml(site) || "";
        const exposuresHtmlList = getExposureHtmlList(site);
        const detail = getExposureTableHtml(site.state, exposuresHtmlList, index);
        const address = getSiteAddress(site) || "";

        let cell = row.insertCell(1);

        cell.innerHTML = `
        <div data-bs-toggle="collapse" href="#collapseSite${index}" role="button" aria-expanded="false" aria-controls="collapseSite">
                  ${tierBadge} ${newBadge} ${numExposuresBadge} <div class="fw-bold">${site.title}</div>
                  ${address}
                  ${detail}
        </div>
              `;
    })
}

function cacheUserPosition(pos) {
    window.localStorage.setItem("lat", pos.lat)
    window.localStorage.setItem("lng", pos.lng)
    window.localStorage.setItem("userPosLastCached", +Date.now())
}

function hideAllPositionToasts() {
    posToast.hide();
    // including the error toasts
    posPermissionDeniedToast.hide();
    posUnavailableToast.hide();
    posTimeoutToast.hide();

    // and stop blinking the icon
    document.getElementById("bi-geo-alt").classList.remove("loader__dot");
}

async function getUserPosition() {

    posToast.show();

    const maxAgeMins = 1; // maximum cached position age
    const timeNow = Date.now();

    const userPosLastUpdated = window.localStorage.getItem("userPosLastCached");

    document.getElementById("bi-geo-alt").classList.add("loader__dot");

    // Although there is an option to set the timeout for getCurrentPosition, it
    // doesn't seem to work every time. So this function will store the user's
    // position in localStorage and manage when to update it.
    if (!userPosLastUpdated || parseInt(userPosLastUpdated) < +timeNow - minsToMs(maxAgeMins)) {

        const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: minsToMs(maxAgeMins) }
        return new Promise((success, failure) => {
            navigator.geolocation.getCurrentPosition(async pos => {

                hideAllPositionToasts();

                const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };

                cacheUserPosition(p);

                success(p);
            }, error => {

                hideAllPositionToasts();

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
        hideAllPositionToasts();

        return {
            lat: parseFloat(window.localStorage.getItem("lat")),
            lng: parseFloat(window.localStorage.getItem("lng")),
        };
    }
}

// TODO: could use currying here to not have to import both functions and httpsCallable
const sitesEndpoint = common.httpsCallable(common.functions, "sites");

async function fetchSites(state) {
    return sitesEndpoint({ state: state })
        .then(response => {
            return response.data;
        });
}

function prettyTime(ms) {
    // Example, returns 4:52 PM
    return new Date(ms).toLocaleString('en-AU', { hour: 'numeric', minute: 'numeric', hour12: true })
}

const minsToMs = mins => mins * 60000;

function cacheSites(state, sitesVal) {
    window.localStorage.setItem(`${state}SitesVal`, JSON.stringify(sitesVal));
    window.localStorage.setItem(`${state}SitesLastCached`, +Date.now())
}

function getCachedSites(state) {
    let maxAgeMins; // maximum cached sites age
    if (state === "nsw") {
        maxAgeMins = 6 * 60;
    } else if (state === "vic") {
        maxAgeMins = 60;
    } else {
        maxAgeMins = 90;
    }

    const timeNow = Date.now();
    const sitesVal = window.localStorage.getItem(`${state}SitesVal`);

    if (!sitesVal || parseInt(window.localStorage.getItem(`${state}SitesLastCached`)) < +timeNow - minsToMs(maxAgeMins)) {
        return null;
    } else {
        return JSON.parse(sitesVal);
    }
}

async function getSites(state) {
    // retrieve sites either from the cache or by downloading them

    const downloadingSitesToast = new Toast(document.getElementById(`${state}SitesToast`, { autohide: false }));
    downloadingSitesToast.show();

    let sitesVal = getCachedSites(state);
    if (sitesVal && sitesVal.results.length > 0) {
        // Cover case when some error occured and no sites were downloaded, don't want to wait the whole cache period to redownload sites again
        downloadingSitesToast.hide();
        return { sites: sitesVal.results, lastUpdated: sitesVal.lastUpdated };
    } else {
        return fetchSites(state)
            .then(sitesVal => {
                cacheSites(state, sitesVal);
                downloadingSitesToast.hide();
                return { sites: sitesVal.results, lastUpdated: sitesVal.lastUpdated };
            });
    }
}

const posToast = new Toast(document.getElementById("posToast"), { autohide: false });

const posPermissionDeniedToast = new Toast(document.getElementById("posPermissionDeniedToast"), { autohide: false });
const posUnavailableToast = new Toast(document.getElementById("posUnavailableToast"), { autohide: false });
const posTimeoutToast = new Toast(document.getElementById("posTimeoutToast"), { autohide: false });

const useLocationBtn = document.getElementById("useLocationBtn");
const useAddressBtn = document.getElementById("useAddressBtn");
const useRecentAddress = document.getElementById("useRecentAddress");

const nswCheckbox = document.getElementById("nswCheckbox");
const vicCheckbox = document.getElementById("vicCheckbox");

var saveUserLocModal = document.getElementById("saveUserLocModal");

useLocationBtn.addEventListener("click", () => {
    activateLocBtn(useLocationBtn);
    deactivateLocBtn(useAddressBtn);
    deactivateLocBtn(useRecentAddress); // deactivate the div
    deactivateAllRecentAddressBtns(); // deactivate any active recent address btns too

    gActiveLocBtn = "user";

    updateTable();
});

useAddressBtn.addEventListener("click", () => {
    activateLocBtn(useAddressBtn);
    deactivateLocBtn(useLocationBtn);
    deactivateLocBtn(useRecentAddress); // deactivate the div
    deactivateAllRecentAddressBtns(); // deactivate any active recent address btns too

    gActiveLocBtn = "address";

    // Remove any pos toast errors
    posPermissionDeniedToast.hide();
    posUnavailableToast.hide();
    posTimeoutToast.hide();

    updateTable();
});

function useRecentAddressClicked() {
    activateLocBtn(useRecentAddress);
    deactivateLocBtn(useLocationBtn);
    deactivateLocBtn(useAddressBtn);

    gActiveLocBtn = "recentAddress";

    // Remove any pos toast errors
    posPermissionDeniedToast.hide();
    posUnavailableToast.hide();
    posTimeoutToast.hide();

    updateTable();
};

nswCheckbox.addEventListener("change", () => {
    if (nswCheckbox.checked) {
        showState("nsw");
    } else {
        dontShowState("nsw")
        if (!vicCheckbox.checked) {
          clearShowingSitesMsg();
        }
    }
})

vicCheckbox.addEventListener("change", () => {
    if (vicCheckbox.checked) {
        showState("vic");
    } else {
        dontShowState("vic")
        if (!nswCheckbox.checked) {
          clearShowingSitesMsg();
        }
    }
})

saveUserLocModal.addEventListener("hidden.bs.modal", function (event) {
  console.log("modal closed!")
})

function showState(state, stateDownloadSitesToast) {
    window.localStorage.setItem(`show${state}`, true);
    const sites = getSites(state)
        .then(sitesVal => {
            const numExposures = sitesVal.sites.reduce((a, b) => { return a + b.exposures.length }, 0);
            addStateInfo(state, sitesVal.sites.length, numExposures, sitesVal.lastUpdated);
            updateTable();
            return sitesVal.sites;
        })

    gSites[state] = sites;

    updateTable();
}

function dontShowState(state) {
    window.localStorage.setItem(`show${state}`, false);
    removeStateInfo(state)

    delete gSites[state];

    updateTable();
}

function activateLocBtn(button) {
    button.classList.add("shadow");
    button.classList.add("border-primary");
    button.classList.remove("border-dark");
    button.classList.remove("opacity-50");
    button.querySelector("h5").classList.add("text-primary");
}

function deactivateLocBtn(button) {
    button.classList.remove("shadow");
    button.classList.remove("border-primary");
    button.querySelector("h5").classList.remove("text-primary");
    button.classList.add("border-dark");
    button.classList.add("opacity-50");
}

// stores:
//      address string; used to get the lat/lng when selecting this recent address
//      button element; used to activate/deactivate which just involves styling
let gRecentAddressElements = [];


function activateRecentAddressBtn(addressBtn) {
    addressBtn.classList.add("text-primary");
    addressBtn.classList.add("border-primary");
}

function deactivateRecentAddressBtn(addressBtn) {
    addressBtn.classList.remove("text-primary");
    addressBtn.classList.remove("border-primary");
}

function deactivateAllRecentAddressBtns() {
    gRecentAddressElements.forEach(a => deactivateRecentAddressBtn(a.button));
}

function addAddressToRecentWidget(address) {
    const hash = address.toLowerCase().replace(/[^\w\d]/g, ""); // just something concise to use

    let recentAddresses = document.getElementById("recentAddresses");

    const template = document.getElementById("recentAddressTemplate");
    const clone = template.content.cloneNode(true);

    let clonedElement = clone.querySelector("div"); // get it's first element which is a div

    clonedElement.id = hash;
    let addressBtn = clonedElement.firstElementChild;
    let closeBtn = clonedElement.lastElementChild;

    gRecentAddressElements.push({ address: address, button: addressBtn });

    addressBtn.textContent = address;

    // add to DOM
    recentAddresses.prepend(clone);

    removeNoRecentAddressesMsg();

    closeBtn.addEventListener("click", () => {
        // remove element from DOM
        document.getElementById(hash).remove();

        // remove address from global var
        gRecentAddressElements = gRecentAddressElements.filter(e => e.address !== address);

        // remove address from cache
        deCacheAddress(address);

        // add the no recent address message if required
        addNoRecentAddressesMsg();
    })

    addressBtn.addEventListener("click", () => {

        // set the global lat/lng values when using recent addresses
        setgRecentAddressPosFromRecentAddress(address);

        // disable all recent address elements
        deactivateAllRecentAddressBtns();

        // activate this one
        activateRecentAddressBtn(addressBtn);

        useRecentAddressClicked(); // previously handled by a clicked event on the div

        // note that activating the useRecentAddress div is already handled as it's the parent of an recentAddressBtn
    })
}

function setgRecentAddressPosFromRecentAddress(address) {
    let addressesStr = window.localStorage.getItem("recentAddresses");

    // Find address in cache, get pos and then set the gRecentAddress* vars
    if (!addressesStr) {
        // this should never happen
        console.error(`Could not find cached data for recent address: ${address}`);
        return;
    } else {
        const foundAddress = JSON.parse(addressesStr).find(e => e.address === address);
        gRecentAddressLat = foundAddress.lat;
        gRecentAddressLng = foundAddress.lng;

        updateTable();
    }
}

function addNoRecentAddressesMsg() {
    const noRecentAddressStr = `
        <p id="noRecentAddressMsg" class="fst-italic pt-2" style="font-size: .90em">No recent addresses</p>
    `;

    const recentAddressesStr = window.localStorage.getItem("recentAddresses");
    if (!recentAddressesStr || JSON.parse(recentAddressesStr).length <= 0) {
        // TODO: change to checking whether or not the div with id=recentAddresses has children
        document.getElementById("recentAddresses").innerHTML = noRecentAddressStr;
    }
}

function removeNoRecentAddressesMsg() {
    let element = document.getElementById("noRecentAddressMsg");
    element && element.remove();
}

function cacheAddress(address, lat, lng) {
    let addresses = window.localStorage.getItem("recentAddresses");

    if (!addresses) {
        // first address, add it
        window.localStorage.setItem("recentAddresses", JSON.stringify([{ address: address, lat: lat, lng: lng }]));
    } else {
        // append to existing array and re set it
        let temp = JSON.parse(addresses);
        temp.push({ address: address, lat: lat, lng: lng });
        window.localStorage.setItem("recentAddresses", JSON.stringify(temp));
    }
}

function deCacheAddress(address) {
    // remove address from cache
    let addressesStr = window.localStorage.getItem("recentAddresses");

    if (addressesStr) {
        const addresses = JSON.parse(addressesStr);
        const filteredAddresses = addresses.filter(a => a.address !== address);
        window.localStorage.setItem("recentAddresses", JSON.stringify(filteredAddresses));
    }
}

function initialiseAutocompleteAddress() {
    const input = document.getElementById("searchTextField");
    const victoriaBounds = new google.maps.LatLngBounds(
        // expected to be sw and ne corners: https://developers.google.com/maps/documentation/javascript/reference/coordinates#LatLngBounds
        new google.maps.LatLng(-38.7017, 141.1483),
        new google.maps.LatLng(-35.6718, 149.1826)
    );
    const options = {
        componentRestrictions: { country: "au" },
        bounds: victoriaBounds,
        fields: ["geometry.location"],
    };
    const autocomplete = new google.maps.places.Autocomplete(input, options);

    google.maps.event.addListener(autocomplete, "place_changed", () => {
        const place = autocomplete.getPlace();
        gAddressLat = place.geometry.location.lat();
        gAddressLng = place.geometry.location.lng();

        const address = input.value.replace(", Australia", "");
        cacheAddress(address, gAddressLat, gAddressLng);
        addAddressToRecentWidget(address);

        updateTable();
    });
}

let gActiveLocBtn;

function getPosition() {
    // get position either from geolocation or address
    if (gActiveLocBtn === "user") {
        return getUserPosition();
    } else if (gActiveLocBtn === "address") {
        return { lat: gAddressLat, lng: gAddressLng, acc: 0 };
    } else {
        // gActiveLocBtn === "recentAddress"
        return { lat: gRecentAddressLat, lng: gRecentAddressLng, acc: 0 };
    }
}

function setShowingSitesMsg(msg) {
    let showingSitesElement = document.getElementById("showingSites");
    showingSites.innerHTML = msg;
}

function clearShowingSitesMsg(msg) {
    let showingSitesElement = document.getElementById("showingSites");
    showingSites.innerHTML = "";
}

async function updateTable() {
    // One of the 3 buttons at the top was pressed, trigger recalculation of distances etc.

    let totalSites = [];
    for (const state in gSites) {
        let sites = await gSites[state]; // recall that this is still a promise

        sites = sites.map(s => {
            s.state = state;
            return s;
        }); // add the state parameter now

        totalSites = totalSites.concat(sites);
    }

    const pos = await getPosition(); // from geolocation or address
    if (!pos.lat || !pos.lng) {
        populateTable(totalSites.slice(0, 20), null); // fills with ?
        return;
    }

    if (totalSites && totalSites.length > 0) {

        totalSites.forEach(site => {
            site.distKm = calcDist(pos.lat, pos.lng, site.lat, site.lng);
        });

        totalSites.sort((a, b) => a.distKm - b.distKm);

        // get all sites within 10km
        let filteredSites = totalSites.filter(site => site.distKm < 10);
        let numExposures = filteredSites.reduce((a, b) => { return a + b.exposures.length }, 0);


        if (filteredSites.length < 20) {
            // if there are less than 20 sites within 10km, show the closest 20 instead
            filteredSites = totalSites.slice(0, 20);

            numExposures = filteredSites.reduce((a, b) => { return a + b.exposures.length }, 0);
            setShowingSitesMsg(`Showing the closest <span class="fs-5">${filteredSites.length}</span> sites with <span class="fs-5">${numExposures}</span> exposures`);
        } else {
            setShowingSitesMsg(`Showing <span class="fs-5">${filteredSites.length}</span> sites with <span class="fs-5">${numExposures}</span> exposures within 10km`);
        }

        populateTable(filteredSites, pos);
    } else {
        let table = document.getElementById("sites").getElementsByTagName("tbody")[0];
        table.innerHTML = "";
    }
}

function restoreRecentAddressesFromCache() {
    const addressesStr = window.localStorage.getItem("recentAddresses");

    if (addressesStr) {
        const addresses = JSON.parse(addressesStr);
        addresses.forEach(a => addAddressToRecentWidget(a.address));
    }
}

// Start here

// google.maps.event.addDomListener(window, "load", initialiseAutocompleteAddress); // used for autocomplete address widget
// initialiseAutocompleteAddress();

restoreRecentAddressesFromCache();
addNoRecentAddressesMsg(); // will add if required

let gAddressLat;
let gAddressLng;
let gRecentAddressLat;
let gRecentAddressLng;

let gNswSites;
let gVicSites;


// global object with the format:
// {"vic": [...], "nsw": [...]}
let gSites = {};

// check cache for checkbox state
const showNsw = window.localStorage.getItem("shownsw");

if (!showNsw) {
    // hasn't been cached before, first time user, turn checkbox on
    nswCheckbox.checked = true;
    showState("nsw");
} else {
    // has been set in cache, retreive it
    const showNswVal = JSON.parse(showNsw);
    if (showNswVal) {
        nswCheckbox.checked = true;
        showState("nsw");
    } else {
        // don't do anything
    }
}

const showVic = window.localStorage.getItem("showvic");

if (!showVic) {
    // hasn't been cached before, first time user, turn checkbox on
    vicCheckbox.checked = true;
    showState("vic");
} else {
    // has been set in cache, retreive it
    const showVicVal = JSON.parse(showVic);
    if (showVicVal) {
        vicCheckbox.checked = true;
        showState("vic");
    }
}

function addStateInfo(state, numSites, numExposures, lastUpdated) {
    let stateFullName;
    let lastUpdatedMsg;

    if (state === "nsw") {
        stateFullName = "New South Wales";
        lastUpdatedMsg = `<p class="m-1" id="${state}LastUpdated"><small>Updated ${prettyTime(lastUpdated)} using <a href="https://www.health.nsw.gov.au/Infectious/covid-19/Pages/case-locations-and-alerts.aspx" target="_blank">NSW Health</a> data.</small></p>`;
    } else if (state === "vic") {
        stateFullName = "Victoria";
        lastUpdatedMsg = `<p class="m-1" id="${state}LastUpdated"><small>Updated ${prettyTime(lastUpdated)} using <a href="https://www.coronavirus.vic.gov.au/exposure-sites" target="_blank">Victorian Department of Health</a> data.</small></p>`;
    }

    const info = `
     <div class="rounded shadow p-3"
       <h5>${stateFullName}</h5>
       <p class="m-1" id="${state}NumSites"><span class="fs-5">${numSites}</span> total sites</p>
       <p class="m-1" id="${state}NumExposures"><span class="fs-5">${numExposures}</span> total exposures</p>
       ${lastUpdatedMsg}
     </div>
  `;

    let infoDiv = document.createElement("div");
    infoDiv.setAttribute("id", `${state}Info`)
    infoDiv.setAttribute("class", "col-sm")
    infoDiv.innerHTML = info;

    document.getElementById("stateInfo").appendChild(infoDiv);
}

function removeStateInfo(state) {
    document.getElementById(`${state}Info`).remove();
}



// Set up back to top button

// let backToTopBtn = document.getElementById("backToTopBtn");


// When the user scrolls down some amount of px from the top of the document, show the button
// window.onscroll = () => {
// if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
// TODO: add it to the DOM instead of just making it appear
// backToTopBtn.classList.add("load");
//  } else {
// backToTopBtn.classList.remove("load");
// }
// };

// When the user clicks on the button scroll to the top of the document
// backToTopBtn.addEventListener("click", () => {
//     document.body.scrollTop = 0;
//     document.documentElement.scrollTop = 0;
// });

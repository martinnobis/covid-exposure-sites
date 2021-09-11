// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
const { initializeAppCheck, ReCaptchaV3Provider } = require("firebase/app-check");

import { Toast } from 'bootstrap';

// bootstrap is imported in entry point

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyC1aoCqmyGDkkFeQf8SBqVO8OzyWS_c79c",
    authDomain: "covid-exposure-sites-322711.firebaseapp.com",
    projectId: "covid-exposure-sites-322711",
    storageBucket: "covid-exposure-sites-322711.appspot.com",
    messagingSenderId: "276780810083",
    appId: "1:276780810083:web:80818314276c32a334dd56",
    measurementId: "G-1YFWXV08HE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LfG7DccAAAAAE6Jgk9hCoPB1egUCFVWuvUjGRxW'),

    // Optional argument. If true, the SDK automatically refreshes App Check
    // tokens as needed.
    isTokenAutoRefreshEnabled: true
});

// PROD: flip lines below
const functions = getFunctions(app, "australia-southeast1");
// const functions = getFunctions(app);

// PROD: comment out line
// connectFunctionsEmulator(functions, "localhost", 5001);

const today = new Date();
const msInDay = 24 * 60 * 60 * 1000;

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

    const dateFormat = new Intl.DateTimeFormat('en-AU', {
        weekday: "short",
        year: "2-digit",
        month: "numeric",
        day: 'numeric'
    });

    table.innerHTML = ""; // clear table

    sites.forEach((site, index) => {

        let distCellClasses = ["text-nowrap", "distCell", "bg-gradient"]
        let distance;
        if (!userPos || !site.formattedDist || !site.dist_km) {
            distCellClasses = distCellClasses.concat(["text-dark", "bg-light"]);
            distance = `<span class="loader__dot ">?</span>`;
        } else {

            distance = site.formattedDist;

            if (site.dist_km * 1000 < userPos.acc) {
                distance = `<${Math.ceil(userPos.acc / 10) * 10}m`;
                distCellClasses = distCellClasses.concat(["text-light", "bg-dark", "distCellShadow"]);
            } else if (site.dist_km < 0.200) {
                distCellClasses = distCellClasses.concat(["text-light", "bg-danger", "distCellShadow"]);
            } else if (site.dist_km < 1) {
                distCellClasses = distCellClasses.concat(["text-light", "bg-warning", "distCellShadow"]);
            } else if (site.dist_km < 5) {
                distCellClasses = distCellClasses.concat(["text-light", "bg-secondary", "distCellShadow"]);
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
        let tierBadge = "";
        if (tier === 1) {
            tierBadge = `<span class="badge bg-danger">Tier ${tier}</span>`;
        } else if (tier === 2) {
            tierBadge = `<span class="badge bg-warning">Tier ${tier}</span>`;
        } else {
            tierBadge = `<span class="badge bg-secondary">Tier ${tier}</span>`;
        }

        let numExposuresBadge = "";
        if (site.exposures.length >= 5) {
            numExposuresBadge = `<span class="badge bg-primary">5+ exposures</span>`;
        }

        let newExposure = false;
        const exposuresHTML = site.exposures.map(exposure => {
            const date = dateFormat.format(Date.parse(exposure.dateDtm)).replace(",", "");
            const dateAdded = dateFormat.format(Date.parse(exposure.dateAddedDtm)).replace(",", "");

            const dd = Date.parse(exposure.dateAddedDtm);
            const diff = (+today - +dd) / msInDay
            if (diff < 2) {
                newExposure = true;
            }

            return `
            <tr>
                <td>${date} ${exposure.time}</td>
                <td>${dateAdded}</td>
                <td>${exposure.notes}</td>
            </tr>`;
        })

        let newBadge = "";
        if (newExposure) {
            newBadge = `<span class="badge bg-success">New</span>`;
        }

        // collapse class has to be in it's own separate div without any
        // padding for the animation to work.
        const detail = `
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
                    ${exposuresHTML.join("")}
                </tbody>
            </table>
        </div>`;

        let cell = row.insertCell(1);
        if (site.streetAddress) {
            let address = site.streetAddress;
            if (site.suburb) {
                address = address.concat(`, ${site.suburb}`);
            }
            cell.innerHTML = `
                <div data-bs-toggle="collapse" href="#collapseSite${index}" role="button" aria-expanded="false" aria-controls="collapseSite">
                    ${tierBadge} ${newBadge} ${numExposuresBadge} <div class="fw-bold">${site.title}</div>
                    ${address}
                    ${detail}
                </div>
            `;
        } else {
            cell.innerHTML =
                `
                <div data-bs-toggle="collapse" href="#collapseSite${index}" role="button" aria-expanded="false" aria-controls="collapseSite">
                    ${tierBadge} ${newBadge} ${numExposuresBadge} <div class="fw-bold">${site.title}</div>
                    ${detail}
                </div>
            `;
        }
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

const sitesEndpoint = httpsCallable(functions, "sites");

async function fetchSites() {
    return sitesEndpoint()
        .then(response => {
            return response.data;
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
    const maxAgeMins = 65; // maximum cached sites age

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
    if (sitesVal && sitesVal.results.length > 0) {
        // Cover case when some error occured and no sites were downloaded, don't want to wait the whole cache period to redownload sites again
        sitesToast.hide();
        return { sites: sitesVal.results, lastUpdated: sitesVal.lastUpdated };
    } else {
        return fetchSites()
            .then(sitesVal => {
                cacheSites(sitesVal);
                sitesToast.hide();
                return { sites: sitesVal.results, lastUpdated: sitesVal.lastUpdated };
            });
    }
}

const posToast = new Toast(document.getElementById("posToast"), { autohide: false });
const sitesToast = new Toast(document.getElementById("sitesToast"), { autohide: false });

const posPermissionDeniedToast = new Toast(document.getElementById("posPermissionDeniedToast"), { autohide: false });
const posUnavailableToast = new Toast(document.getElementById("posUnavailableToast"), { autohide: false });
const posTimeoutToast = new Toast(document.getElementById("posTimeoutToast"), { autohide: false });

const useLocationBtn = document.getElementById("useLocationBtn");
const useAddressBtn = document.getElementById("useAddressBtn");
const useRecentAddress = document.getElementById("useRecentAddress");

useLocationBtn.addEventListener("click", () => {
    activateLocBtn(useLocationBtn);
    deactivateLocBtn(useAddressBtn);
    deactivateLocBtn(useRecentAddress); // deactivate the div
    deactivateAllRecentAddressBtns(); // deactivate any active recent address btns too

    gActiveLocBtn = "user";

    locBtnClicked();
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

    locBtnClicked();
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

    locBtnClicked();
};

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

        locBtnClicked();
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

        locBtnClicked();
    });
}

let gActiveLocBtn;

function getPosition() {
    if (gActiveLocBtn === "user") {
        return getUserPosition();
    } else if (gActiveLocBtn === "address") {
        return { lat: gAddressLat, lng: gAddressLng, acc: 0 };
    } else {
        // gActiveLocBtn === "recentAddress"
        return { lat: gRecentAddressLat, lng: gRecentAddressLng, acc: 0 };
    }
}

async function locBtnClicked() {

    const pos = await getPosition();

    if (!pos.lat || !pos.lng) {
        return;
    }

    gSites.then(sitesVal => {
        sitesVal.sites.forEach(site => {
            site.dist_km = calcDist(pos.lat, pos.lng, site.lat, site.lng);
            site.formattedDist = formatDist(site.dist_km);
        });

        sitesVal.sites.sort((a, b) => a.dist_km - b.dist_km);

        // get all sites within 10km
        let filteredSites = sitesVal.sites.filter(site => site.dist_km < 10);
        let numExposures = filteredSites.reduce((a, b) => { return a + b.exposures.length }, 0);

        let showingSitesElement = document.getElementById("showingSites");

        if (filteredSites.length < 20) {
            // if there are less than 20 sites within 10km, show the closest 20 instead
            filteredSites = sitesVal.sites.slice(0, 20);
            numExposures = filteredSites.reduce((a, b) => { return a + b.exposures.length }, 0);
            showingSitesElement.innerHTML = `Showing the closest <span class="fs-5">${filteredSites.length}</span> sites with <span class="fs-5">${numExposures}</span> exposures`;
        } else {
            showingSitesElement.innerHTML = `Showing <span class="fs-5">${filteredSites.length}</span> sites with <span class="fs-5">${numExposures}</span> exposures within 10km`;
        }

        populateTable(filteredSites, pos);
    });
}

function restoreRecentAddressesFromCache() {
    const addressesStr = window.localStorage.getItem("recentAddresses");

    if (addressesStr) {
        const addresses = JSON.parse(addressesStr);
        addresses.forEach(a => addAddressToRecentWidget(a.address));
    }
}

// Start here

google.maps.event.addDomListener(window, "load", initialiseAutocompleteAddress); // used for autocomplete address widget
initialiseAutocompleteAddress();

restoreRecentAddressesFromCache();
addNoRecentAddressesMsg(); // will add if required

let gAddressLat;
let gAddressLng;
let gRecentAddressLat;
let gRecentAddressLng;

let gSites = getSites()
    .then(sitesVal => {
        document.getElementById("numSites").innerHTML = `<span class="fs-5">${sitesVal.sites.length}</span> total sites`;
        document.getElementById("lastUpdated").innerHTML = `Updated ${prettyTime(sitesVal.lastUpdated)} using <a href="https://www.coronavirus.vic.gov.au/exposure-sites">Victorian Department of Health</a> data.`;

        const numExposures = sitesVal.sites.reduce((a, b) => { return a + b.exposures.length }, 0);
        document.getElementById("numExposures").innerHTML = `<span class="fs-5">${numExposures}</span> total exposures`;

        let slicedSites = sitesVal.sites.slice(0, 20); // just show 20
        populateTable(slicedSites, null); // populate with ???

        return sitesVal;
    })

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

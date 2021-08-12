var locationOptions = {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0
}

function locationSuccess(pos) {
    var crd = pos.coords;

    console.log("Current position:");
    console.log(`Latitude: ${crd.latitude}`);
    console.log(`Longitude: ${crd.longitude}`);
    console.log(`More or less  ${crd.accuracy} meters`);

    sortTable(crd.latitude, crd.longitude)
}

function locationError(err) {
    console.warn(`ERROR(${err.code}): ${err.message}`);
}

function getLocation() {
    navigator.geolocation.getCurrentPosition(locationSuccess, locationError, locationOptions);

    getExposureSites();
}

function getExposureSites() {
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function() {
        console.log(this.responseText)
    }

    xhttp.open("GET", "https://discover.data.vic.gov.au/api/3/action/datastore_search?resource_id=afb52611-6061-4a2b-9110-74c920bede77", true);
    xhttp.send();
}

function sortTable(pos) {
    console.log("Sorting table...")
        // let table = document.getElementById("sites");
}

var button = document.getElementById("loc-btn");
button.onclick = getLocation;
async function fetchSites() {
    let sitesUrl = "https://data.nsw.gov.au/data/dataset/0a52e6c1-bc0b-48af-8b45-d791a6d8e289/resource/f3a28eed-8c2a-437b-8ac1-2dab3cf760f9/download/covid-case-locations.json";
    return fetch(sitesUrl)
        .then(response => response.json());
}

async function fetchSites(offset, prevResponse) {
    return fetch(sitesUrl)
        .then(response => response.json())
        .then(responseJson => {
            const response = [...prevResponse, ...responseJson.result.records]; // combine the two arrays

            offset += 100;
            if (offset < responseJson.result.total) {
                return fetchSites(offset, response);
            }
            return response;
        });
}

function getSites() {
    return [];
}

function updateSites() {}

module.exports = { getSites, updateSites };
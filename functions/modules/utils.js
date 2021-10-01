let admin;
if (!admin)  {
  admin = require('firebase-admin');
  admin.initializeApp();
}

function sleep(ms) {
    // usage: await sleep(2000); to sleep synchronously
    return new Promise(resolve => setTimeout(resolve, ms));
}

// From https://firebase.google.com/docs/firestore/manage-data/delete-data#node.js_2
async function deleteCollection(collectionRef, batchSize) {
    const db = admin.firestore();
    const query = collectionRef.limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db, query, resolve) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        // When there are no documents left, we are done
        resolve();
        return;
    }

    // Delete documents in a batch
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    // Recurse on the next process tick, to avoid
    // exploding the stack.
    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

function isDuplicateSite(s1, s2) {
    return JSON.stringify(s1) == JSON.stringify(s2);
}

function foldSites(sites, isSamePlace) {
    if (sites === undefined || sites.length == 0) {
        return [];
    }

    let foldedSites = [sites[0]]; // add first one
    for (s1 of sites) {
        let folded = false
        let duplicate = false

        for (s2 of foldedSites) {
            if (isDuplicateSite(s1, s2)) {
                duplicate = true;
                break;
            }
            if (isSamePlace(s1, s2) && !isDuplicateSite(s1, s2)) {
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

module.exports = { sleep, deleteCollection, foldSites, admin };

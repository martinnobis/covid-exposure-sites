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

module.exports = { sleep, deleteCollection, admin };

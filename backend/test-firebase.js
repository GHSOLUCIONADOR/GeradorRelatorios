require('dotenv').config();
const { db } = require('./firebase-config');

async function test() {
    try {
        const userSnap = await db.collection('usuarios').where('email', '==', 'anapaula.antunesaraujo@gmail.com').get();
        console.log('empty?', userSnap.empty);
    } catch (e) {
        console.error('FIREBASE ERROR:', e);
    }
}
test();

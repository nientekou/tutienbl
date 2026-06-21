const customId = 'duelaccept_duel-170000000-123';
const parts = customId.split('_');
console.log('parts:', parts);
const duelId = parts[1];
console.log('duelId:', duelId);

const duelchooseId = 'duelchoose_duel-170000000-123_kiem';
const chooseParts = duelchooseId.split('_');
console.log('chooseParts:', chooseParts);
const extractedId = chooseParts[1];
console.log('extracted duel id for choose:', extractedId);

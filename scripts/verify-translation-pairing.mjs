import {
    checkPair,
    isExcluded,
    listPairs,
    pairOf,
    writeRecord,
} from "./translation-pairing.mjs";

const args = process.argv.slice(2);
const write = args.includes("--write");
const all = args.includes("--all");
const files = args.filter((arg) => !arg.startsWith("--"));

if (write) {
    if (!all && files.length === 0) {
        console.error("--write needs the pairs to record, or --all");
        process.exit(2);
    }
    const pairs = all
        ? listPairs().filter((pair) => !isExcluded(pair.en))
        : files.map(pairOf);
    let failed = false;
    for (const pair of pairs) {
        try {
            writeRecord(pair);
            console.log(`recorded ${pair.record}`);
        } catch (error) {
            console.error(error.message);
            failed = true;
        }
    }
    process.exit(failed ? 1 : 0);
}

const pairs = files.length ? files.map(pairOf) : listPairs();
const problems = pairs.flatMap(checkPair);
for (const problem of problems) {
    console.error(problem);
}
const checked = pairs.filter((pair) => !isExcluded(pair.en)).length;
console.log(`${checked} pairs checked, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);

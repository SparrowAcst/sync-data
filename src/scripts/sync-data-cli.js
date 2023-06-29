

// const action = require("../actions/sync-data2")


// const run = async () => {
//   const organization = process.argv[2] || ""
//   const pattern = process.argv[3] || ""
//   const mode = (process.argv[4] == "no-validate") ?  "no-validate" : "validate"

//   await action(organization, pattern, mode)

// }


// run()


const yargs = require("yargs");

const options = yargs
 .usage("Usage: -o <organization> -p <pattern> -v <validation> -d <use drive> -a <accept>")
 .option("o", { alias: "organization", describe: "Clinic name", type: "string"})
 .option("p", { alias: "pattern", describe: "Patient ID pattern", type: "string" })
 .option("v", { alias: "validation", describe: "Skip data validation stage if it ignore", type: "string" })
 .option("d", { alias: "drive", describe: "Skip Google Drive data sync if it ignore", type: "string" })
 .option("a", { alias: "accept", describe: "Set state to accepted if it force", type: "string" })
 .argv;

 console.log(options.o)
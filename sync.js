

// const action = require("../actions/sync-data2")


// const run = async () => {
//   const organization = process.argv[2] || ""
//   const pattern = process.argv[3] || ""
//   const mode = (process.argv[4] == "no-validate") ?  "no-validate" : "validate"

//   await action(organization, pattern, mode)

// }


// run()


const yargs = require("yargs");

const settings = yargs
 .usage("Usage: -o <organization> -p <pattern> -v <validation> -d <use drive> -a <accept>")
 .option("o", { alias: "organization", describe: "Clinic name", type: "string", default:""})
 .option("p", { alias: "pattern", describe: "Patient ID pattern", type: "string", default:"" })
 .option("nv", { alias: "noValidate", describe: "Skip data validation stage if it ignore", type: "boolean", default:false })
 .option("nd", { alias: "noDrive", describe: "Skip Google Drive data sync if it ignore", type: "boolean", default:false })
 .option("state", { describe: "Set state", type: "string", default:"inReview" })
 .option("test", { alias: "testmode", describe: "Set to test mode", type: "boolean", default:false })
 
 .argv;

 
console.log(settings)

const action = require("./src/actions/sync-data-cli-1")
const run = async () => {
  await action(settings)
}


run()

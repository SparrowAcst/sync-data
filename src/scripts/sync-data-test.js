

const action = require("../actions/sync-data-test")


const run = async () => {
  const organization = process.argv[2] || ""
  const pattern = process.argv[3] || ""
  const mode = (process.argv[4] == "no-validate") ?  "no-validate" : "validate"

  await action(organization, pattern, mode)

}


run()


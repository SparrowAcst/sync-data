const action = require("../actions/validate-data")

const run = async () => {
  const organization = process.argv[2] || ""
  const pattern = process.argv[3] || ""

  if(organization){
    await action(organization, pattern)
  } else {
    console.log("Company data validation script: Organization undefined.")
    console.log("usage:\nnpm run validate <organization>")
  }  
}

run()


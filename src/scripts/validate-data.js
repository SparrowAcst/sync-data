const action = require("../actions/validate-data")

const run = async () => {
  let organization = process.argv[2] || ""
  if(organization){
    await action(organization)
  } else {
    console.log("Company data validation script: Organization undefined.")
    console.log("usage:\nnpm run validate <organization>")
  }  
}

run()


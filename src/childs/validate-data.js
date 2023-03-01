const action = require("../actions/validate-data")

const run = async () => {

  process.on('message', async params => {
    if(params && params.organization){
      
      const data = await action(params.organization, params.patientPattern)
      process.send({data})

    } else {

      process.send({
        error: `Data Validation Error: Organization undefined.`
      })
    
    }

    process.exit()

  })  

}

run()


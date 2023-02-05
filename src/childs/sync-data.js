const action = require("../actions/sync-data")

const run = async () => {

  process.on('message', async params => {
      params = params || {}
      await action(params.logFile)
      process.exit()

  })  

}

run()


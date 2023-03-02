const action = require("../actions/sync-data")

const run = async () => {

  process.on('message', async params => {
      params = params || {}
      await action(params.logFile)
      // setTimeout(
      // 	() => { process.exit() },
      // 	1000
      // )	
  })  

}
run()


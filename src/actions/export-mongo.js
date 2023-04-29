const moment = require("moment")
const path = require("path")
const { find, sortBy, filter, extend, isUndefined, isNull } = require("lodash")
const { loadYaml, pathExists, makeDir, rmDir, zip, createWriteStream } = require("../utils/file-system")

module.exports = async (database, collectionPath) => {
  
  const logger =  console 
  
  logger.info(`Export MongoDB data`)
  
  const controller = await require("../controller")({
    logger,
    firebaseService: false,
    googledriveService: false
  })
  
  const mongodb = controller.mongodbService
  
  const TEMP_DIR_PATH = path.join(__dirname, collectionPath)
  
  if(!pathExists(TEMP_DIR_PATH)) {
    logger.info(`Create ${TEMP_DIR_PATH}`)
    await makeDir(TEMP_DIR_PATH)
  }

  let collections = await mongodb.execute.listCollections(database)
  collections = collections.map( c => c.name )

  logger.info(`Database: "${database}" \nCollections:\n\t${collections.join("\n\t")}`)

  for( let index = 0; index < collections.length; index++){
    const collectionName = `${database}.${collections[index]}`
    const filePath = path.join(TEMP_DIR_PATH,`./${collectionName}.json`)
    logger.info(`Collection "${collectionName}":`)
    
    const source = mongodb.execute.getAggregateCursor(collectionName, [])
    const target = createWriteStream(filePath)

    let counter = 0
    // target.write("[\n")
    
    for await (const doc of source) {
      counter++
      process.stdout.write(`Export: ${counter} items into ${filePath}${'\x1b[0G'}`)
      target.write(JSON.stringify(doc))
      target.write("\n")  
    }
    
    await source.close()
    target.end()
    logger.info(`${counter} items exported into ${filePath}`)

  }
  

  controller.close() 
}



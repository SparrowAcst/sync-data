const moment = require("moment")
const path = require("path")
const { find, sortBy, filter, extend, isUndefined, isNull } = require("lodash")
const { loadYaml, pathExists, makeDir, rmDir, zip, createWriteStream } = require("../utils/file-system")
// const { JsonStreamStringify } = require('json-stream-stringify')  

module.exports = async (syncOrg, syncPatientPattern) => {
  
  const logConfig = loadYaml(path.join(__dirname,`../../.config/log/log.conf.yml`))
  const logFile = path.join(__dirname,`${logConfig.backup.log.path}`)
  
  const logger = require("../utils/logger")(logFile)
  
  logger.info(`Log file ${logFile}`)
  logger.info(`Backup MongoDB data`)
  
  const controller = await require("../controller")({
    logger,
    firebaseService:{
      noprefetch: true
    }  
  })
  
  const mongodb = controller.mongodbService
  const gdrive = await controller.googledriveService.create({
    subject: mongodb.config.backup.subject 
  })
  
  await gdrive.load(mongodb.config.backup.gdrive)
  
  // logger.info(`${JSON.stringify(mongodb.config, null," ")}`)
 
  // const backupConfig = loadYaml(path.join(__dirname,`../../.config/data/backup.yml`))
  

  const TEMP_DIR_PATH = path.join(__dirname,`${mongodb.config.backup.temp}`)
  const ZIP_DIR_PATH = path.join(__dirname,`${mongodb.config.backup.fs}`)
  const BACKUP_PATH = `${mongodb.config.backup.gdrive}`

  if(!pathExists(TEMP_DIR_PATH)) {
    logger.info(`Create ${TEMP_DIR_PATH}`)
    await makeDir(TEMP_DIR_PATH)
  }

  if(!pathExists(ZIP_DIR_PATH)) {
    logger.info(`Create ${ZIP_DIR_PATH}`)
    await makeDir(ZIP_DIR_PATH)
  }

  let collections = await mongodb.execute.listCollections("sparrow")
  collections = collections.map( c => c.name )

  // collections = [
  //   "organization2",                                                                                                              
  //   "harvest1-metadata"
  // ]

  logger.info(`Database: "sparrow" \nCollections:\n\t${collections.join("\n\t")}`)
  mongodb.config.backup.excludeCollection = mongodb.config.backup.excludeCollection || []
  for( let index = 0; index < collections.length; index++){

    if(mongodb.config.backup.excludeCollection.includes(collections[index])){
      console.log(`Ignore ${collections[index]}`)
      continue
    }

    const collectionName = `sparrow.${collections[index]}`
    const filePath = path.join(TEMP_DIR_PATH,`./${collectionName}.json`)
    logger.info(`Collection "${collectionName}":`)
    
    const source = await mongodb.execute.getAggregateCursor(collectionName, [])
    const target = createWriteStream(filePath)

    let counter = 0
    // target.write("[\n")
    
    for await (const doc of source) {
      counter++
      process.stdout.write(`Export: ${counter} items into ${filePath}${'\x1b[0G'}`)
      target.write(JSON.stringify(doc))
      target.write("\n")  
    }

    // target.write("\n]")
    
    await source.close()
    target.end()
    logger.info(`${counter} items exported into ${filePath}`)

  }

  const ZIP_FILE_PATH = path.join(ZIP_DIR_PATH,`mongodb-backup-${moment(new Date).format("YYYY-MM-DD-HH-mm-ss")}.zip`)

  
  logger.info(`Zip ${TEMP_DIR_PATH}/**/* into ${ZIP_FILE_PATH}`)
  
  await zip(TEMP_DIR_PATH, ZIP_FILE_PATH)
  
  logger.info(`Upload ${ZIP_FILE_PATH} into ${BACKUP_PATH}`)
  
  await gdrive.uploadFile(ZIP_FILE_PATH, BACKUP_PATH)

  logger.info(`Remove ${ZIP_DIR_PATH}`)
  await rmDir(ZIP_DIR_PATH)
  
  logger.info(`Remove ${TEMP_DIR_PATH}`)
  await rmDir(TEMP_DIR_PATH)
    

  controller.close() 
}



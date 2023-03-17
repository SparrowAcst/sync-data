const moment = require("moment")
const path = require("path")
const { find, sortBy, filter, extend, isUndefined, isNull } = require("lodash")
const { loadYaml, pathExists, makeDir, rmDir, zip, writeFile } = require("../utils/file-system")
  

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
  const gdrive = controller.googledriveService
  
  // logger.info(`${JSON.stringify(mongodb.config, null," ")}`)
 
  const backupConfig = loadYaml(path.join(__dirname,`../../.config/data/backup.yml`))
  

  const TEMP_DIR_PATH = path.join(__dirname,`${mongodb.config.backup.temp}`)
  const ZIP_DIR_PATH = path.join(__dirname,`${mongodb.config.backup.fs}`)
  const BACKUP_PATH = `${backupConfig.location}/${mongodb.config.backup.gdrive}`

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

  logger.info(`Database: "sparrow" \nCollections:\n\t${collections.join("\n\t")}`)

  for( let index = 0; index < collections.length; index++){
    const collectionName = `sparrow.${collections[index]}`
    const data = await mongodb.execute.aggregate(collectionName, [])
    const filePath = path.join(TEMP_DIR_PATH,`./${collectionName}.json`)
    logger.info(`Collection "${collectionName}":  export ${data.length} items into ${filePath}`)
    writeFile(filePath, JSON.stringify(data))
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



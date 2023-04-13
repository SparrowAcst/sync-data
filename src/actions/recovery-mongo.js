const path = require("path")
const { find, sortBy, filter, extend, isUndefined, isNull, maxBy, last } = require("lodash")
const { loadYaml, pathExists, makeDir, rmDir, zip, unzip, createWriteStream, getFileList } = require("../utils/file-system")
const fs = require("fs")
const {parser} = require('stream-json/jsonl/Parser');


module.exports = async backupFile => {
  
  const logConfig = loadYaml(path.join(__dirname,`../../.config/log/log.conf.yml`))
  const logFile = path.join(__dirname,`${logConfig.recoveryMongo.log.path}`)
  
  const logger = require("../utils/logger")(logFile)
  
  logger.info(`Log file ${logFile}`)
  logger.info(`Recovery MongoDB data`)
  
  const controller = await require("../controller")({
    logger,
    firebaseService: false
  })
  
  const mongodb = controller.mongodbService
  const gdrive = controller.googledriveService
  
  logger.info(`${JSON.stringify(mongodb.config, null," ")}`)
 
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
  if( !backupFile || gdrive.list(backupFile).length == 0){
    backupFile = maxBy(gdrive.list(`${BACKUP_PATH}/*.zip`), d => new Date(d.modifiedTime))
    logger.info(`Recovery latest db backup "${backupFile.path}"`)
  } else {
    backupFile = gdrive.list(backupFile)[0]
    logger.info(`Recovery db backup "${backupFile.path}"`)
  }

  let zipFilePath
  try {
    zipFilePath = await gdrive.downloadFile(backupFile, ZIP_DIR_PATH) 
  } catch(e) {
    logger.info(e.toString())
    throw e
  }

  logger.info(`Unzip ${zipFilePath} into ${TEMP_DIR_PATH}`)

  await unzip(zipFilePath, TEMP_DIR_PATH, logger)

  
  let collectionDataFiles = await getFileList(path.join(__dirname,`${mongodb.config.backup.temp}`,`/*.json`).replace(/\\/g,"/"))
  
  collectionDataFiles = collectionDataFiles.map( d => ({
  
    filePath: d,
    collection: `${path.basename(d).split(".")[0]}.${path.basename(d).split(".")[1]}`
  
  }))
  
  logger.info(`Start recovery for ${collectionDataFiles.length} collections`)
  
  let objectBuffer = []
  
  const importCollectionData = async collectionData => new Promise( (resolve, reject) => {
    
    let readCounter = 0
    let writeCounter = 0
    const objectBufferSize = 1000


    const fileStream = fs.createReadStream(collectionData.filePath)
    const jsonStream = parser()
    
    fileStream.pipe(jsonStream);
    
    jsonStream.on('data', async ({key, value}) => {
       
       readCounter++
       
       objectBuffer.push(value)
       
       if(objectBuffer.length >= objectBufferSize){
 
          jsonStream.pause()
          await mongodb.execute.insertAll(collectionData.collection, objectBuffer)
    
          writeCounter += objectBuffer.length
          objectBuffer = []
          jsonStream.resume()
       } 
       
       process.stdout.write(`Read: ${readCounter}. Write: ${writeCounter}  ${'\x1b[0G'}`)

    });

    jsonStream.on('end', async () => {
 
        await mongodb.execute.insertAll(collectionData.collection, objectBuffer)
        
        writeCounter += objectBuffer.length
        objectBuffer = []

        process.stdout.write(`Read: ${readCounter}. Write: ${writeCounter}  ${'\x1b[0G'}`)
        logger.info(`Read: ${readCounter}. Write: ${writeCounter}.`)
        resolve()
    })

  }) 



  for( let i = 0; i< collectionDataFiles.length; i++){

    collectionData = collectionDataFiles[i]
    
    logger.info(`Delete previus ${collectionData.collection}`)
    await mongodb.execute.removeAll(collectionData.collection)
    
    logger.info(`Import ${collectionData.filePath} into ${collectionData.collection}`)
    
    await importCollectionData(collectionData)

  }

  logger.info(`Remove ${ZIP_DIR_PATH}`)
  await rmDir(ZIP_DIR_PATH)
  
  logger.info(`Remove ${TEMP_DIR_PATH}`)
  await rmDir(TEMP_DIR_PATH)
    

  controller.close() 

}



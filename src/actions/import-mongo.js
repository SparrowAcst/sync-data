const path = require("path")
const { find, sortBy, filter, extend, isUndefined, isNull, maxBy, last } = require("lodash")
const { loadYaml, pathExists, makeDir, rmDir, zip, unzip, createWriteStream, getFileList } = require("../utils/file-system")
const fs = require("fs")
const {parser} = require('stream-json/jsonl/Parser');


module.exports = async dir => {
    
  const logger = console 
  
  
  const controller = await require("../controller")({
    logger,
    firebaseService: false,
    googledriveService: false
  })
  
  const mongodb = controller.mongodbService
  
  logger.info(`${JSON.stringify(mongodb.config, null," ")}`)
 
  
  const DIR_PATH = path.join(__dirname,`${dir}`)
   
  logger.info(`Import MongoDB data from ${path.join(DIR_PATH,`/*.json`).replace(/\\/g,"/")}`)
  
  let collectionDataFiles = await getFileList(path.join(DIR_PATH,`/*.json`).replace(/\\/g,"/"))
  
  collectionDataFiles = collectionDataFiles.map( d => ({
  
    filePath: d,
    collection: `${path.basename(d).split(".")[0]}.${path.basename(d).split(".")[1]}`
  
  }))
  
  logger.info(`Start import for ${collectionDataFiles.length} collections`)
  
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
        
        if(objectBuffer.length > 0){
          await mongodb.execute.insertAll(collectionData.collection, objectBuffer)
        }
        
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


  controller.close() 

}



const moment = require("moment")
const path = require("path")
const { loadYaml, pathExists } = require("../utils/file-system")
const { find, sortBy, filter, extend } = require("lodash")
  

module.exports = async logFile => {
  logFile = logFile 
            ||
            path.resolve(`./.logs/sync-data-${moment(new Date()).format("YYYY-MM-DD-HH-mm-ss")}.log`)
  
  const logger = require("../utils/logger")(logFile, true)
  
  logger.info(`SYNC DATA STARTS`)
  const controller = await require("../controller")()
   
  const labelsMetadata = loadYaml(path.join(__dirname,`../../.config/labeling/labels.yml`))
  
  let orgs = controller.googledriveService.dirList("Ready for Review/*").map( d => d.name)
  
  orgs = orgs.filter( o => 
    pathExists(path.join(__dirname,`../../.config/data/${o}/validate-rules.yml`)) 
    && 
    pathExists(path.join(__dirname,`../../.config/data/${o}/assets-rules.yml`))
  )


  for( let k=0; k < orgs.length; k++ ){
    
    let org = orgs[k]
    logger.info(`Organization: ${org}`)

    const validateRules = loadYaml(path.join(__dirname,`../../.config/data/${org}/validate-rules.yml`))
    const assetsRules = loadYaml(path.join(__dirname,`../../.config/data/${org}/assets-rules.yml`))


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  
  let examsIds = controller.googledriveService.dirList(`Ready for Review/${org}/*`).map( d => d.name)

  let inReviewExams = await controller.firebaseService.execute.getCollectionItems(
     "examinations",
     [["state", "==", "inReview"]]
  )

  examsIds = examsIds.filter( id => find(inReviewExams, exam => exam.patientId == id))   

  let syncExams = sortBy(
    inReviewExams.filter( exam => find(examsIds, id => exam.patientId == id))
    , d => d.patientId
  )  

  logger.info(`\nStart validation stage for ${syncExams.length} examinations:\n${syncExams.map(exam => "\t"+exam.patientId).join("\n")}`)

////////////////////////////           Validation Stage          ////////////////////////////////////////////////////

  for( let i = 0; i < syncExams.length; i++){
    
    let examination = syncExams[i]
    examination = await controller.expandExaminations(...[examination])
    examination = controller.validateExamination(examination[0], validateRules)
    logger.info(`Validation stage for examination ${examination.patientId} >>>> ${(examination._validation == true) ? "succeful passed" : "failed: "+examination._validation}`)

    let inserted = extend({}, examination)
    delete inserted.$extention
    
    // logger.info(`Update ${examination.patientId} in: ${controller.mongodbService.config.db.examinationCollection}`)
    
    await controller.mongodbService.execute.replaceOne(
      controller.mongodbService.config.db.examinationCollection,
      {id: examination.id},
      inserted
    )

  }

  let readyForAccept = syncExams.filter(exam => exam._validation === true)
  
  logger.info(`Start Import Stage for ${readyForAccept.length} examinations:\n${readyForAccept.map(exam => "\t"+exam.patientId).join("\n")}`)

  //////////////////////////////           Import Stage          //////////////////////////////////////////////////////////

  const db = controller.firebaseService.db
  
  for( let i = 0; i < readyForAccept.length; i++){
    
    const batch = db.batch()


    let examination = readyForAccept[i]
    examination.state = "accepted"
    examination.org = org
    logger.info(`Accept ${examination.patientId} in: ${controller.mongodbService.config.db.examinationCollection}`)
    
    let inserted = extend({}, examination)
    delete inserted.$extention
    
    await controller.mongodbService.execute.replaceOne(
      controller.mongodbService.config.db.examinationCollection,
      {id: inserted.id},
      inserted
    )
    
    logger.info(`Accept ${examination.patientId} (${examination.id}) in fb`)
    try {
      let doc = db.collection("examinations").doc(examination.id)
      batch.update(doc, { state: "accepted" })
    } catch (e) {
      console.log(e.toString())
    }

    logger.info(`Import ${examination.patientId} assets:`)
    
    let externalAssets = controller.buildExternalAssets(examination, assetsRules)
    
    for( let j = 0; j < externalAssets.length; j++){
      
      let asset = externalAssets[j]
      
      logger.info(`Move "${asset.file.path}"" into "${asset.links.path}"`)
  
      asset = await controller.resolveAsset(asset)
      let doc = db.collection(`examinations/${examination.id}/assets`).doc()
      batch.set(doc, asset)
      examination.$extention.assets.push(asset)
    }

    await controller.commitBatch(batch, "add resolved assets")

    let labelingRecords = controller.buildLabelingRecords(examination, labelsMetadata)

    let labelOps = labelingRecords.labelRecords.map( l => ({
      replaceOne :
        {
           "filter" : {id: l.id},
           "replacement" : l,
           "upsert" : true
        }
    }))

    
    logger.info(`Insert into labeling: ${controller.mongodbService.config.db.labelingCollection} ${labelOps.length} items`)
    
    await controller.mongodbService.execute.bulkWrite(
      controller.mongodbService.config.db.labelingCollection,
      labelOps
    )

    let formOps = labelingRecords.formRecords.map( l => ({
      replaceOne :
        {
           "filter" : {id: l.id},
           "replacement" : l,
           "upsert" : true
        }
    }))

    logger.info(`Insert into ${controller.mongodbService.config.db.formCollection} ${formOps.length} items`)
    await controller.mongodbService.execute.bulkWrite(
      controller.mongodbService.config.db.formCollection,
      formOps
    )

  }

}

  logger.info("Data synchronization finalized")

  controller.close() 
}



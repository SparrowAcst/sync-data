const moment = require("moment")
const path = require("path")
const { loadYaml, pathExists } = require("../utils/file-system")
const { find, sortBy, filter, extend, isUndefined } = require("lodash")
  

module.exports = async logFile => {
  logFile = logFile 
            ||
            path.resolve(`./.logs/sync-data-${moment(new Date()).format("YYYY-MM-DD-HH-mm-ss")}.log`)
  
  const logger = require("../utils/logger")(logFile, true)
  
  logger.info(`SYNC DATA STARTS`)
  const controller = await require("../controller")()
   
  const labelsMetadata = loadYaml(path.join(__dirname,`../../.config/labeling/labels.yml`))

  const backup = loadYaml(path.join(__dirname,`../../.config/data/backup.yml`))
  
  let orgs = controller.googledriveService.dirList("Ready for Review/*").map( d => d.name)
  
  orgs = orgs.filter( o => 
    pathExists(path.join(__dirname,`../../.config/data/${o}/validate-rules.yml`)) 
    && 
    pathExists(path.join(__dirname,`../../.config/data/${o}/assets-rules.yml`))
  )

// console.log(controller.mongodbService.config.db)

  for( let k=0; k < orgs.length; k++ ){
    
    let org = orgs[k]
    logger.info(`Organization: ${org}`)

    const validateRules = loadYaml(path.join(__dirname,`../../.config/data/${org}/validate-rules.yml`))
    const assetsRules = loadYaml(path.join(__dirname,`../../.config/data/${org}/assets-rules.yml`))


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  
  let examsIds = controller.googledriveService.dirList(`Ready for Review/${org}/*`).map( d => d.name)

  let inReviewExams = await controller.firebaseService.execute.getCollectionItems(
     "examinations",
     [["state", "==", "pending"]]
  )

  examsIds = examsIds.filter( id => find(inReviewExams, exam => exam.patientId == id))   

  let syncExams = sortBy(
    inReviewExams.filter( exam => find(examsIds, id => exam.patientId == id))
    , d => d.patientId
  )  

  logger.info(`\nStart validation stage for ${syncExams.length} examinations:\n${syncExams.map(exam => "\t"+exam.patientId).join("\n")}`)

////////////////////////////           Validation Stage          ////////////////////////////////////////////////////
  const db = controller.firebaseService.db
  const batch = db.batch()
  
  for( let i = 0; i < syncExams.length; i++){
    
    let examination = syncExams[i]
    examination = await controller.expandExaminations(...[examination])
    examination = controller.validateExamination(examination[0], validateRules)
    logger.info(`Validation stage for examination ${examination.patientId} >>>> ${(examination._validation == true) ? "succeful passed" : "failed: "+examination._validation}`)

    let insUser = extend({}, examination.$extention.users[0])
    let insOrganization = extend({}, examination.$extention.organizations[0])
    
    insUser.id = insUser.userId

    // console.log(JSON.stringify(controller.mongodbService.config.db.userCollection))
    logger.info(`Insert user into ${controller.mongodbService.config.db.userCollection}`)

    await controller.mongodbService.execute.replaceOne(
      controller.mongodbService.config.db.userCollection,
      {id: insUser.id},
      insUser
    )

    logger.info(`Insert organization into ${controller.mongodbService.config.db.organizationCollection}`)

    await controller.mongodbService.execute.replaceOne(
      controller.mongodbService.config.db.organizationCollection,
      {id: insOrganization.id},
      insOrganization
    ) 

    let inserted = extend({}, examination)
    delete inserted.$extention
    
    inserted.updatedAt = new Date()
    if( inserted._validation != true){
      console.log(inserted._validation)  
      if( /Will be rejected for inactivity within the last/.test(inserted._validation)){
        console.log("REJECT")
        inserted.state = "rejected",
        inserted._validation = "Rejected for inactivity within the deadline."+inserted._validation
      }
    } 
    // logger.info(`Update ${examination.patientId} in: ${controller.mongodbService.config.db.examinationCollection}`)
    
    inserted.actorId = inserted.userId 
    console.log("UPDATE", inserted)
    await controller.mongodbService.execute.replaceOne(
      controller.mongodbService.config.db.examinationCollection,
      {
        id: inserted.id
      },
      inserted
    )

    try {
      let doc = db.collection("examinations").doc(inserted.id)
      batch.update(doc, { state: inserted.state })
    } catch (e) {
      console.log(e.toString())
    }

  }

  try {
    await controller.commitBatch(batch, "update examination state")
    console.log("update examination state done")
  } catch (e) {
      console.log(e.toString())
  }
      
  let readyForAccept = syncExams.filter(exam => exam._validation === true)
  
  logger.info(`Start Import Stage for ${readyForAccept.length} examinations:\n${readyForAccept.map(exam => "\t"+exam.patientId).join("\n")}`)

  //////////////////////////////           Import Stage          //////////////////////////////////////////////////////////

  
  for( let i = 0; i < readyForAccept.length; i++){
    
    const batch = db.batch()


    let examination = readyForAccept[i]
    examination.state = "inReview"
    examination.org = org
    examination.updatedAt = new Date()
    examination.actorId = examination.userId
    logger.info(`Accept for review ${examination.patientId} in: ${controller.mongodbService.config.db.examinationCollection}`)
    
    let inserted = extend({}, examination)
    delete inserted.$extention
    
    await controller.mongodbService.execute.replaceOne(
      controller.mongodbService.config.db.examinationCollection,
      {id: inserted.id},
      inserted
    )
    
    logger.info(`Accept for review ${examination.patientId} (${examination.id}) in fb`)

    try {
      let doc = db.collection("examinations").doc(examination.id)
      batch.update(doc, { state: "inReview" })
    } catch (e) {
      console.log(e.toString())
    }

    
    logger.info(`Import ${examination.patientId} assets:`)
    
    let externalAssets = controller.buildExternalAssets(examination, assetsRules)
    
    for( let j = 0; j < externalAssets.length; j++){
      
      let asset = externalAssets[j]
      
      logger.info(`Move "${asset.file.path}"" into "${asset.links.path}"`)
  
      asset = await controller.resolveAsset(asset)
      
      // console.log("!!!!!!!!!!!!!!!!!!!!!!", asset)
      
      let doc 
      if(!isUndefined(asset.id) && !isNull(asset.id)){
        // console.log("EXISTS")
        doc = db.collection(`examinations/${examination.id}/assets`).doc(asset.id)
        
      } else {
        // console.log("UNDEFINED")
        doc = db.collection(`examinations/${examination.id}/assets`).doc()
      }
      
      delete asset.id
    
      batch.set(doc, asset)
      examination.$extention.assets.push(asset)
    
    }

    await controller.commitBatch(batch, "add resolved assets")
    
    logger.info(`Backup "Ready for Review/${org}/${examination.patientId}/**/*".`)
    // console.log(controller.googledriveService.fileList("Ready for Review/${org}/${examination.patientId}/**/*"))


    await controller.googledriveService.copy(`Ready for Review/${org}/${examination.patientId}/**/*`, backup.location, logger)
    
    logger.info(`${examination.patientId} data will be protected.`)
    
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



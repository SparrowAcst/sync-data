const moment = require("moment")
const path = require("path")
const { find, sortBy, filter, extend, isUndefined, isNull } = require("lodash")
const { loadYaml, pathExists } = require("../utils/file-system")
  

module.exports = async (syncOrg, syncPatientPattern) => {
  
  // logFile = logFile 
  //           ||
  //           path.resolve(`./.logs/sync-data-${moment(new Date()).format("YYYY-MM-DD-HH-mm-ss")}.log`)
  
  
  const logger = require("../utils/logger")()
    // logFile, true)
  
  logger.info(`SYNC DATA STARTS`)
  
  const controller = await require("../controller")({
    firebaseService:{
      noprefetch: true
    }  
  })
  
  const mongodb = controller.mongodbService
  const fb = controller.firebaseService
  const gdrive = controller.googledriveService
     
  
  const labelsMetadata = loadYaml(path.join(__dirname,`../../.config/labeling/labels.yml`))
  const backup = loadYaml(path.join(__dirname,`../../.config/data/backup.yml`))
  
  let orgs = gdrive.dirList("Ready for Review/*").map( d => d.name)
  
  orgs = orgs.filter( o => 
    pathExists(path.join(__dirname,`../../.config/data/${o}/validate-rules.yml`)) 
    && 
    pathExists(path.join(__dirname,`../../.config/data/${o}/assets-rules.yml`))
  )

  orgs = (syncOrg) ? [syncOrg] : orgs

  for( let k=0; k < orgs.length; k++ ){
    
    let org = orgs[k]
    logger.info(`Organization: ${org}`)

    const validateRules = loadYaml(path.join(__dirname,`../../.config/data/${org}/validate-rules.yml`))
    const assetsRules = loadYaml(path.join(__dirname,`../../.config/data/${org}/assets-rules.yml`))

    let examsIds = gdrive.dirList(`Ready for Review/${org}/*`).map( d => d.name)

    let inReviewExams = await fb.execute.getCollectionItems(
       "examinations",
       [["state", "==", "pending"]]
    )

    examsIds = examsIds.filter( id => find(inReviewExams, exam => exam.patientId == id))   

    let syncExams = sortBy(
      inReviewExams.filter( exam => find(examsIds, id => exam.patientId == id)),
      d => d.patientId
    )  

    const patientRegExp = RegExp(syncPatientPattern || ".*")
    syncExams = syncExams.filter( e => patientRegExp.test(e.patientId))

    logger.info(`\nStart validation stage for ${syncExams.length} examinations:\n${syncExams.map(exam => "\t"+exam.patientId).join("\n")}`)

////////////////////////////           Validation Stage          ////////////////////////////////////////////////////
    
    const batch = fb.db.batch()
  
    for( let i = 0; i < syncExams.length; i++){
      
      let examination = syncExams[i]
      examination = await controller.expandExaminations(...[examination])
      examination = controller.validateExamination(examination[0], validateRules, org)
      logger.info(`Validation stage for examination ${examination.patientId} >>>> ${(examination._validation == true) ? "succeful passed" : "failed: "+examination._validation}`)

      let insUser = extend({}, examination.$extention.users[0])
      let insOrganization = extend({}, examination.$extention.organizations[0])
      
      insUser.id = insUser.userId

      logger.info(`Insert user into ${controller.mongodbService.config.db.userCollection}`)

      await mongodb.execute.replaceOne(
        mongodb.config.db.userCollection,
        {id: insUser.id},
        insUser
      )

      logger.info(`Insert organization into ${mongodb.config.db.organizationCollection}`)

      await mongodb.execute.replaceOne(
        mongodb.config.db.organizationCollection,
        {id: insOrganization.id},
        insOrganization
      ) 

      let inserted = extend({}, examination)
      delete inserted.$extention
      
      inserted.synchronizedAt = new Date()
      if( inserted._validation != true){
        if( /Will be rejected for inactivity within the last/.test(inserted._validation)){
          inserted.state = "rejected",
          inserted._validation = "Rejected for inactivity within the deadline."+inserted._validation
        }
      } 
      
      inserted.actorId = inserted.userId 
      await mongodb.execute.replaceOne(
        mongodb.config.db.examinationCollection,
        {
          id: inserted.id
        },
        inserted
      )

      try {
        let doc = fb.db.collection("examinations").doc(inserted.id)
        batch.update(doc, { state: inserted.state })
      } catch (e) {
        console.log(e.toString())
      }

    }

    try {
      await controller.commitBatch(batch, "update examination state")
    } catch (e) {
        console.log(e.toString())
    }
      
    let readyForAccept = syncExams.filter(exam => exam._validation === true)
    
    logger.info(`Start Import Stage for ${readyForAccept.length} examinations:\n${readyForAccept.map(exam => "\t"+exam.patientId).join("\n")}`)

  //////////////////////////////           Import Stage          //////////////////////////////////////////////////////////

  
    for( let i = 0; i < readyForAccept.length; i++){
      
      const batch = fb.db.batch()

      let examination = readyForAccept[i]
      examination.state = "inReview"
      examination.org = org
      examination.synchronizedAt = new Date()
      examination.actorId = examination.userId
      logger.info(`Accept for review ${examination.patientId} in: ${mongodb.config.db.examinationCollection}`)
      
      let inserted = extend({}, examination)
      delete inserted.$extention
      
      await mongodb.execute.replaceOne(
        mongodb.config.db.examinationCollection,
        {id: inserted.id},
        inserted
      )
      
      logger.info(`Accept for review ${examination.patientId} (${examination.id}) in fb`)

      try {
        let doc = fb.db.collection("examinations").doc(examination.id)
        batch.update(doc, { state: "inReview" })
      } catch (e) {
        console.log(e.toString())
      }

      
      logger.info(`Import ${examination.patientId} assets:`)
      
      let externalAssets = controller.buildExternalAssets(examination, assetsRules)
      
      for( let j = 0; j < externalAssets.length; j++){
        
        let asset = externalAssets[j]
        
        
        asset = await controller.resolveAsset(examination, asset)
        logger.info(`Move "${asset.file.path}"" into "${asset.links.path}"`)
    
        let doc 
        // if(!isUndefined(asset.id) && !isNull(asset.id)){
          doc = fb.db.collection(`examinations/${examination.id}/assets`).doc(asset.id)
        //   console.log("UPDATE asset", asset.links.path)
        // } else {
        //   doc = fb.db.collection(`examinations/${examination.id}/assets`).doc()
        //   asset.links.path = `${examination.userId}/recordings/eKuore_${doc.id}`
        //   console.log("CREATE asset", asset.links.path)
        // }
        
        delete asset.id
      
        batch.set(doc, asset)
        examination.$extention.assets.push(asset)
      
      }

      await controller.commitBatch(batch, "add resolved assets")

// START DEBUG COMMENT

      
      logger.info(`Backup "Ready for Review/${org}/${examination.patientId}/**/*".`)

      await gdrive.copy(`Ready for Review/${org}/${examination.patientId}/**/*`, backup.location, logger)
      
// END DEBUG COMMENT

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
      
      logger.info(`Insert into labeling: ${mongodb.config.db.labelingCollection} ${labelOps.length} items`)
      
      await mongodb.execute.bulkWrite(
        mongodb.config.db.labelingCollection,
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

      logger.info(`Insert into ${mongodb.config.db.formCollection} ${formOps.length} items`)
      await mongodb.execute.bulkWrite(
        mongodb.config.db.formCollection,
        formOps
      )

    }

}

  logger.info("Data synchronization finalized")

  controller.close() 
}



const moment = require("moment")
const path = require("path")
const { find, sortBy, filter, extend, isUndefined, isNull } = require("lodash")
const { loadYaml, pathExists } = require("../utils/file-system")
const uuid = require("uuid").v4 
  

module.exports = async (syncOrg, syncPatientPattern) => {
  
  const logConfig = loadYaml(path.join(__dirname,`../../.config/log/log.conf.yml`))
  const logFile = path.join(__dirname,`${logConfig.sync.log.path}`)
  
  const logger = require("../utils/logger")(logFile)
  
  logger.info(`Log file ${logFile}`)
  logger.info(`SYNC DATA STARTS`)
  
  const controller = await require("../controller")({
    logger,
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
    
    // let inReviewExams = await fb.execute.getCollectionItems(
    //    "examinations",
    //    [["patientId", "==", "YAL0001"]]
    // )
    

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
        logger.info(e.toString())
      }

    }

    try {
      await controller.commitBatch(batch, "update examination state")
    } catch (e) {
        logger.info(e.toString())
    }
      
    let readyForAccept = syncExams.filter(exam => exam._validation === true)
    // let readyForAccept = inReviewExams
    

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
        logger.info(e.toString())
      }

      
      logger.info(`Import ${examination.patientId} assets:`)
      
      let externalAssets = controller.buildExternalAssets(examination, assetsRules)
      
      for( let j = 0; j < externalAssets.length; j++){
        
        let asset = externalAssets[j]
        
        asset = await controller.resolveAsset(examination, asset)
        if(asset.error){
          logger.info(`"${asset.links.path}": ${asset.error}`)
          delete assets.error
          logger.info(`Recovery "${asset.links.path}"`)
          asset = await controller.resolveAsset(examination, asset)
          logger.info(`"${asset.links.path}":\n${JSON.stringify(asset, null, " ")}`)
        } else {
          logger.info(`Move data into "${asset.links.path}"`)
        }
        
        let doc = fb.db.collection(`examinations/${examination.id}/assets`).doc(asset.id)
        
        delete asset.id
      
        batch.set(doc, asset)
        examination.$extention.assets.push(asset)
      
      }

      await controller.commitBatch(batch, "add resolved assets")

// // START DEBUG COMMENT

      
      logger.info(`Backup "Ready for Review/${org}/${examination.patientId}/**/*".`)

      await gdrive.copy(`Ready for Review/${org}/${examination.patientId}/**/*`, backup.location, logger)
      
// // END DEBUG COMMENT

      logger.info(`${examination.patientId} data will be protected.`)
      
      let labelingRecords = controller.buildLabelingRecords(examination, labelsMetadata)

      let labelOps = labelingRecords.labelRecords.map( l => ({
        replaceOne :
          {
             "filter" : {path: l.path},
             "replacement" : l,
             "upsert" : true
          }
      }))

      // console.log(labelOps.length)
      
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

      const attachementForm = {
          "id":uuid(),
          "type":"attachements",
          "data": examination.$extention.assets
                    .filter( d => d.type != "recording")
                    .map( (d, index) => ({
                      index,
                      name: d.publicName || `${d.type}${index}`,
                      mimeType: d.mimeType || d.type,
                      url:  d.links.url
                    })),  
          examinationId: examination.id
        }

        formOps.push({
          replaceOne :
            {
               "filter" : {id: attachementForm.id},
               "replacement" : attachementForm,
               "upsert" : true
            }
        })

      logger.info(`Insert into ${mongodb.config.db.formCollection} ${formOps.length} items`)
      await mongodb.execute.bulkWrite(
        mongodb.config.db.formCollection,
        formOps
      )

    }

}

  logger.info("Data synchronization finalized")
  logger.info("")


  controller.close() 
}



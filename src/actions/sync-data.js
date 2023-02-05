const moment = require("moment")
const path = require("path")

module.exports = async logFile => {

  logFile = logFile 
            ||
            path.resolve(`./.logs/sync-data-${moment(new Date()).format("YYYY-MM-DD-HH-mm-ss")}.log`)
  
  const logger = require("../utils/logger")(logFile)
  
  logger.info(`SYNC DATA STARTS`)
  
  const controller = await require("../controller")()
  
  const { loadYaml, pathExists } = require("../utils/file-system")
  const { find, sortBy, filter, extend } = require("lodash")
  
  const labelsMetadata = loadYaml(`./.config/labeling/labels.yml`)
  
  let orgs = controller.googledriveService.dirList("Ready for Review/*").map( d => d.name)
  orgs = orgs.filter( o => 
    pathExists(path.join(__dirname,`../../.config/data/${o}/validate-rules.yml`)) 
    && 
    pathExists(path.join(__dirname,`../../.config/data/${o}/assets-rules.yml`))
  )

  // logger.info("Ready for Review Organization Data:\n", orgs.join("\n"))

for( let k=0; k < orgs.length; k++ ){
  let org = orgs[k]
  logger.info(`Organization: ${org}`)

  const validateRules = loadYaml(path.join(__dirname,`../../.config/data/${org}/validate-rules.yml`))
  const assetsRules = loadYaml(path.join(__dirname,`../../.config/data/${org}/assets-rules.yml`))


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  
  let examsIds = controller.googledriveService.dirList(`Ready for Review/${org}/*`).map( d => d.name)
  // logger.info("READY FOR REVIEW:\n", examsIds.join("\n"))

  let inReviewExams = await controller.firebaseService.execute.getCollectionItems(
     "examinations",
     [["state", "==", "inReview"]]
  )
  // logger.info("IN REVIEW STATE:\n", inReviewExams.map(exam => exam.patientId).join("\n"))

  examsIds = examsIds.filter( id => find(inReviewExams, exam => exam.patientId == id))   
  // logger.info("READY FOR REVIEW:\n", examsIds.join("\n"))

  let syncExams = sortBy(
    inReviewExams.filter( exam => find(examsIds, id => exam.patientId == id))
    , d => d.patientId
  )  

  logger.info(`SYNC:\n${syncExams.map(exam => exam.patientId).join("\n")}`)

// /////////////////////////////////////////////////////////////////////////////////////////////////////////////

  for( let i = 0; i < syncExams.length; i++){
    
    let examination = syncExams[i]

    examination = await controller.expandExaminations(...[examination])
    examination = controller.validateExamination(examination[0], validateRules)

    logger.info(
`
${examination.patientId} >>>>
${examination._validation}
`
)

    let inserted = extend({}, examination)
    delete inserted.$extention
    
    logger.info(
`
Update ${examination.patientId} in: ${controller.mongodbService.config.db.examinationCollection}
`
)
    
    await controller.mongodbService.execute.replaceOne(
      controller.mongodbService.config.db.examinationCollection,
      {id: examination.id},
      inserted
    )

  }

  let readyForAccept = syncExams.filter(exam => exam._validation === true)
  logger.info(`
IMPORT:
${readyForAccept.map(exam => exam.patientId).join("\n")}
`)

  for( let i = 0; i < readyForAccept.length; i++){
    let examination = readyForAccept[i]
    examination.state = "accepted"
    examination.org = org
    logger.info(`
Accept ${examination.patientId} in: ${controller.mongodbService.config.db.examinationCollection}
`)
    
    let inserted = extend({}, examination)
    delete inserted.$extention
    
    await controller.mongodbService.execute.replaceOne(
      controller.mongodbService.config.db.examinationCollection,
      {id: examination.id},
      inserted
    )
    
    logger.info(`Accept ${examination.patientId} in fb`)
    await controller.firebaseService.db.collection("examinations").doc(examination.id).update({
      state: "accepted"
    })
      

    logger.info(`Import ${examination.patientId} assets:`)
    
    //// update examination state into fb and mongo 

    let externalAssets = controller.buildExternalAssets(examination, assetsRules)
    for( let j = 0; j < externalAssets.length; j++){
      let asset = externalAssets[j]
      asset = await controller.resolveAsset(asset)
      await controller.firebaseService.db.collection(`examinations/${examination.id}/assets`).add(asset)
      examination.$extention.assets.push(asset)
    }

    let labelingRecords = controller.buildLabelingRecords(examination, labelsMetadata)

    let labelOps = labelingRecords.labelRecords.map( l => ({
      replaceOne :
        {
           "filter" : {id: l.id},
           "replacement" : l,
           "upsert" : true
        }
    }))

    logger.info(`Insert into: ${controller.mongodbService.config.db.labelingCollection} ${labelOps.length} items`)
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


  controller.close() 
}



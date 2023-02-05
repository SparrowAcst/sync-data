const action = require("../actions/sync-data")
const run = async () => {
    await action()
}
run()







// const run = async () => {
  
//   console.log(`SYNC DATA STARTS at ${new Date()}`)
  
//   const controller = await require("../controller")()
  
//   const { loadYaml, pathExists } = require("../utils/file-system")
//   const { find, sortBy, filter, extend } = require("lodash")
  
//   const labelsMetadata = loadYaml(`./.config/labeling/labels.yml`)
  
//   let orgs = controller.googledriveService.dirList("Ready for Review/*").map( d => d.name)
//   orgs = orgs.filter( o => 
//     pathExists(`./.config/data/${o}/validate-rules.yml`) 
//     && 
//     pathExists(`./.config/data/${o}/assets-rules.yml`)
//   )

//   // console.log("Ready for Review Organization Data:\n", orgs.join("\n"))

// for( let k=0; k < orgs.length; k++ ){
//   let org = orgs[k]
//   console.log(`Organization: ${org} >>>`)

//   const validateRules = loadYaml(`./.config/data/${org}/validate-rules.yml`)
//   const assetsRules = loadYaml(`./.config/data/${org}/assets-rules.yml`)


// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  
//   let examsIds = controller.googledriveService.dirList(`Ready for Review/${org}/*`).map( d => d.name)
//   // console.log("READY FOR REVIEW:\n", examsIds.join("\n"))

//   let inReviewExams = await controller.firebaseService.execute.getCollectionItems(
//      "examinations",
//      [["state", "==", "inReview"]]
//   )
//   // console.log("IN REVIEW STATE:\n", inReviewExams.map(exam => exam.patientId).join("\n"))

//   examsIds = examsIds.filter( id => find(inReviewExams, exam => exam.patientId == id))   
//   // console.log("READY FOR REVIEW:\n", examsIds.join("\n"))

//   let syncExams = sortBy(
//     inReviewExams.filter( exam => find(examsIds, id => exam.patientId == id))
//     , d => d.patientId
//   )  

//   console.log("SYNC:\n", syncExams.map(exam => exam.patientId).join("\n"))

// // /////////////////////////////////////////////////////////////////////////////////////////////////////////////

//   for( let i = 0; i < syncExams.length; i++){
    
//     let examination = syncExams[i]

//     examination = await controller.expandExaminations(...[examination])
//     examination = controller.validateExamination(examination[0], validateRules)

//     console.log(
//       "\n",
//       examination.patientId,
//       " >>>\n", 
//       // controller.googledriveService.dirList(`Ready for Review/${org}/${examination.patientId}/**/*`).map(d => d.path).join("\n"),
//       // "\n",
//       examination._validation
//     )

//     let inserted = extend({}, examination)
//     delete inserted.$extention
    
//     console.log("Update in:", controller.mongodbService.config.db.examinationCollection, examination.patientId)
    
//     await controller.mongodbService.execute.replaceOne(
//       controller.mongodbService.config.db.examinationCollection,
//       {id: examination.id},
//       inserted
//     )

//   }

//   let readyForAccept = syncExams.filter(exam => exam._validation === true)
//   console.log("IMPORT:\n", readyForAccept.map(exam => exam.patientId).join("\n"))

//   for( let i = 0; i < readyForAccept.length; i++){
//     let examination = readyForAccept[i]
//     examination.state = "accepted"
//     examination.org = org
//     console.log("Accept in: ", controller.mongodbService.config.db.examinationCollection, examination.patientId)
    
//     let inserted = extend({}, examination)
//     delete inserted.$extention
    
//     await controller.mongodbService.execute.replaceOne(
//       controller.mongodbService.config.db.examinationCollection,
//       {id: examination.id},
//       inserted
//     )
    
//     console.log("Accept in fb", examination.patientId)
//     await controller.firebaseService.db.collection("examinations").doc(examination.id).update({
//       state: "accepted"
//     })
      

//     console.log("Import assets >>> ", examination.patientId)
    
//     //// update examination state into fb and mongo 

//     let externalAssets = controller.buildExternalAssets(examination, assetsRules)
//     for( let j = 0; j < externalAssets.length; j++){
//       let asset = externalAssets[j]
//       asset = await controller.resolveAsset(asset)
//       await controller.firebaseService.db.collection(`examinations/${examination.id}/assets`).add(asset)
//       examination.$extention.assets.push(asset)
//     }

//     let labelingRecords = controller.buildLabelingRecords(examination, labelsMetadata)

//     let labelOps = labelingRecords.labelRecords.map( l => ({
//       replaceOne :
//         {
//            "filter" : {id: l.id},
//            "replacement" : l,
//            "upsert" : true
//         }
//     }))

//     console.log("Insert into:", controller.mongodbService.config.db.labelingCollection, labelOps.length, "items")
//     await controller.mongodbService.execute.bulkWrite(
//       controller.mongodbService.config.db.labelingCollection,
//       labelOps
//     )

//     let formOps = labelingRecords.formRecords.map( l => ({
//       replaceOne :
//         {
//            "filter" : {id: l.id},
//            "replacement" : l,
//            "upsert" : true
//         }
//     }))

//     console.log("Insert into:", controller.mongodbService.config.db.formCollection, formOps.length, "items")
//     await controller.mongodbService.execute.bulkWrite(
//       controller.mongodbService.config.db.formCollection,
//       formOps
//     )

//   }

// }


//   controller.close() 
// }

// run()


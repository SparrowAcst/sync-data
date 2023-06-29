const moment = require("moment")
const path = require("path")
const { find, sortBy, filter, extend, isUndefined, isNull } = require("lodash")
const { loadYaml, pathExists } = require("../utils/file-system")
const uuid = require("uuid").v4


module.exports = async settings => {
    
    const logConfig = loadYaml(path.join(__dirname, `../../.config/log/log.conf.yml`))
    const logFile = path.join(__dirname, `${logConfig.sync.log.path}`)
    const backup = loadYaml(path.join(__dirname, `../../.config/data/backup.yml`))
    const labelsMetadata = loadYaml(path.join(__dirname, `../../.config/labeling/labels.yml`))

    const logger = require("../utils/logger")(logFile)

    logger.info(`Log file ${logFile}`)
    logger.info(`SYNC DATA STARTS (${JSON.stringify(settings, null, " ")})`)

    const controller = await require("../controller")({
        logger,
        firebaseService: {
            noprefetch: true
        }
    })

    const mongodb = controller.mongodbService
    const fb = controller.firebaseService


    let orgs = backup.organizations


    orgs = orgs.filter(o =>
        pathExists(path.join(__dirname, `../../.config/data/${o}/validate-rules.yml`)) &&
        pathExists(path.join(__dirname, `../../.config/data/${o}/assets-rules.yml`))
    )

    orgs = (settings.organization) ? [settings.organization] : orgs


    for (let k = 0; k < orgs.length; k++) {

        let org = orgs[k]
        logger.info(`Organization: ${org}`)

        let examsIds = []
        let sourceDrive
        let targetDrive

        let noDrive 
        if(backup.owner[org]){
            noDrive = settings.noDrive
            noValidate = settings.noValidate    
        } else {
            noDrive = true
            noValidate = true
            logger.info(`Set "noDrive" "noValidate" modes automatically`)
        }
         

        if (!noDrive) {
            sourceDrive = await controller.googledriveService.create({
                owner: backup.owner[org]
            })

            await sourceDrive.load(backup.read[org])


            targetDrive = await controller.googledriveService.create({
                subject: backup.subject
            })

            await targetDrive.load(`${backup.location}/${backup.read[org]}`)

            examsIds = sourceDrive.dirList(`Ready for Review/${org}/*`).map(d => d.name)

        }


        const validateRules = (noValidate) ?
            [] : loadYaml(path.join(__dirname, `../../.config/data/${org}/validate-rules.yml`))

        const assetsRules = (noDrive) ?
            [] : loadYaml(path.join(__dirname, `../../.config/data/${org}/assets-rules.yml`))


        let inReviewExams = await fb.execute.getCollectionItems(
            "examinations",
            [
                ["state", "==", "pending"]
            ]
        )

        let syncExams = []

        if (!noDrive) {
            examsIds = examsIds.filter(id => find(inReviewExams, exam => exam.patientId == id))
            syncExams = sortBy(
                inReviewExams.filter(exam => find(examsIds, id => exam.patientId == id)),
                d => d.patientId
            )
        } else {
            syncExams = sortBy(inReviewExams, d => d.patientId)
        }


        const patientRegExp = RegExp(settings.pattern || ".*")
        syncExams = syncExams.filter(e => patientRegExp.test(e.patientId))

        logger.info(`\nStart validation stage for ${syncExams.length} examinations:\n${syncExams.map(exam => "\t"+exam.patientId).join("\n")}`)
    // }

    ////////////////////////////           Validation Stage          ////////////////////////////////////////////////////



    ////////////////////////////////////////////////////////////////////////////////////////////////////
    //// debug forms
    // 
    // 
    let batch

    if (!settings.test) {
        batch = fb.db.batch()
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////// 


    for (let i = 0; i < syncExams.length; i++) {

        let examination = syncExams[i]
        examination = await controller.expandExaminations1(...[examination])

        if (!noValidate) {

            examination = controller.validateExamination(examination[0], validateRules, org, sourceDrive)
            logger.info(`Validation stage for examination ${examination.patientId} >>>> ${(examination._validation == true) ? "succeful passed" : "failed: "+examination._validation}`)

        } else {

            examination = examination[0]
            logger.info(`Ignore validation stage for examination ${examination.patientId}`)

        }

        let insUser = extend({}, examination.$extention.users[0])
        let insOrganization = extend({}, examination.$extention.organizations[0])

        insUser.id = insUser.userId

        logger.info(`Insert user into ${controller.mongodbService.config.db[org].userCollection}`)

        if (!settings.test) {

            await mongodb.execute.replaceOne(
                mongodb.config.db[org].userCollection, 
                { id: insUser.id },
                insUser
            )

        }

        logger.info(`Insert organization into ${mongodb.config.db[org].organizationCollection}`)

        if (!settings.test) {

            await mongodb.execute.replaceOne(
                mongodb.config.db[org].organizationCollection, { id: insOrganization.id },
                insOrganization
            )

        }

        let inserted = extend({}, examination)
        delete inserted.$extention

        inserted.synchronizedAt = new Date()
        if (inserted._validation != true) {
            if (/Will be rejected for inactivity within the last/.test(inserted._validation)) {
                inserted.state = "rejected",
                    inserted._validation = "Rejected for inactivity within the deadline." + inserted._validation
            }
        }

        inserted.actorId = inserted.userId

        if (!settings.test) {

            await mongodb.execute.replaceOne(
                mongodb.config.db[org].examinationCollection, {
                    id: inserted.id
                },
                inserted
            )
        }



        ////////////////////////////////////////////////////////////////////////////////////////////////////
        //// debug forms
        // 
        // 
        if (!settings.test) {

            try {
                let doc = fb.db.collection("examinations").doc(inserted.id)
                batch.update(doc, { state: inserted.state })
            } catch (e) {
                logger.info(e.toString())
            }
        }



    }

    if (!settings.test) {

        try {
            await controller.commitBatch(batch, "update examination state")
        } catch (e) {
            logger.info(e.toString())
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////



    let readyForAccept = (!noValidate) ? syncExams.filter(exam => exam._validation === true) : syncExams
    // let readyForAccept = inReviewExams


    logger.info(`Start Import Stage for ${readyForAccept.length} examinations:\n${readyForAccept.map(exam => "\t"+exam.patientId).join("\n")}`)

    //////////////////////////////           Import Stage          //////////////////////////////////////////////////////////


    for (let i = 0; i < readyForAccept.length; i++) {

        ////////////////////////////////////////////////////////////////////////////////////////////////////
        //// debug forms
        // 
        // 

        let batch

        if (!settings.test) {

            batch = fb.db.batch()

        }

        /////////////////////////////////////////////////////////////////////////////////////////////////////

        let examination = readyForAccept[i]
        //!!!!!!!!!!!!!!
        examination.state = settings.state
        examination.org = org
        examination.synchronizedAt = new Date()
        examination.actorId = examination.userId
        logger.info(`Accept for review ${examination.patientId} in: ${mongodb.config.db[org].examinationCollection}`)

        let inserted = extend({}, examination)
        delete inserted.$extention

        if (!settings.test) {

            await mongodb.execute.replaceOne(
                mongodb.config.db[org].examinationCollection, { id: inserted.id },
                inserted
            )
        }

        logger.info(`Accept for review ${examination.patientId} (${examination.id}) in fb`)

        //!!!!!!!!!!!!!!



        ////////////////////////////////////////////////////////////////////////////////////////////////////
        //// debug forms
        // 
        // 
        if (!settings.test) {

            try {
                let doc = fb.db.collection("examinations").doc(examination.id)
                batch.update(doc, { state: "inReview" })
                console.log("UPDATE STAGE FB",examination.id)
            } catch (e) {
                logger.info(e.toString())
            }
        }

        await controller.commitBatch(batch, "update fb stage inReview ")


        if (!noDrive && !settings.test) {

            logger.info(`Import ${examination.patientId} assets:`)

            let externalAssets = controller.buildExternalAssets(examination, assetsRules, sourceDrive)

            for (let j = 0; j < externalAssets.length; j++) {

                let asset = externalAssets[j]

                if (asset.file) {
                    asset = await controller.resolveAsset(examination, asset, sourceDrive)

                    if (asset.error) {
                        logger.info(`"${asset.links.path}": ${asset.error}`)
                        delete assets.error
                        logger.info(`Recovery "${asset.links.path}"`)
                        asset = await controller.resolveAsset(examination, asset, sourceDrive)
                        logger.info(`"${asset.links.path}":\n${JSON.stringify(asset, null, " ")}`)
                    } else {
                        logger.info(`Move data into "${asset.links.path}"`)
                    }

                    let doc = fb.db.collection(`examinations/${examination.id}/assets`).doc(asset.id)

                    delete asset.id

                    batch.set(doc, asset)
                    examination.$extention.assets.push(asset)

                }

            }

            await controller.commitBatch(batch, "add resolved assets")

            // // START DEBUG COMMENT

            //!!!!!!!!!!!!!!
            let backupSourcePath = controller.resolveTemplate(backup.source[org], { examination })
            logger.info(`Backup ${backupSourcePath}`)
            await sourceDrive.copy(backupSourcePath, targetDrive, backup.location)

        }


        // // END DEBUG COMMENT

        logger.info(`${examination.patientId} data will be protected.`)

        ////////////////////////////////////////////////////////////////////////////////////////////////////////








        let labelingRecords = controller.buildLabelingRecords1(examination, labelsMetadata)
        labelingRecords.labelRecords = await controller.checkPath(labelingRecords.labelRecords, fb)


        let pf = find(labelingRecords.formRecords, f => f.type == "patient")

        if (!pf) {
            pf = {
                type: "patient",
                data: {
                    en: {},
                    uk: {}
                }
            }
            labelingRecords.formRecords.push(pf)
        }

        pf.data.en.clinical_diagnosis += (examination._validation === true) ? "" : "\n INCOMPLETE:\n" + examination._validation
        pf.data.uk.clinical_diagnosis += (examination._validation === true) ? "" : "\n INCOMPLETE:\n" + examination._validation


        // console.log("labelingRecords.formRecords", labelingRecords.formRecords)


        let labelOps = labelingRecords.labelRecords.map(l => ({
            replaceOne: {
                "filter": { path: l.path },
                "replacement": l,
                "upsert": true
            }
        }))

        logger.info(`Insert into labeling: ${mongodb.config.db[org].labelingCollection} ${labelOps.length} items`)

        if (!settings.test) {

            await mongodb.execute.bulkWrite(
                mongodb.config.db[org].labelingCollection,
                labelOps
            )
        } else {
            console.log("labelOps", JSON.stringify(labelOps, null, " "))
        }


        let formOps = labelingRecords.formRecords.map(l => ({
            replaceOne: {
                "filter": { id: l.id },
                "replacement": l,
                "upsert": true
            }
        }))



        ////////////////////////////////////////////////////////////////////////////////////////////////////
        //// debug forms
        // 
        // 


        const attachementForm = {
            "id": uuid(),
            "type": "attachements",
            "data": examination.$extention.assets
                .filter(d => d.type != "recording")
                .map((d, index) => ({
                    index,
                    name: d.publicName || `${d.type}${index}`,
                    mimeType: d.mimeType || d.type,
                    url: d.links.url
                })),
            examinationId: examination.id
        }

        formOps.push({
            replaceOne: {
                "filter": { id: attachementForm.id },
                "replacement": attachementForm,
                "upsert": true
            }
        })

        //////////////////////////////////////////////////////////////////////////////////////////////////////


        logger.info(`Insert into ${mongodb.config.db[org].formCollection} ${formOps.length} items`)

        if (!settings.test) {
            await mongodb.execute.bulkWrite(
                mongodb.config.db[org].formCollection,
                formOps
            )

            logger.info(`Finalize clinic forms`)
            await controller.finalizeForms(examination.patientId)
        }

    }

}

logger.info("Data synchronization finalized")
logger.info("")


controller.close()
}
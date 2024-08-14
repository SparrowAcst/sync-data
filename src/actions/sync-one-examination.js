const moment = require("moment")
const path = require("path")
const { find, sortBy, filter, extend, isUndefined, isNull } = require("lodash")
const { loadYaml, pathExists } = require("../utils/file-system")
const uuid = require("uuid").v4


module.exports = async settings => {

    const backup = loadYaml(path.join(__dirname, `../../.config/data/backup.yml`))
    const labelsMetadata = loadYaml(path.join(__dirname, `../../.config/labeling/labels.yml`))

    const controller = await require("../controller")({
        console,
        firebaseService: {
            noprefetch: true
        },
        mongodbService: {}
    })

    const mongodb = controller.mongodbService
    const fb = controller.firebaseService

    let importedRecords

    if (!settings.organization) throw new Error("Sync examination error: organization not defined")
    if (!settings.patientId) throw new Error("Sync examination error: patientId not defined")


    let org = settings.organization
    const patientRegExp = RegExp(settings.patientId)

    let submitedForms = await controller.getSubmitedForms(settings.noValidate)
    submitedForms = submitedForms.filter(f => patientRegExp.test(f.examination.patientId))

    let batch

    batch = fb.db.batch()

    //////////////////////////////////////////////////////////////////////////////////////////////////// 


    for (let i = 0; i < submitedForms.length; i++) {

        let submitedForm = submitedForms[i]

        submitedForm.examination = (await controller.expandExaminations2(...[submitedForm.examination]))[0]

        let insUser = extend({}, submitedForm.examination.$extention.users[0])
        let insOrganization = extend({}, submitedForm.examination.$extention.organizations[0])

        insUser.id = insUser.userId

        await mongodb.execute.replaceOne(
            mongodb.config.db[org].userCollection, { id: insUser.id },
            insUser
        )

        await mongodb.execute.replaceOne(
            mongodb.config.db[org].organizationCollection, { id: insOrganization.id },
            insOrganization
        )

        try {
            let doc = fb.db.collection("examinations").doc(submitedForm.examination.id)
            batch.update(doc, { state: settings.state || "inReview" })
        } catch (e) {
            console.log(e.toString())
        }

    }


    try {
        await controller.commitBatch(batch, "update examination state")
    } catch (e) {
        console.log(e.toString())
    }


    //////////////////////////////           Import Stage          //////////////////////////////////////////////////////////


    for (let i = 0; i < submitedForms.length; i++) {

        let batch

        batch = fb.db.batch()

        let examination = submitedForms[i].examination
        examination.state = settings.state || "inReview"
        examination.protocol = settings.protocol
        examination.org = org
        examination.synchronizedAt = new Date()
        examination.actorId = examination.userId

        let inserted = extend({}, examination)
        delete inserted.$extention

        inserted.form = {
            patient: submitedForms[i].patient,
            ekg: submitedForms[i].ekg,
            echo: submitedForms[i].echo,
            attachements: submitedForms[i].attachements,
            recordings: submitedForms[i].recordings,
            updatedAt: submitedForms[i].updatedAt,
            updatedBy: submitedForms[i].updatedBy,
            completeness: submitedForms[i].completeness
        }

        // console.log("SUBMIT", inserted)

        if (!settings.test) {

            await mongodb.execute.replaceOne(
                mongodb.config.db[org].examinationCollection, { id: inserted.id },
                inserted
            )
        }

        ////////////////////////////////////////////////////////////////////////////////////////////////////////


        let labelingRecords = controller.buildLabelingRecords1(examination, labelsMetadata)
        labelingRecords.labelRecords = await controller.checkPath(labelingRecords.labelRecords, fb)

        let labelOps = labelingRecords.labelRecords.map(l => ({
            replaceOne: {
                "filter": { path: l.path },
                "replacement": l,
                "upsert": true
            }
        }))

        importedRecords = {
            db: extend({url: mongodb.config.db.url, name: mongodb.config.db.name}, mongodb.config.db[org]),
            records: labelingRecords.labelRecords.map(l => ({
                id: l.id,
                "Examination ID": l["Examination ID"],
                Source: l.Source
            }))
        }    

        // console.log("importedRecords", importedRecords)


        await mongodb.execute.bulkWrite(
            mongodb.config.db[org].labelingCollection,
            labelOps
        )

        let formOps = labelingRecords.formRecords.map(l => {

            l.patientId = examination.patientId

            return {
                replaceOne: {
                    "filter": { id: l.id },
                    "replacement": l,
                    "upsert": true
                }
            }
        })

        await mongodb.execute.bulkWrite(
            mongodb.config.db[org].formCollection,
            formOps
        )

        await controller.finalizeForms(examination.patientId)

    }

    // controller.close()

    return importedRecords
}
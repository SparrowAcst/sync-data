const moment = require("moment")
const path = require("path")
const { find, sortBy, filter, extend, isUndefined, isNull } = require("lodash")
const { loadYaml, pathExists } = require("../utils/file-system")
const uuid = require("uuid").v4


const run = async () => {

    const backup = loadYaml(path.join(__dirname, `../../.config/data/backup.yml`))
    // const labelsMetadata = loadYaml(path.join(__dirname, `../../.config/labeling/labels.yml`))

    const controller = await require("../controller")({
        console,
        firebaseService: {
            noprefetch: true
        },
        mongodbService: {}
    })

    const mongodb = controller.mongodbService
    const fb = controller.firebaseService

    let patientId = "HOS01-01"

    let examination = await controller.getExaminationData(patientId)
    console.log(JSON.stringify(examination, null, " "))

    let res = {
        patientId: examination.patientId,
        records: examination.$extention.recordPoints.map( point => {
            let r = find(examination.$extention.records, record => record.parentId == point.id)
            let a = find(examination.$extention.assets, asset => asset.parentId == r.id)
            return {
                spot: point.spot,
                path: a.links.path
            }
        })
    }

    console.log(res)

}

run()


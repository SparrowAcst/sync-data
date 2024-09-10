const path = require("path")
const { isUndefined, find } = require("lodash")
// const getAISegmentation = require("../utils/ai-segmentation")

const run = async () => {

    const examinationCollection = "examination"
    const formCollection = "form"
    const outFormCollection = "form-upd"


    console.log("Update patientId in Heart Harvest 1")

    const mongodb = await require("../utils/mongodb")()

    const mem = (msg) => {
        const used = process.memoryUsage();
        console.log(`${msg}: Memory usage: ${Math.round(used.rss / 1024 / 1024 * 100) / 100} MB`);
        return used.rss
    }


    
    console.log("Process records:")

    const PAGE_SIZE = 10
    let bufferCount = 1

    do {

        const pipeline = [{
                '$match': {
                    "updPatientId": {
                        $exists: false
                    }
                }
            },
            {
                '$limit': PAGE_SIZE
            },
            {
                $lookup:
                  {
                    from: "form",
                    localField: "id",
                    foreignField: "examinationId",
                    as: "forms",
                  },
              }
        ]

        buffer = await mongodb.execute.aggregate(`sparrow.${examinationCollection}`, pipeline)
        
        if (buffer.length > 0) {
    
            console.log(`Buffer: ${bufferCount} (${buffer.length} items)`) // \n${buffer.map(d => d["Examination ID"]+":"+d.id+":"+d.path).join("\n")}`)
    
           
            let commands = []

            buffer.forEach( examination => {
                examination.updPatientId = true
                examination.forms.forEach( form => {
                    form.patientId = examination.patientId
                    commands.push({
                        replaceOne: {
                            "filter": { id: form.id },
                            "replacement": form,
                            "upsert": true
                        }    
                    })
                })
            }) 

            console.log(`Insert into sparrow.${outFormCollection} ${commands.length} items`)
            if (commands.length > 0) {
                await mongodb.execute.bulkWrite(`sparrow.${outFormCollection}`, commands)
            }
            console.log("Done")

            commands = buffer.map( d => {
    
                return {
                    replaceOne: {
                        "filter": { id: d.id },
                        "replacement": d,
                        "upsert": false
                    }
                }
                    
            })

            console.log(`Update in sparrow.${examinationCollection} ${commands.length} items`)
            if (commands.length > 0) {

                await mongodb.execute.bulkWrite(`sparrow.${examinationCollection}`, commands)

            }

            console.log("Done")

            mem(`Update patientId`)

        }

        bufferCount++

    } while (buffer.length > 0 && false)


    mongodb.close()

}

run()
const path = require("path")
const { isUndefined, find } = require("lodash")
const getAISegmentation = require("../utils/ai-segmentation")

const run = async (datasetName, segmentCollection) => {

    console.log("Update AI segmentation in Dataset")
    // const datasetName = "H3" //process.argv[2]
    // const segmentCollection = "H3-SEGMENTATION" //process.argv[3]

    if (!datasetName) {
        console.log("Dataset name not specified.")
        return
    }

    console.log(`Dataset: "${datasetName}"`)

    if (!segmentCollection) {
        console.log("segmentCollection not specified.")
        return
    }

    console.log(`Record Collection: "sparrow.${datasetName}"`)
    console.log(`Segmentation Collection: "sparrow.${segmentCollection}"`)


    const mongodb = await require("../utils/mongodb")()
    // const Storage = require("../utils/fb-storage")
    // const storage = new Storage(path.join(__dirname, `../../.config/key/fb/${datasetName}.fb.key.json`))


    const delay = (ms, msg) => new Promise(resolve => {
        console.info(`Wait ${ms} for ${msg} settings`)
        setTimeout(() => resolve(), ms)
    })

    const mem = (msg) => {
        const used = process.memoryUsage();
        console.log(`${msg}: Memory usage: ${Math.round(used.rss / 1024 / 1024 * 100) / 100} MB`);
        return used.rss
    }


    
    console.log(datasetName, ": Process records:")

    const PAGE_SIZE = 10
    let bufferCount = 1
    // let cache = []

    do {

        const pipeline = [{
                '$match': {
                    aiSegmentation: {
                        $exists: false
                    },
                    // id: {
                    //     $nin: cache
                    // }
                }
            },
            {
                '$sort': {
                    'Examination ID': 1
                }
            },
            {
                '$limit': PAGE_SIZE
            }
        ]

        buffer = await mongodb.execute.aggregate(`sparrow.${datasetName}`, pipeline)
        if (buffer.length > 0) {
    
            console.log(`${datasetName}: Buffer: ${bufferCount} (${buffer.length} items)`) // \n${buffer.map(d => d["Examination ID"]+":"+d.id+":"+d.path).join("\n")}`)
    
            // cache = cache.concat(buffer.map(d => d.id))
            console.log(buffer.map(d => `${d["Examination ID"]}: ${d.id} : ${d["Body Spot"]} : ${d.model}`).join("\n"))

            let segmentations = await getAISegmentation({ records: buffer })
            // console.log("segmentations",segmentations)
            availableSegmentations = segmentations //.filter(s => s.data)

            if (segmentations.length < availableSegmentations.length) {
                console.log(`IGNORE ${segmentations.length - availableSegmentations.length} items:`)
                // console.log(segmentations.filter(s => s.error).join("\n"))
            }

            let commands = availableSegmentations.map(d => ({
                replaceOne: {
                    "filter": { id: d.id },
                    "replacement": d,
                    "upsert": true
                }
            }))

            console.log(`${datasetName}: Insert into sparrow.${segmentCollection} ${commands.length} items`)
            if (commands.length > 0) {
                await mongodb.execute.bulkWrite(`sparrow.${segmentCollection}`, commands)
            }
            console.log("Done")

            commands = buffer.map( d => {
    
                let f = find(availableSegmentations, s => d.id == s.record.id)
    
                if(f) {
                    d.aiSegmentation = f.id
                }

                return {
                    replaceOne: {
                        "filter": { id: d.id },
                        "replacement": d,
                        "upsert": false
                    }
                }
                    
            })

            console.log(`${datasetName}: Update in sparrow.${datasetName} ${commands.length} items`)
            if (commands.length > 0) {

                await mongodb.execute.bulkWrite(`sparrow.${datasetName}`, commands)

            }

            console.log(datasetName,": Done")

            mem(`${datasetName}: Update AI segmentation`)

        }

        bufferCount++

    } while (buffer.length > 0 && false)


    mongodb.close()

}

module.exports = run
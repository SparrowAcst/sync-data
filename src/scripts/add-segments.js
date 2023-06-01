const path = require("path")

const run = async () => {

    console.log("ADD SEGMENTATION into DATASET")
    const datasetName = process.argv[2]
    const examPattern = process.argv[3] || ""

    if (!datasetName) {
        console.log("Dataset name not specified.")
        return
    }
    console.log(`DATASET: "${datasetName}" (pattern: ${examPattern})`)


    const mongodb = await require("../utils/mongodb")()
    const Storage = require("../utils/fb-storage")
    const storage = new Storage(path.join(__dirname, `../../.config/key/fb/${datasetName}.fb.key.json`))


    const delay = (ms, msg) => new Promise(resolve => {
        console.info(`Wait ${ms} for ${msg} settings`)
        setTimeout(() => resolve(), ms)
    })

    const mem = (msg) => {
        const used = process.memoryUsage();
        console.log(`${msg} :Memory usage: ${Math.round(used.rss / 1024 / 1024 * 100) / 100} MB`);
        return used.rss
    }



    const resolveSegmentation = async buffer => {

        let ops = []

        for (let i = 0; i < buffer.length; i++) {
            let labeling = buffer[i]
            process.stdout.write(`Load: (${i} ${labeling["Examination ID"]}) ${labeling.path}.json           ${'\x1b[0G'}`)
            let seg = await storage.fetchFileData(`${labeling.path}.json`)
            if (seg) {
                labeling.segmentation = JSON.parse(seg.toString())
                console.log()
                console.log(`UPDATE ${labeling["Examination ID"]} ${labeling["id"]}`)
                console.log()
            }    
            labeling.supd1 = true
            ops.push({
                replaceOne: {
                    "filter": { id: labeling.id },
                    "replacement": labeling,
                    "upsert": false
                }
            })
        }
        console.log()
        return ops
    }


    console.log("Add segmentation into finalized labeling if exists:")

    const PAGE_SIZE = 50
    let skip = 0
    let buffer = []
    bufferCount = 0

    do {

        const pipeline = [

          {
            '$match': {
              "FINALIZED": true, 
              "Stage Comment":{
                $not:{
                  $eq: "Error"
                }
              },
              "segmentation.unsegmentable":{
                    $exists: false
                },
               "segmentation.systole":{
                    $exists: false
                },
                
               "segmentation.diastole":{
                    $exists: false
                },
                "id": {
                  $regex: examPattern
                },

                "supd1":{
                    $exists: false
                }  
              
            }
          },

        	// {
         //        '$match': {
         //            supd: {
         //                $exists: false
         //            },
         //            // FINALIZED: true
         //        }
         //    },
            // {
            //     '$sort': {
            //         'Examination ID': 1
            //     }
            // },
            // {
            // 	$skip: skip 
            // },
            {
                '$limit': PAGE_SIZE
            }
        ]

        buffer = await mongodb.execute.aggregate(`sparrow.${datasetName}`, pipeline)
        if (buffer.length > 0) {
            console.log(`Buffer: ${bufferCount} starts at ${skip} (${buffer.length} items)`) // \n${buffer.map(d => d["Examination ID"]+":"+d.id+":"+d.path).join("\n")}`)
            let ops = await resolveSegmentation(buffer)

            if (ops.length > 0) {
                await mongodb.execute.bulkWrite(`sparrow.${datasetName}`, ops)
            }


            console.log(`Update ${ops.length} items`) //:\n${ops.map( d => d.replaceOne.replacement["Examination ID"]+":"+d.replaceOne.replacement.id).join("\n")}`)
            mem()
            await delay(2000, "wait for fetch next buffer")

        }

        skip += buffer.length
        bufferCount++

    } while (buffer.length > 0)


    mongodb.close()

}

run()
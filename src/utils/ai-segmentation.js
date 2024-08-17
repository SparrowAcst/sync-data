const moment = require("moment")
const { extend, isArray } = require("lodash")
const uuid = require("uuid").v4
const axios = require("axios")

const fbStorage = require("./fb")

const AI_SEGMENTATION_API = "https://eu5zfsjntmqmf7o6ycrcxyry4a0rikmc.lambda-url.us-east-1.on.aws/"


const transformAI2v2 = data => {
    // console.log(JSON.stringify(data, null, " "))
    let segments = [
        { ai: "s1", v2:"S1"},
        { ai: "s2", v2:"S2"},
        { ai: "unsegmentable", v2:"unsegmentable"},
        { ai: "s3", v2: "S3"},
        { ai: "s4", v2: "S4"}
    ]

    let res = {}
   
    if( data.segmentation ){
        segments.forEach( s => {
            if(data.segmentation[s.ai]){
                res[s.v2] = data.segmentation[s.ai].map( v => [
                    v.start.toFixed(3),
                    v.end.toFixed(3),
                    (["s3", "s4"].includes(s.ai)) ? v.freq_lower.toFixed(3) : '0.000',
                    (["s3", "s4"].includes(s.ai)) ? v.freq_upper.toFixed(3) : '22050.000'
                ])
            }    
        })
    }    

    res.v2 = true
    res.heart_rate = data.heart_rate
    res.murmur_present = data.murmur_present
    res.quality = data.quality
    res.afib_present = data.afib_present

    return res
}



const getAISegmentation = async settings => {

    let { records } = settings

    if (!records) throw new Error("AI segmentation error: records not defined")

    records = (isArray(records)) ? records : [records]    
    
    let result = []

    let iteration = 1

    for (let r of records) {

        let segmentation = {
            id: uuid(),
            patientId: r["Examination ID"],
            createdAt: new Date(),
            user: {
                name: "AI"
            },
        }

        try {
            
            let query

            if( r.Source && r.Source.url){
            
                query = { 
                    url: r.Source.url
                    // , 
                    // mimeType: r.Source.mimeType 
                }
            
            } else {
            
                let metadata = await fbStorage.getFileMetadata(r.path)
                
                query = {
                    url: `https://firebasestorage.googleapis.com/v0/b/stethophonedata.appspot.com/o/${encodeURIComponent(r.path)}?alt=media&token=${metadata.metadata.firebaseStorageDownloadTokens}`,
                    // mimeType: (metadata.contentType == "audio/x-wav") ? "audio/x-wav" : "application/x-zip"
                }
            }    

            console.log(iteration, "query", query)
            console.log(`${r["Examination ID"]}: ${r.id} : ${r["Body Spot"]} : ${r.model}`)

            iteration++

            let response

            try {
                response = await axios({
                    method: "POST",
                    url: AI_SEGMENTATION_API,
                    data: query
                })
            } catch (e) {

                console.log("AI SEGMENTATION: ", e.toString(), e.stack.toString(), JSON.stringify(e.response.data, null, " "))

                segmentation = extend({}, segmentation, {
                    record: extend({ id: r.id }, query),
                    error: `${e.toString()}: ${JSON.stringify(e.response.data, null, " ")}` 
                })

                result.push(segmentation)

                continue
            }    
            
            let data = response.data

            console.log("response:", (!!data) ? "success" : "error" )
            
            if(data){
                console.log(`quality: ${data.quality}\n`)
            }
            
            let id = uuid()
            
            data = transformAI2v2(data)
            data.id = id
             segmentation = extend(
            	{}, 
            	segmentation,
            	{
            		id,
                    record: extend({ id: r.id }, query),
            		data
            	} 
            )

        } catch (e) {

            console.log(e.toString(), e.stack.toString())

            segmentation = extend({}, segmentation, {
                error: `${e.toString()}: ${JSON.stringify(e.response.data, null, " ")}` 
            })

        }


        result.push(segmentation)

    }

    return result
}




module.exports = getAISegmentation


// const run = async () => {
//     let result = await getAISegmentation({
//         records: [{
//             id: "test",
//             path: "gU8kIKjkGfMOF8X4Y5obyx2kmdn2/recordings/Littmann_66e2d25e-6c66-441d-b8af-bb62832c11f9"
//         }]
//     })

//     console.log(JSON.stringify(result, null, " "))
// }


// run()

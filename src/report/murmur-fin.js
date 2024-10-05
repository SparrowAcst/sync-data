const { keys } = require("lodash")

const settings = {
    "Heart_Harvest_1": "harvest1",
    "Heart_Harvest_2": "H2",
    "Heart_Harvest_3": "H3",
    "Heart_Harvest_America": "hha",
    "Stethophone_App": "stethophone-app",
    "Phonendo": "phonendo",
    "Vinil": "vinil",
    "YODA": "yoda",
    "PhisioNet": "phisioNet",
    "DigiScope": "digiscope",
    "Vintage": "vintage",
    "Clinic4": "clinic4"
}

const pipelines = [

    [{
            $addFields: {
                oms: {
                    $size: "$Systolic murmurs",
                },
            },
        },
        {
            $match: {
                TODO: "Finalized",
                oms: {
                    $gt: 0,
                },
                "Systolic murmurs.0": {
                    $ne: "No systolic murmurs",
                },
            },
        },
        {
            $count: "count",
        },
    ],
    [{
            $addFields: {
                oms: {
                    $size: "$Systolic murmurs",
                },
            },
        },
        {
            $match: {
                TODO: "Finalized",
                oms: {
                    $gt: 0,
                },
                "Systolic murmurs.0": {
                    $ne: "No systolic murmurs",
                },
            },
        },
        {
            $group: {
                _id: "$Examination ID",
            },
        },
        {
            $count: "count",
        },
    ],

    [{
            $addFields: {
                oms: {
                    $size: "$Diastolic murmurs",
                },
            },
        },
        {
            $match: {
                TODO: "Finalized",
                oms: {
                    $gt: 0,
                },
                "Diastolic murmurs.0": {
                    $ne: "No diastolic murmurs",
                },
            },
        },
        {
            $count: "count",
        },
    ],
    [{
            $addFields: {
                oms: {
                    $size: "$Diastolic murmurs",
                },
            },
        },
        {
            $match: {
                TODO: "Finalized",
                oms: {
                    $gt: 0,
                },
                "Diastolic murmurs.0": {
                    $ne: "No diastolic murmurs",
                },
            },
        },
        {
            $group: {
                _id: "$Examination ID",
            },
        },
        {
            $count: "count",
        },
    ],
    [{
            $addFields: {
                oms: {
                    $size: "$Other murmurs",
                },
            },
        },
        {
            $match: {
                TODO: "Finalized",
                oms: {
                    $gt: 0,
                },
                "Other murmurs.0": {
                    $ne: "No Other Murmurs",
                },
            },
        },
        {
            $count: "count",
        },
    ],
    [{
            $addFields: {
                oms: {
                    $size: "$Other murmurs",
                },
            },
        },
        {
            $match: {
                TODO: "Finalized",
                oms: {
                    $gt: 0,
                },
                "Other murmurs.0": {
                    $ne: "No Other Murmurs",
                },
            },
        },
        {
            $group: {
                _id: "$Examination ID",
            },
        },
        {
            $count: "count",
        },
    ]




]


const run = async () => {

    const mongodb = await require("../utils/mongodb")()

    let datasets = keys(settings)

    for(let d of datasets){
        let res = []
        for(let p of pipelines){
            let count = await mongodb.execute.aggregate(`sparrow.${settings[d]}`, p)
            res.push((count.length > 0) ? count[0].count : 0)
        }
        console.log(d, res.join("\t"))
    }


}


run()
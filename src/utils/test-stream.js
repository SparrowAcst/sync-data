const fs = require('fs');

fs.createReadStream('./src/utils/test.txt')
    .pipe(
        fs.createWriteStream('./src/utils/test1.txt')
        .on("close", () => {
        console.log("Wclose")
        })
        .on("end", () => {
            console.log("Wend")
        })
        .on("finish", () => {
            console.log("Wfinish")
        })
    )
    .on("close", () => {
        console.log("Rclose")
    })
    .on("end", () => {
        console.log("Rend")
    })
    .on("finish", () => {
        console.log("Rfinish")
    })
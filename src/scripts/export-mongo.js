const action = require("../actions/export-mongo")

const run = async () => {

    const database = process.argv[2] || ""
    const collectionPath = process.argv[3] || database
    if( !database ) return

    await action(database, collectionPath)

}

run()

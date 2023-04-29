const action = require("../actions/import-mongo")

const run = async () => {

    const dir = process.argv[2] || ""
    if( !dir ) return

    await action(dir)

}

run()

const { keys, isString, isBoolean, flattenDeep } = require("lodash")

const reducePartitions = a => a.reduce( (acc, val) => {
    if( !isBoolean(val) ){
        if( !isString(acc) ) acc = ""
        return acc + `\n${val.toString()}`
    } else {
      if( isBoolean(acc) ){
        return acc && val
      } else {
        return acc
      }
    }
}, true)

const execute = (context, pipeline) => {

    let res = []
    
    for( let i=0; i < pipeline.length; i++){
        // console.log("p", i)
        let statement = pipeline[i]

        if( statement.eval ){
            try {
                if(isString(statement.eval)){
                  eval(statement.eval)  
                } else {
                    statement.eval(context)
                }
                continue
            } catch(e) {
                res.push(`## Couldn't evaluate:\n ${statement.eval}\n${e.toString()}`)    
                continue
            }    
        }  


        if( statement.validate || statement.transform){
            
            statement = statement.validate || statement.transform
            
            let testData
            let tester

            try {
                testData = eval(keys(statement)[0])
            } catch(e) {
                res.push(`## Couldn't evaluate:\n ${keys(statement)[0]}\n${e.toString()}`)
                continue
            }
            
            try {
                tester = (isString(statement[keys(statement)[0]])) 
                            ? eval(statement[keys(statement)[0]]) 
                            : statement[keys(statement)[0]](context)
            } catch(e) {
                res.push(`## Couldn't evaluate:\n ${statement[keys(statement)[0]]}\n${e.toString()}`)
                continue
            } 

            try {
                res.push( tester(testData) )
            } catch(e) {
                res.push(`## Couldn't execute:\n ${statement[keys(statement)[0]]}\n${e.toString()}`)
                continue
            }
        }                
    
    }

   return flattenDeep(res)

}

const validate = (context, pipeline) => reducePartitions(execute(context, pipeline))

module.exports = {
    validate,
    execute,
    reducePartitions
}    
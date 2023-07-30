const units = 'BKMGTPEZY'.split('')
const equals = (a, b) => a && a.toLowerCase() === b.toLowerCase()
const filesize = (bytes, options) => {

    bytes = typeof bytes == 'number' ? bytes : 0
    options = options || {}
    options.fixed = typeof options.fixed == 'number' ? options.fixed : 2
    options.spacer = typeof options.spacer == 'string' ? options.spacer : ' '

    options.calculate = spec => {
        let type = equals(spec, 'si') ? ['k', 'B'] : ['K', 'iB']
        const algorithm = equals(spec, 'si') ? 1e3 : 1024
        const magnitude = Math.log(bytes) / Math.log(algorithm) | 0
        const result = (bytes / Math.pow(algorithm, magnitude))
        const fixed = result.toFixed(options.fixed)
        
        if (magnitude - 1 < 3 && !equals(spec, 'si') && equals(spec, 'jedec'))
            type[1] = 'B'

        let suffix = magnitude ?
            (type[0] + 'MGTPEZY')[magnitude - 1] + type[1] :
            ((fixed | 0) === 1 ? 'Byte' : 'Bytes')

        return {
            suffix: suffix,
            magnitude: magnitude,
            result: result,
            fixed: fixed,
            bits: { result: result / 8, fixed: (result / 8).toFixed(options.fixed) }
        }
    }

    options.to = (unit, spec) => {
        const algorithm = equals(spec, 'si') ? 1e3 : 1024
        const position = units.indexOf(typeof unit == 'string' ? unit[0].toUpperCase() : 'B')
        const result = bytes

        if (position === -1 || position === 0) return result.toFixed(2)
        for (; position > 0; position--) result /= algorithm
        return result.toFixed(2)
    }

    options.humanize = spec => {
        const output = options.calculate(spec)
        return output.fixed + options.spacer + output.suffix
    }

    return options;
}
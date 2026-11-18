export type ValidationLevel = 'OK' | 'WARNING' | 'ERROR'

export type ValidationTest = { type: ValidationLevel; message: string }

export type ValidationOutcome = {
    status: ValidationLevel
    tests: ValidationTest[]
}

export type ValidationUnvalidated = {
    status: 'UNVALIDATED'
}

export type Validation<T> = {
    type: T
    at: string
} & (ValidationUnvalidated | ValidationOutcome)

export type Validations<T extends string | number | symbol> = { [K in T]: Validation<K> }

export type Loosely = {
    // oxlint-disable-next-line typescript/no-explicit-any
    [key: string]: any
}

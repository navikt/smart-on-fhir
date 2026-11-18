import type { Validation, Validations } from './validations'
import { ValidatorBuilder } from './validator-builder'

/**
 * Used to hold all the validations currently in a session, can be passed between different
 * validators so they share the state.
 */
export class BaseValidator<ValidationType extends string> {
    readonly validations: Validations<ValidationType>

    constructor(validations: Validations<ValidationType>) {
        this.validations = validations
    }

    update<K extends ValidationType>(validation: ValidatorBuilder<K>): void {
        const validations: Validations<K> = this.validations
        const result = validation.toValidation()
        validations[result.type] = result
    }

    report(): Validation<ValidationType>[] {
        return Object.values<Validation<ValidationType>>(this.validations)
    }

    export(): string {
        return JSON.stringify(this.validations)
    }
}

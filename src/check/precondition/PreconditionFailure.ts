/**
 * Error type produced whenever a precondition fails
 * @public
 */
export class PreconditionFailure extends Error {
  private static readonly SharedFootPrint: symbol = Symbol('fast-check/PreconditionFailure');
  private readonly footprint: symbol;
  constructor(readonly interruptExecution: boolean = false) {
    super();
    this.footprint = PreconditionFailure.SharedFootPrint;
  }
  static isFailure(err: any): err is PreconditionFailure {
    return err != null && (err as PreconditionFailure).footprint === PreconditionFailure.SharedFootPrint;
  }
}

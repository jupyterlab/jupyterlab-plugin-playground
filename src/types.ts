/**
 * Type representing a module.
 */
export interface IModule {
  [member: string]: IModuleMember;
}

/**
 * Type representing a value taken from a module (essentially any).
 */
export interface IModuleMember {
  _isModuleMember: boolean;
}

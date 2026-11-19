export type RegistrationPolicy = {
  allowedDomains: string[];
  deniedDomains: string[];
  deniedEmails: string[];
};

export type RegistrationPolicySnapshot = {
  settings: RegistrationPolicy;
  revision: number;
};

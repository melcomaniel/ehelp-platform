import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrganizationDto } from './organization.dto';

function validInput() {
  return {
    name: 'Department of Labor and Employment',
    code: 'DOLE',
    creation_key: '4de0964f-b699-4e4c-93c6-2c09f63c58dc',
    policy_config: {
      mfa_required: true,
      device_registration_required: true,
      session_timeout_minutes: 30,
    },
    initial_admin: {
      full_name: 'Organization Administrator',
      email: 'admin@dole.gov.ph',
    },
  };
}

describe('CreateOrganizationDto', () => {
  it('accepts a government admin email and baseline-compliant policy', async () => {
    const errors = await validate(
      plainToInstance(CreateOrganizationDto, validInput()),
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-government initial administrator email', async () => {
    const input = validInput();
    input.initial_admin.email = 'admin@example.com';
    const errors = await validate(
      plainToInstance(CreateOrganizationDto, input),
    );
    expect(errors.some((error) => error.property === 'initial_admin')).toBe(
      true,
    );
  });

  it('rejects policy settings weaker than the platform baseline', async () => {
    const input = validInput();
    input.policy_config.mfa_required = false;
    input.policy_config.device_registration_required = false;
    input.policy_config.session_timeout_minutes = 60;
    const errors = await validate(
      plainToInstance(CreateOrganizationDto, input),
    );
    expect(errors.some((error) => error.property === 'policy_config')).toBe(
      true,
    );
  });

  it('requires both policy and initial administrator input', async () => {
    const input = validInput() as Partial<ReturnType<typeof validInput>>;
    delete input.policy_config;
    delete input.initial_admin;
    const errors = await validate(
      plainToInstance(CreateOrganizationDto, input),
    );
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['policy_config', 'initial_admin']),
    );
  });
});

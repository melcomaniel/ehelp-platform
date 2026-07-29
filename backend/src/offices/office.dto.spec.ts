import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateOfficeAdminDto,
  CreateStaffRequestDto,
  OfficeLifecycleReasonDto,
} from './office.dto';

describe('OfficeLifecycleReasonDto', () => {
  it('trims and accepts a valid archive reason', async () => {
    const dto = plainToInstance(OfficeLifecycleReasonDto, {
      reason: '  Regional consolidation  ',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.reason).toBe('Regional consolidation');
  });

  it.each([{}, { reason: '' }, { reason: 'no' }])(
    'rejects a missing or too-short archive reason',
    async (input) => {
      const dto = plainToInstance(OfficeLifecycleReasonDto, input);
      expect(await validate(dto)).not.toHaveLength(0);
    },
  );
});

describe('CreateOfficeAdminDto', () => {
  it('accepts any valid email address', async () => {
    const dto = plainToInstance(CreateOfficeAdminDto, {
      full_name: '  Regional Admin  ',
      email: '  Admin@Example.com  ',
      phone: ' 09171234567 ',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.full_name).toBe('Regional Admin');
    expect(dto.email).toBe('admin@example.com');
    expect(dto.phone).toBe('09171234567');
  });

  it('rejects an invalid email address', async () => {
    const dto = plainToInstance(CreateOfficeAdminDto, {
      full_name: 'Regional Admin',
      email: 'not-an-email',
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it.each([{}, { full_name: 'Regional Admin' }])(
    'rejects missing required fields',
    async (input) => {
      const dto = plainToInstance(CreateOfficeAdminDto, input);
      expect(await validate(dto)).not.toHaveLength(0);
    },
  );
});

describe('CreateStaffRequestDto', () => {
  it.each(['evaluator', 'approver'])(
    'accepts an Evaluator/Approver staff request (%s)',
    async (role) => {
      const dto = plainToInstance(CreateStaffRequestDto, {
        full_name: '  New Officer  ',
        email: '  Officer@Example.com  ',
        role,
      });

      expect(await validate(dto)).toHaveLength(0);
      expect(dto.full_name).toBe('New Officer');
      expect(dto.email).toBe('officer@example.com');
      expect(dto.role).toBe(role);
    },
  );

  it.each(['office_admin', 'org_admin', 'platform_admin', 'satellite_admin', ''])(
    'rejects a role other than evaluator/approver (%s)',
    async (role) => {
      const dto = plainToInstance(CreateStaffRequestDto, {
        full_name: 'New Officer',
        email: 'officer@example.com',
        role,
      });

      expect(await validate(dto)).not.toHaveLength(0);
    },
  );

  it('rejects a missing role', async () => {
    const dto = plainToInstance(CreateStaffRequestDto, {
      full_name: 'New Officer',
      email: 'officer@example.com',
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });
});

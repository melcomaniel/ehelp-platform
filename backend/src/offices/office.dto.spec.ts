import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOfficeAdminDto, OfficeLifecycleReasonDto } from './office.dto';

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
  it('accepts a valid Philippine government email address', async () => {
    const dto = plainToInstance(CreateOfficeAdminDto, {
      full_name: '  Regional Admin  ',
      email: '  Admin@Region.gov.ph  ',
      phone: ' 09171234567 ',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.full_name).toBe('Regional Admin');
    expect(dto.email).toBe('admin@region.gov.ph');
    expect(dto.phone).toBe('09171234567');
  });

  it('rejects a non-government email address', async () => {
    const dto = plainToInstance(CreateOfficeAdminDto, {
      full_name: 'Regional Admin',
      email: 'admin@gmail.com',
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

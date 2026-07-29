import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OfficeLifecycleReasonDto } from './office.dto';

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

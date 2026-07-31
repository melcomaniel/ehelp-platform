import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { DataSource } from 'typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from './jwt.strategy';

/** Accepts only short-lived SSO pending tokens (purpose=login_pending). */
@Injectable()
export class JwtPendingStrategy extends PassportStrategy(
  Strategy,
  'jwt-pending',
) {
  constructor(
    config: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.purpose !== 'login_pending') {
      throw new UnauthorizedException('Pending login token required');
    }
    const rows = await this.dataSource.query<
      Array<{ id: string; status: string; is_active: boolean }>
    >(
      `SELECT id, status, is_active FROM user_accounts WHERE id = $1 LIMIT 1`,
      [payload.sub],
    );
    const user = rows[0];
    if (!user) throw new UnauthorizedException();
    if (!user.is_active || user.status !== 'active') {
      throw new UnauthorizedException('Account is suspended');
    }
    if (
      payload.erd_role === 'PLATFORM_ADMIN' &&
      (await this.invalidPlatformAdmin(payload.sub))
    ) {
      throw new ForbiddenException('Invalid Platform Administrator scope');
    }
    return payload;
  }

  private async invalidPlatformAdmin(userId: string): Promise<boolean> {
    const rows = await this.dataSource.query<
      Array<{
        account_type: string;
        organization_id: string | null;
        office_id: string | null;
      }>
    >(
      `SELECT account_type, organization_id, office_id
       FROM user_accounts WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const u = rows[0];
    if (!u) return true;
    return (
      u.account_type !== 'platform_admin' ||
      !!u.organization_id ||
      !!u.office_id
    );
  }
}

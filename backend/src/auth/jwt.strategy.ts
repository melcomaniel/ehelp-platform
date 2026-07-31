import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { DataSource } from 'typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';

export type JwtPayload = {
  sub: string;
  role: string;
  erd_role?: string;
  erd_roles?: string[];
  email?: string | null;
  /** Present on short-lived SSO pending tokens only. */
  purpose?: 'login_pending';
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
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
    if (payload.purpose === 'login_pending') {
      throw new UnauthorizedException(
        'Complete face liveness before using the app session',
      );
    }
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        organization_id: string | null;
        office_id: string | null;
        account_type: string;
        status: string;
        is_active: boolean;
        organization_status: string | null;
      }>
    >(
      `SELECT u.id, u.organization_id, u.office_id, u.account_type,
              u.status, u.is_active, o.status AS organization_status
       FROM user_accounts u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1 LIMIT 1`,
      [payload.sub],
    );
    const user = rows[0];
    if (!user) throw new UnauthorizedException();
    if (!user.is_active || user.status !== 'active') {
      throw new UnauthorizedException('Account is suspended');
    }
    if (user.organization_id && user.organization_status !== 'active') {
      throw new ForbiddenException('Organization is suspended or archived');
    }
    if (
      payload.erd_role === 'PLATFORM_ADMIN' &&
      (user.account_type !== 'platform_admin' ||
        user.organization_id ||
        user.office_id)
    ) {
      throw new ForbiddenException('Invalid Platform Administrator scope');
    }
    return payload;
  }
}

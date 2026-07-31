import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BeneficiaryEntity } from '../users/beneficiary.entity';
import { LivenessSessionEntity } from '../users/liveness-session.entity';
import { StaffProfileEntity } from '../users/staff-profile.entity';
import {
  RoleEntity,
  UserAccountEntity,
  UserRoleAssignmentEntity,
} from '../users/user.entity';
import { OrganizationInvitationEntity } from '../organizations/organization.entities';
import { isLiveAdapter } from './auth-provider-mode';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtPendingStrategy } from './jwt-pending.strategy';
import { JwtStrategy } from './jwt.strategy';
import { RbacAccessService } from './rbac-access.service';
import {
  LiveEgovSsoProvider,
  LiveEverifyProvider,
  LiveLivenessProvider,
} from './providers/live.providers';
import {
  MockEgovSsoProvider,
  MockEverifyProvider,
  MockLivenessProvider,
} from './providers/mock.providers';
import {
  EGOV_SSO_PROVIDER,
  EVERIFY_PROVIDER,
  LIVENESS_PROVIDER,
} from './providers/tokens';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'ehelp-dev-jwt-secret',
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
            '7d') as `${number}d`,
        },
      }),
    }),
    TypeOrmModule.forFeature([
      UserAccountEntity,
      BeneficiaryEntity,
      StaffProfileEntity,
      RoleEntity,
      UserRoleAssignmentEntity,
      LivenessSessionEntity,
      OrganizationInvitationEntity,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RbacAccessService,
    JwtStrategy,
    JwtPendingStrategy,
    LiveEgovSsoProvider,
    MockEgovSsoProvider,
    LiveEverifyProvider,
    MockEverifyProvider,
    LiveLivenessProvider,
    MockLivenessProvider,
    {
      provide: EGOV_SSO_PROVIDER,
      inject: [ConfigService, LiveEgovSsoProvider, MockEgovSsoProvider],
      useFactory: (
        config: ConfigService,
        live: LiveEgovSsoProvider,
        mock: MockEgovSsoProvider,
      ) => (isLiveAdapter(config, 'AUTH_SSO_MODE') ? live : mock),
    },
    {
      provide: EVERIFY_PROVIDER,
      inject: [ConfigService, LiveEverifyProvider, MockEverifyProvider],
      useFactory: (
        config: ConfigService,
        live: LiveEverifyProvider,
        mock: MockEverifyProvider,
      ) => (isLiveAdapter(config, 'AUTH_EVERIFY_MODE') ? live : mock),
    },
    {
      provide: LIVENESS_PROVIDER,
      inject: [ConfigService, LiveLivenessProvider, MockLivenessProvider],
      useFactory: (
        config: ConfigService,
        live: LiveLivenessProvider,
        mock: MockLivenessProvider,
      ) => (isLiveAdapter(config, 'AUTH_LIVENESS_MODE') ? live : mock),
    },
  ],
  exports: [AuthService, RbacAccessService],
})
export class AuthModule {}
